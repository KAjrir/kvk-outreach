import dotenv from 'dotenv';
dotenv.config();

import { buildEmailDraft } from './src/mailer.js';
import { sendOutreachEmail } from './src/mailer.js';

const TEST_EMAIL = process.env.TEST_EMAIL;
const FROM_EMAIL = process.env.TEST_FROM_EMAIL || process.env.FROM_EMAIL;

if (!TEST_EMAIL || !FROM_EMAIL) {
  throw new Error('TEST_EMAIL en TEST_FROM_EMAIL (of FROM_EMAIL) ontbreken in .env');
}

async function testMails() {
  console.log(`\n📧 Testmails versturen naar ${TEST_EMAIL}\n`);

  // Test 1 — bedrijf met website en issues
  const draftWithWebsite = buildEmailDraft({
    companyName: 'Loodgietersbedrijf Janssen',
    issues: [
      'De website laadt traag op mobiel',
      'Geen duidelijk contactformulier',
      'Verouderd design dat niet mobielvriendelijk is',
    ],
    websiteUrl: 'http://loodgieterjanssen.example',
    hasNoWebsite: false,
  });

  console.log('📤 Verstuur test 1 — met website...');
  await sendOutreachEmail({
    email: TEST_EMAIL,
    emailSubject: `[TEST] ${draftWithWebsite.subject}`,
    emailBody: draftWithWebsite.html,
    fromEmail: FROM_EMAIL,
  });
  console.log('✅ Test 1 verstuurd');

  // Wacht even
  await new Promise(r => setTimeout(r, 2000));

  // Test 2 — bedrijf zonder website
  const draftNoWebsite = buildEmailDraft({
    companyName: 'Kapsalon Mooie Dag',
    issues: [],
    websiteUrl: null,
    hasNoWebsite: true,
  });

  console.log('📤 Verstuur test 2 — zonder website...');
  await sendOutreachEmail({
    email: TEST_EMAIL,
    emailSubject: `[TEST] ${draftNoWebsite.subject}`,
    emailBody: draftNoWebsite.html,
    fromEmail: FROM_EMAIL,
  });
  console.log('✅ Test 2 verstuurd');

  console.log(`\n✅ Beide testmails verstuurd naar ${TEST_EMAIL}\n`);
}

testMails().catch(console.error);