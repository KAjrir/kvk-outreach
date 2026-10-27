import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { leadExists } from './db.js';
import { getTodaysSearches, ALL_COMBINATIONS } from './searches.js';
import dotenv from 'dotenv';
dotenv.config();

puppeteerExtra.use(StealthPlugin());

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1280, height: 800 },
];

// Eigen vaste lijst — betrouwbaar, altijd een resultaat, geen null risico
const USER_AGENTS = [
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function getNewUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const MAX_PAGE_NUMS = parseInt(process.env.MAX_PAGE_NUMS || '1');

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Ruimere delays — liever langzaam en succesvol dan snel en geblokkeerd
const randomDelay = () => sleep(5000 + Math.random() * 5000);   // 5-10s tussen paginas
const shortDelay  = () => sleep(2000 + Math.random() * 3000);   // 2-5s na muisbeweging
const blockDelay  = () => sleep(8000 + Math.random() * 7000);   // 8-15s extra na blokkade

function isBlocked(html) {
  return html.includes('Incapsula') ||
    html.includes('_Incapsula') ||
    html.includes('NOINDEX, NOFOLLOW') ||
    html.includes('Request unsuccessful');
}

function extractGgId(url) {
  const match = url.match(/\/nl\/bedrijf\/[^/]+\/(L\d+)\//);
  return match ? match[1] : null;
}

async function createPage(browser) {
  const userAgent = getNewUserAgent();
  console.log(`  🕵️  User agent: ${userAgent.substring(0, 60)}...`);
  const context = browser.defaultBrowserContext();
  const page = await context.newPage();
  await page.setUserAgent(userAgent);
  await page.setViewport(randomItem(VIEWPORTS));
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  });
  return page;
}

// Probeer cookies banner weg te klikken — Goudengids gebruikt een consent popup
async function acceptCookies(page) {
  try {
    // Wacht even zodat de banner tijd heeft om te laden
    await sleep(2000 + Math.random() * 1000);

    // Goudengids gebruikt een CookieFirst of vergelijkbare banner
    // Probeer meerdere mogelijke selectors
    const selectors = [
      '#cookiescript_accept',  // Goudengids cookie banner
      'button[data-cookiefirst-action="accept"]',
      '#cookiefirst-accept-all',
      'button[id*="accept"]',
      'button[class*="accept"]',
    ];

    for (const selector of selectors) {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        console.log(`  🍪 Cookies geaccepteerd (${selector})`);
        await sleep(1000 + Math.random() * 500);
        return;
      }
    }

    // Als geen selector werkt, probeer via tekst
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const acceptBtn = buttons.find(b =>
        b.textContent.toLowerCase().includes('accepteer') ||
        b.textContent.toLowerCase().includes('accept all') ||
        b.textContent.toLowerCase().includes('alles accepteren')
      );
      if (acceptBtn) { acceptBtn.click(); return true; }
      return false;
    });

    if (clicked) {
      console.log('  🍪 Cookies geaccepteerd via tekst');
      await sleep(1000 + Math.random() * 500);
    } else {
      console.log('  ℹ️  Geen cookiesbanner gevonden');
    }
  } catch (err) {
    console.log('  ⚠️  Cookies klikken mislukt (gaat verder):', err.message);
  }
}

async function warmUp(page) {
  console.log('  🌡️  Warming up — homepage bezoeken...');
  try {
    await page.goto('https://www.goudengids.nl/', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await sleep(3000 + Math.random() * 2000);

    // Cookies banner wegklikken
    await acceptCookies(page);

    await sleep(2000 + Math.random() * 2000);
    await page.evaluate(() => window.scrollBy(0, 300 + Math.random() * 400));
    await sleep(2000 + Math.random() * 2000);
    await page.goto('https://www.goudengids.nl/nl/zoeken/loodgieter/', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await sleep(3000 + Math.random() * 3000);
    console.log('  ✅ Warm-up klaar');
  } catch (err) {
    console.log('  ⚠️  Warm-up fout (gaat verder):', err.message);
  }
}

async function loadUrl(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await sleep(3500 + Math.random() * 3000);   // 3.5-6.5s wachten na laden

  // Menselijk scrollen — stap voor stap naar beneden zoals een echte gebruiker
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let scrolled = 0;
      const total = 400 + Math.random() * 400;
      const interval = setInterval(() => {
        const step = 80 + Math.random() * 60;
        window.scrollBy(0, step);
        scrolled += step;
        if (scrolled >= total) {
          clearInterval(interval);
          resolve();
        }
      }, 150 + Math.random() * 100);
    });
  });

  await sleep(1000 + Math.random() * 1000);
  await page.mouse.move(200 + Math.random() * 500, 150 + Math.random() * 300);
  await shortDelay();
  const html = await page.content();
  return { html, blocked: isBlocked(html) };
}

