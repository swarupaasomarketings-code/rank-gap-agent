// Browser test of the automatic mode against a running app (BASE_URL, default http://localhost:3000).
// Reads the real aswebmarketings.com website over the internet. GOOGLE_API_KEY=... also runs the competitor search.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.env.SHOTS_DIR || 'tests/e2e/screenshots';
const KEY = process.env.GOOGLE_API_KEY || '';
fs.mkdirSync(OUT, { recursive: true });
const results = []; const consoleErrors = [];
const check = (name, ok, detail = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' – ' + detail : ''}`); };

// Shaped like Google's Businesses block for "seo company in kolkata" (26 Oct 2026), as copied from a browser.
const PASTE = {
  text: ['Sponsored', 'Web Make', '4.7(27) · Internet marketing service', 'Website', 'Directions',
    'Digital Piloto Pvt. Ltd.', '4.8(104) · Internet marketing service', '7+ years in business · Ranikuthi', 'Open 24 hours · 070039 41041', 'Provides: Best SEO Company India', 'Website', 'Directions',
    'Anttech Digital Marketing Agency', '4.9(598) · Internet marketing service', 'Open 24 hours · 079808 15656', 'Provides: Best SEO Company in Kolkata', 'Directions',
    'AS Webmarketings - Digital Marketing', '4.9(31) · Internet marketing service', '15+ years in business · 1d, Middle Rd', 'Open · Closes 11:30 pm · 089729 69179', 'Website', 'Directions'].join('\n'),
  html: `<div>Sponsored<div>Web Make</div>4.7(27) · Internet marketing service<a href="/aclk?adurl=https://webmake.example/">Website</a></div>
<div><div>Digital Piloto Pvt. Ltd.</div>4.8(104) · Internet marketing service Provides: Best SEO Company India<a href="/url?q=https://www.digitalpiloto.com/&amp;sa=U">Website</a></div>
<div><div>Anttech Digital Marketing Agency</div>4.9(598) · Internet marketing service<a href="/maps/dir/">Directions</a></div>
<div><div>AS Webmarketings - Digital Marketing</div>4.9(31) · Internet marketing service<a href="https://aswebmarketings.com/"><span>Website</span></a></div>`,
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(e.message));

try {
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.getByLabel('Your website').fill('aswebmarketings.com');
  await page.getByRole('button', { name: 'Scan website' }).click();
  await page.getByLabel('Business name').waitFor({ timeout: 30000 });
  check('scan finds the business name', await page.getByLabel('Business name').inputValue() === 'AS Webmarketings');
  check('scan finds the city', await page.getByLabel('City').inputValue() === 'kolkata');
  check('scan suggests "seo company in kolkata"', await page.getByRole('button', { name: 'seo company in kolkata' }).count() === 1);
  await page.getByRole('button', { name: 'seo company in kolkata' }).click();
  check('picking a suggestion fills the keyword', await page.getByLabel('Search keyword').inputValue() === 'seo company in kolkata');
  if (KEY) { await page.getByRole('button', { name: /Competitor search key/ }).click(); await page.getByLabel('API key').fill(KEY); }
  else {
    // A real paste event carrying the HTML and text a browser puts on the clipboard when Google's Businesses list is copied.
    await page.getByLabel('Pasted Google results').evaluate((el, { html, text }) => {
      const dt = new DataTransfer(); dt.setData('text/html', html); dt.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, PASTE);
    await page.getByText(/Read 3 businesses, 2 with a website/).waitFor();
    check('paste reads the businesses and their website links', true);
  }

  await page.getByRole('button', { name: 'Find competitors and gaps' }).click();
  await page.locator('#report').waitFor({ timeout: 240000 });
  const steps = await page.locator('ol[aria-live] li').allInnerTexts();
  check('progress is shown step by step', steps.length >= 3, steps.join(' → '));
  const text = await page.locator('#report').innerText();
  check('report: your position', /ranks #\d+ in Google/.test(text), text.slice(0, 160).replace(/\s+/g, ' '));
  check('ranking table shown', /Google['’]s order for/.test(text));
  check('competitor cards with gaps', await page.locator('#report article').count() >= 2 && text.includes('ranks above you'));
  check('Google profile problems section', text.includes('Your Google profile problems'));
  check('website audit section with problems', text.includes('Your website problems') && /\d+ Medium/.test(text));
  check('audit names the pages without an H1', text.includes('have no H1 heading'));
  check('audit explains home page vs SEO page', text.includes('Home page is not about "seo company"'));
  check('side-by-side table shown', text.includes('Side by side: who has what'));
  await page.screenshot({ path: `${OUT}/auto-report.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  check('no horizontal page scroll at phone width', !overflow); await page.screenshot({ path: `${OUT}/auto-mobile.png`, fullPage: true });
} catch (e) {
  check('run completed without exception', false, e.message.split('\n')[0]); await page.screenshot({ path: `${OUT}/auto-failure.png`, fullPage: true }).catch(() => {});
}
check('no browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
