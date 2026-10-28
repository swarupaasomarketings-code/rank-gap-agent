// Browser test of the full flow against a running app (BASE_URL, default http://localhost:3000).
// Offline by default. LIVE=1 also checks the real AS Webmarketings website over the internet.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.env.SHOTS_DIR || 'tests/e2e/screenshots';
const LIVE = process.env.LIVE === '1';
fs.mkdirSync(OUT, { recursive: true });
const results = []; const consoleErrors = [];
const check = (name, ok, detail = '') => { results.push({ ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' – ' + detail : ''}`); };

const MY_LISTING = `AS Webmarketings - Digital Marketing, SEO & Website Design Company
4.9(31) · Internet marketing service
15+ years in business · Kolkata, West Bengal
Open · Closes 11:30 pm · 089729 69179
Provides: Ecommerce Website Development`;
const RESULTS = `Digital Piloto Pvt. Ltd.
4.8(104) · Internet marketing service
7+ years in business · Ranikuthi Ground Fl, 113, ne...
Open 24 hours · 070039 41041
Provides: Best SEO Company India
AS Webmarketings - Digital Marketing
4.9(31) · Internet marketing service
15+ years in business · 1d, Middle Rd
Open · Closes 11:30 pm · 089729 69179`;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(e.message));
const report = () => page.locator('#report');
const findGap = async () => { await page.getByRole('button', { name: /Find the gap/ }).click(); await report().waitFor({ timeout: 60000 }); return report().innerText(); };

try {
  await page.goto(`${BASE}/manual`); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.getByRole('heading', { name: 'Your business' }).waitFor();
  check('page shows separate "Your business" and "Competitors" steps', await page.getByRole('heading', { name: 'Competitors' }).count() === 1);
  check('"Find the gap" waits until the basics are filled in', await page.getByRole('button', { name: /Find the gap/ }).isDisabled());

  // 1. Typed by hand: your listing pasted into your card, one competitor typed field by field
  await page.getByLabel('Search keyword').fill('website development company in kolkata');
  await page.getByRole('button', { name: 'Paste listing' }).first().click();
  await page.getByLabel('Paste your Google listing').fill(MY_LISTING);
  await page.getByRole('button', { name: 'Fill in' }).click();
  check('your listing fills your card', await page.getByLabel('name of your business').inputValue() === 'AS Webmarketings - Digital Marketing, SEO & Website Design Company'
    && await page.getByLabel('reviews of your business').inputValue() === '31' && await page.getByLabel('provides of your business').inputValue() === 'Ecommerce Website Development');
  check('a single pasted listing does not set a position', await page.getByLabel('rank of your business').inputValue() === '');
  await page.getByLabel('rank of your business').fill('3');
  await page.getByLabel('name of competitor 1').fill('Webguru Infosystems');
  await page.getByLabel('rank of competitor 1').fill('1');
  await page.getByLabel('rating of competitor 1').fill('4.6');
  await page.getByLabel('reviews of competitor 1').fill('640');
  await page.getByLabel('category of competitor 1').fill('Website designer');
  await page.getByLabel('hours of competitor 1').fill('Open 24 hours');
  await page.getByRole('button', { name: 'Add competitor' }).click();
  await page.getByLabel('name of competitor 2').fill('Kolkata Web Studio');
  await page.getByLabel('rank of competitor 2').fill('2');
  await page.getByLabel('reviews of competitor 2').fill('75');
  let text = await findGap();
  check('report: your position and both competitors above you', text.includes('ranks #3') && await report().locator('article').count() === 2, text.slice(0, 140).replace(/\s+/g, ' '));
  check('typed competitor: 640 vs 31 reviews is a high-impact gap', /High\s*Google reviews\s*They: 640/.test(text));
  check('typed competitor: open 24 hours gap found', text.includes('Webguru Infosystems is listed as open 24 hours'));
  check('your "Provides" line counts in your favour', text.includes('"Provides" match shown by Google (Ecommerce Website Development vs Not shown)'));
  check('multi-word service: category "Website designer" is not taken as a match for "website development"', !/Primary category[\s\S]{0,80}They: Website designer/.test(text));
  await page.screenshot({ path: `${OUT}/report-manual.png`, fullPage: true });

  // 2. Whole Google list pasted at once, your business picked from it
  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByLabel('Search keyword').fill('seo company in kolkata');
  await page.getByRole('button', { name: 'Paste Google results list' }).click();
  await page.getByLabel('Paste the Google results list').fill(RESULTS);
  await page.getByRole('button', { name: 'Fill in' }).click();
  await page.getByText('Found 2 businesses. Which one is yours?').waitFor();
  await page.getByRole('button', { name: 'AS Webmarketings - Digital Marketing', exact: true }).click();
  check('pasted list: yours goes to Step 2, the other to competitors', await page.getByLabel('name of your business').inputValue() === 'AS Webmarketings - Digital Marketing'
    && await page.getByLabel('name of competitor 1').inputValue() === 'Digital Piloto Pvt. Ltd.' && await page.getByLabel('rank of your business').inputValue() === '2');

  // 3. Example
  await page.getByRole('button', { name: 'Load example' }).click();
  check('example: 3 competitors (1 ad)', await page.getByLabel(/^name of competitor/).count() === 3 && await page.getByText('Ad: left out of the comparison').count() === 1);
  if (LIVE) await page.getByLabel('website of your business').fill('aswebmarketings.com');
  text = await findGap();
  check('example report: #3, two above you, ad left out', text.includes('ranks #3') && await report().locator('article').count() === 2 && !text.includes('Web Make'));
  check('"Provides" gap explained', text.includes('Provides: Best SEO Company India'));
  check('keyword-in-name warning', text.includes('Your business name may contain extra keywords'));
  if (LIVE) check('live: your home page title compared', text.includes('Service in page title'));
  await page.screenshot({ path: `${OUT}/report.png`, fullPage: true });

  await page.reload();
  check('inputs are remembered after reload', await page.getByLabel('reviews of competitor 2').inputValue() === '104');

  await page.setViewportSize({ width: 390, height: 800 }); await page.reload();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  check('no horizontal page scroll at phone width', !overflow); await page.screenshot({ path: `${OUT}/mobile.png`, fullPage: true });
} catch (e) {
  check('run completed without exception', false, e.message.split('\n')[0]); await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
}
check('no browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