async function scrapeSearchPage(page, branche, stad, pageNum) {
  const url = `https://www.goudengids.nl/nl/zoeken/${branche}/${stad}/${pageNum}`;
  console.log(`  📄 ${url}`);
  try {
    const { blocked } = await loadUrl(page, url);
    if (blocked) return { links: [], blocked: true };

    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/nl/bedrijf/"]'));
      return [...new Set(anchors.map(a => a.href))].filter(href =>
        /\/nl\/bedrijf\/[^/]+\/[A-Z][0-9]+\//.test(href)
      );
    });
    return { links, blocked: false };
  } catch (err) {
    console.error(`  ❌ Mislukt:`, err.message);
    return { links: [], blocked: false };
  }
}

async function extractDetailData(page) {
  return await page.evaluate(() => {
    const sidebar = document.querySelector('.grid-col-placeholder');
    if (!sidebar) return null;

    const h1 = sidebar.querySelector('h1');
    const companyName = h1?.childNodes[0]?.textContent?.trim().replace(/\s+/g, ' ') || null;

    const ggIdMatch = location.pathname.match(/\/nl\/bedrijf\/[^/]+\/(L\d+)\//);
    const ggId = ggIdMatch ? ggIdMatch[1] : null;

    const sidebarText = sidebar.innerText || '';
    const kvkMatch = sidebarText.match(/KVK-nummer[:\s]+(\d+)/);
    const kvkNumber = kvkMatch ? kvkMatch[1] : null;

    const actions = sidebar.querySelector('#detail-actions');
    const mailtoEl = actions?.querySelector('a[href^="mailto:"]');
    const email = mailtoEl ? mailtoEl.href.replace('mailto:', '').split('?')[0].trim() : null;

    const websiteEl = actions?.querySelector(
      'a[href^="http"]:not([href*="goudengids"]):not([href^="mailto"])'
    );
    const website = websiteEl?.href || null;

    const telEl = actions?.querySelector('a[href^="tel:"]');
    const phone = telEl ? telEl.href.replace('tel:', '').trim() : null;

    return { ggId, kvkNumber, companyName, email, website, phone, sourceUrl: location.href };
  });
}

async function scrapeDetailPage(page, url) {
  try {
    const { blocked } = await loadUrl(page, url);
    if (blocked) return { data: null, blocked: true };
    const data = await extractDetailData(page);
    return { data, blocked: false };
  } catch (err) {
    console.error(`  ❌ Mislukt:`, err.message);
    return { data: null, blocked: false };
  }
}

async function retryAfterBlock(page, url, type = 'detail', label = '') {
  // Bij blokkade: wissel user agent en wacht steeds langer
  const waitTimes = [20000, 45000, 90000];  // 20s, 45s, 1.5 min
  for (let attempt = 0; attempt < waitTimes.length; attempt++) {
    const wait = waitTimes[attempt];
    console.log(`  🕐 Wacht ${wait / 1000}s voor retry${label ? ` (${label})` : ''}...`);
    await sleep(wait);

    try {
      const { blocked } = await loadUrl(page, url);
      if (!blocked) {
        console.log(`  ✅ Retry geslaagd na ${wait / 1000}s`);
        if (type === 'detail') {
          const data = await extractDetailData(page);
          return { data, blocked: false };
        } else {
          const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/nl/bedrijf/"]'));
            return [...new Set(anchors.map(a => a.href))].filter(href =>
              /\/nl\/bedrijf\/[^/]+\/[A-Z][0-9]+\//.test(href)
            );
          });
          return { links, blocked: false };
        }
      }
      console.log(`  ⚠️  Nog steeds geblokkeerd (poging ${attempt + 2})`);
      await blockDelay();  // Extra wachttijd tussen pogingen
    } catch (err) {
      console.error(`  ❌ Mislukt:`, err.message);
    }
  }
  return type === 'detail' ? { data: null, blocked: true } : { links: [], blocked: true };
}

