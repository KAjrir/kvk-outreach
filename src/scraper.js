import puppeteer from 'puppeteer';

export async function captureScreenshot(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Timeout van 15 seconden — trage sites skippen we
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    const screenshotBuffer = await page.screenshot({
      fullPage: false,
      type: 'jpeg',
      quality: 80,
    });

    // Extra checks terwijl we toch op de pagina zijn
    const checks = await page.evaluate(() => ({
      hasMetaViewport: !!document.querySelector('meta[name="viewport"]'),
      title: document.title || null,
      hasContactForm: !!document.querySelector('form'),
    }));

    return {
      screenshot: screenshotBuffer.toString('base64'),
      checks,
      url,
    };
  } catch (err) {
    console.error(`❌ Screenshot mislukt voor ${url}:`, err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

export function normalizeUrl(url) {
  if (!url) return null;
  if (!url.startsWith('http')) return `https://${url}`;
  return url;
}