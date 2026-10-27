import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { setupDb, leadExists, insertLead, getLeadsByStatus } from '../src/db.js';
import { fetchNewCompanies } from '../src/kvk.js';
import { captureScreenshot, normalizeUrl } from '../src/scraper.js';
import { scoreWebsite } from '../src/scorer.js';
import { buildEmailDraft } from '../src/mailer.js';
import { sendTelegram } from '../src/telegram.js';

const SCORE_THRESHOLD = 6;
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || './screenshots';

async function processBatch() {
  console.log('\n🚀 Pipeline gestart');
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  await setupDb();

  const companies = await fetchNewCompanies();
  console.log(`📋 ${companies.length} kandidaten opgehaald — alles wordt verwerkt\n`);

  let saved = 0;
  let skipped = 0;

  for (const company of companies) {
    const { ggId, kvkNumber, companyName, email, phone, website, sourceUrl } = company;
    console.log(`\n--- ${companyName} | GG: ${ggId} | KVK: ${kvkNumber || '—'} ---`);

    if (await leadExists(ggId)) {
      console.log('⏭️  Al in database');
      continue;
    }

    // Geen email → skippen
    if (!email) {
      await insertLead({
        ggId, kvkNumber, companyName,
        email: null, phone, website,
        screenshotPath: null, score: null,
        scoreReason: 'geen email', issues: [],
        emailSubject: null, emailBody: null,
        sourceUrl, status: 'skipped',
      });
      console.log('⏭️  Geen email');
      skipped++;
      continue;
    }

    // Screenshot + scoring als er een website is
    let screenshotPath = null;
    let scoring = null;

    if (website) {
      const normalizedUrl = normalizeUrl(website);
      console.log(`📸 Screenshot van ${normalizedUrl}...`);
      const screenshotData = await captureScreenshot(normalizedUrl);

      if (screenshotData) {
        screenshotPath = path.join(SCREENSHOTS_DIR, `${ggId}.jpg`);
        fs.writeFileSync(screenshotPath, Buffer.from(screenshotData.screenshot, 'base64'));

        console.log('🤖 Beoordelen...');
        scoring = await scoreWebsite(screenshotData);
      } else {
        // Site onbereikbaar → skippen
        await insertLead({
          ggId, kvkNumber, companyName,
          email, phone, website,
          screenshotPath: null, score: null,
          scoreReason: 'site onbereikbaar', issues: [],
          emailSubject: null, emailBody: null,
          sourceUrl, status: 'skipped',
        });
        console.log('⏭️  Site onbereikbaar');
        skipped++;
        continue;
      }
    } else {
      console.log('ℹ️  Geen website — in review als nieuwe-site lead');
    }

    // Score te hoog → skippen
    if (scoring && (scoring.score > SCORE_THRESHOLD || !scoring.worth_contacting)) {
      await insertLead({
        ggId, kvkNumber, companyName,
        email, phone, website, screenshotPath,
        score: scoring.score, scoreReason: scoring.reason,
        issues: scoring.issues || [],
        emailSubject: null, emailBody: null,
        sourceUrl, status: 'skipped',
      });
      console.log(`⏭️  Score te hoog (${scoring.score})`);
      skipped++;
      continue;
    }

    if (scoring) {
      console.log(`📊 Score: ${scoring.score}/10 — ${scoring.reason}`);
    }

    // Alles goedgekeurd — opslaan als review
    const draft = buildEmailDraft({
      companyName,
      issues: scoring?.issues || [],
      websiteUrl: website,
      hasNoWebsite: !website,
    });

    await insertLead({
      ggId, kvkNumber, companyName,
      email, phone, website, screenshotPath,
      score: scoring?.score || null,
      scoreReason: scoring?.reason || null,
      issues: scoring?.issues || [],
      emailSubject: draft.subject,
      emailBody: draft.html,
      sourceUrl,
      status: 'review',
    });

    saved++;
    console.log(`📥 In review opgeslagen (${saved} totaal)`);

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n📊 Klaar — ${saved} in review, ${skipped} geskipt`);

  // Telegram melding
  const reviewLeads = await getLeadsByStatus('review');
  await sendTelegram(
    `🔍 <b>Webbeter — run klaar</b>\n\n` +
    `✅ Klaar voor review: <b>${reviewLeads.length} leads</b>\n` +
    `📥 Deze run: <b>${saved} nieuw</b>, ⏭️ ${skipped} geskipt\n\n` +
    `Open je dashboard om ze te bekijken.`
  );

  console.log('✅ Pipeline klaar\n');
}

processBatch().catch(console.error);