export async function fetchFromGoudenGids() {
  // Ctrl+C signal — huidige pagina afmaken en dan stoppen met wat er al is
  let stopRequested = false;
  const onSigint = () => {
    console.log('\n⚠️  Stop gevraagd (Ctrl+C) — huidige pagina afmaken en resultaten verwerken...');
    stopRequested = true;
  };
  process.once('SIGINT', onSigint);

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
  ];
  if (process.env.PROXY_URL) {
    launchArgs.push(`--proxy-server=${process.env.PROXY_URL}`);
    console.log('🌐 Proxy actief');
  }

  const browser = await puppeteerExtra.launch({ headless: false, args: launchArgs });
  const results = [];
  const seenInSession = new Set();

  try {
    const page = await createPage(browser);
    await warmUp(page);

    const searches = getTodaysSearches();
    console.log(`📅 Vandaag: ${searches.length} combinaties van ${ALL_COMBINATIONS.length} totaal`);
    console.log(`   ${searches.map(s => `${s.branche}/${s.stad}`).join(', ')}\n`);

    for (const { branche, stad } of searches) {
      if (stopRequested) break;
      console.log(`\n🔍 Zoeken: ${branche} in ${stad}`);

      let allLinks = [];

      for (let pageNum = 1; pageNum <= MAX_PAGE_NUMS; pageNum++) {
        if (stopRequested) break;
        let { links, blocked } = await scrapeSearchPage(page, branche, stad, pageNum);

        if (blocked) {
          const url = `https://www.goudengids.nl/nl/zoeken/${branche}/${stad}/${pageNum}`;
          const retry = await retryAfterBlock(page, url, 'search', `${branche} p${pageNum}`);
          if (retry.blocked) {
            console.log(`  ❌ Pagina ${pageNum} definitief geblokkeerd — branche overslaan`);
            break;
          }
          links = retry.links;
        }

        if (links.length === 0) {
          console.log(`  ℹ️  Geen resultaten meer op pagina ${pageNum}`);
          break;
        }

        allLinks = [...new Set([...allLinks, ...links])];
        console.log(`  📄 Pagina ${pageNum}: ${links.length} links (totaal: ${allLinks.length})`);
        await randomDelay();
      }

      const newLinks = [];
      let skippedSession = 0;
      let skippedDb = 0;

      for (const link of allLinks) {
        const ggId = extractGgId(link);
        if (!ggId) { newLinks.push(link); continue; }
        if (seenInSession.has(ggId)) { skippedSession++; continue; }
        if (await leadExists(ggId)) { skippedDb++; seenInSession.add(ggId); continue; }
        newLinks.push(link);
      }

      console.log(`  ✅ ${newLinks.length} nieuw te scrapen (${skippedDb} al in DB, ${skippedSession} al in sessie)`);

      for (const [index, link] of newLinks.entries()) {
        if (stopRequested) {
          console.log(`  ⚠️  Gestopt na ${index} van ${newLinks.length} bedrijfspaginas`);
          break;
        }
        console.log(`  Bezig met bedrijfspagina [${index + 1}/${newLinks.length}]`);

        let { data: detail, blocked } = await scrapeDetailPage(page, link);

        if (blocked) {
          const retry = await retryAfterBlock(page, link, 'detail', extractGgId(link) || '');
          if (retry.blocked) {
            console.log(`  ❌ Definitief geblokkeerd, overslaan`);
            continue;
          }
          detail = retry.data;
        }

        if (!detail) continue;
        if (!detail.ggId) { console.log(`  ⏭️  Geen GG ID, overslaan`); continue; }
        if (!detail.companyName) { console.log(`  ⏭️  Geen bedrijfsnaam (${detail.ggId}), overslaan`); continue; }

        seenInSession.add(detail.ggId);

        if (!detail.email) {
          console.log(`  ⏭️  ${detail.companyName} — geen email`);
          continue;
        }

        results.push({
          ggId: detail.ggId,
          kvkNumber: detail.kvkNumber || null,
          companyName: detail.companyName,
          email: detail.email,
          phone: detail.phone || null,
          website: detail.website || null,
          sourceUrl: detail.sourceUrl,
        });

        console.log(`  📌 ${detail.companyName} | GG: ${detail.ggId} | KVK: ${detail.kvkNumber || '—'} | ${detail.email} | ${detail.website || 'geen website'}`);
        await randomDelay();
      }
    }

    await page.close();
  } catch (err) {
    console.error(`❌ Mislukt:`, err.message);
  } finally {
    await browser.close();
    process.removeListener('SIGINT', onSigint); // Opruimen
  }

  if (stopRequested) {
    console.log(`\n⚠️  Vroegtijdig gestopt — ${results.length} bedrijven doorgeven aan pipeline`);
  } else {
    console.log(`\n✅ Totaal ${results.length} bedrijven gescraped`);
  }
  return results;
}