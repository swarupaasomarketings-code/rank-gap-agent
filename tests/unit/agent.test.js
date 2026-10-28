import { describe, it, expect } from 'vitest';
import { parseGoogleResults } from '../../src/lib/parseResults.js';
import { searchTerms } from '../../src/lib/terms.js';
import { analyse } from '../../src/lib/engine.js';
import { readPage } from '../../src/lib/siteCheck.js';

// Text as Chrome copies Google's "Businesses" block for "seo company in kolkata" (Oct 2026).
const DESKTOP = `Sponsored
Web Make
4.7(27) · Internet marketing service
10+ years in business · 2 Brabourne Road
Open · Closes 7 pm · 093393 97327
Grow Your Business Online - Get a professional website designed to attract customers and gro...
Website
Directions
Digital Piloto Pvt. Ltd.
4.8(104) · Internet marketing service
7+ years in business · Ranikuthi Ground Fl, 113, ne...
Open 24 hours · 070039 41041
Provides: Best SEO Company India
Website
Directions
AS Webmarketings - Digital Marketing
4.9(31) · Internet marketing service
15+ years in business · 1d, Middle Rd
Open · Closes 11:30 pm · 089729 69179
Viewed just now
Website
Directions
More businesses`;

describe('parseGoogleResults', () => {
  it('reads the desktop Businesses block, ads included', () => {
    const r = parseGoogleResults(DESKTOP);
    expect(r.map((b) => b.name)).toEqual(['Web Make', 'Digital Piloto Pvt. Ltd.', 'AS Webmarketings - Digital Marketing']);
    expect(r[0]).toMatchObject({ sponsored: true, rank: null, rating: 4.7, reviews: 27 });
    expect(r[1]).toMatchObject({ sponsored: false, rank: 1, rating: 4.8, reviews: 104, category: 'Internet marketing service', years: '7+ years', hours: 'Open 24 hours', phone: '070039 41041', provides: 'Best SEO Company India' });
    expect(r[2]).toMatchObject({ rank: 2, reviews: 31, years: '15+ years', address: '1d, Middle Rd', hours: 'Open · Closes 11:30 pm', provides: '' });
  });
  it('reads ratings split over lines, star glyphs, thousands and "No reviews"', () => {
    const r = parseGoogleResults(['Alpha Media', '4.6', '(1.2K)', '· Marketing agency', 'Beta SEO', '4.9 ★★★★★ (2,310) · Internet marketing service', 'Gamma Web', 'No reviews', 'Website designer'].join('\n'));
    expect(r.map((b) => [b.name, b.rating, b.reviews, b.category])).toEqual([
      ['Alpha Media', 4.6, 1200, 'Marketing agency'], ['Beta SEO', 4.9, 2310, 'Internet marketing service'], ['Gamma Web', null, 0, 'Website designer'],
    ]);
  });
  it('returns nothing for unrelated text', () => { expect(parseGoogleResults('hello\nworld')).toEqual([]); });
});

describe('searchTerms', () => {
  it('splits service and city', () => {
    expect(searchTerms('seo company in kolkata')).toMatchObject({ service: ['seo'], phrase: 'seo company', city: ['kolkata'] });
    expect(searchTerms('dentist near me', 'salt lake')).toMatchObject({ service: ['dentist'], city: ['salt lake'] });
  });
});

const page = (title, h1, extra = '') => `<html><head><title>${title}</title><meta name="viewport" content="width=device-width"></head><body><h1>${h1}</h1>${extra}</body></html>`;
const site = (html, ms = 600) => ({ ok: true, https: true, responseMs: ms, home: readPage(html, 'https://x.example/', searchTerms('seo company in kolkata')) });

describe('analyse', () => {
  const [, piloto, aswm] = parseGoogleResults(DESKTOP);
  const businesses = [
    { ...parseGoogleResults(DESKTOP)[0] },
    { ...piloto, site: site(page('Best SEO Company in Kolkata | Digital Piloto', 'SEO Company in Kolkata', '<a href="/seo-services">SEO services</a><a href="tel:07003941041">Call</a> kolkata kolkata kolkata kolkata <script type="application/ld+json">{"@type":"LocalBusiness"}</script>')) },
    { ...aswm, site: site(page('AS Webmarketings', 'Grow your brand')) },
  ];
  const r = analyse({ keyword: 'seo company in kolkata', businesses, mineIndex: 2 });

  it('compares only with organic businesses ranked above you', () => {
    expect(r.mine).toMatchObject({ rank: 2, name: 'AS Webmarketings - Digital Marketing' });
    expect(r.ads).toBe(1);
    expect(r.competitors.map((c) => c.name)).toEqual(['Digital Piloto Pvt. Ltd.']);
  });
  it('finds the review, Provides, hours and website gaps, high impact first', () => {
    const gaps = r.competitors[0].gaps;
    const keys = gaps.map((g) => g.key);
    expect(keys).toEqual(expect.arrayContaining(['reviews', 'provides', 'hours', 'serviceInTitle', 'cityInTitle', 'serviceInH1', 'servicePage', 'localSchema', 'cityMentions']));
    expect(gaps[0].impact).toBe('High');
    expect(gaps.find((g) => g.key === 'reviews')).toMatchObject({ impact: 'High', theirs: '104', yours: '31' });
    expect(gaps.find((g) => g.key === 'reviews').fix).toContain('78 more genuine reviews to pass Digital Piloto Pvt. Ltd. Ask');
  });
  it('credits what you do better and does not invent gaps', () => {
    const s = r.competitors[0].strengths.map((x) => x.key);
    expect(s).toContain('years');
    expect(s).not.toContain('rating'); // 4.9 vs 4.8 is treated as level
    expect(r.competitors[0].gaps.map((g) => g.key)).not.toContain('category');
  });
  it('warns about a name that carries extra keywords', () => {
    expect(r.warnings.map((w) => w.title)).toContain('Your business name may contain extra keywords');
  });
  it('builds one ranked action plan and a side-by-side matrix', () => {
    expect(r.plan[0].impact).toBe('High');
    expect(new Set(r.plan.map((p) => p.action)).size).toBe(r.plan.length);
    const reviews = r.matrix.find((m) => m.key === 'reviews');
    expect(reviews.cells.map((c) => c.state)).toEqual(['ahead', 'mine']) // the ad is left out; 104 is ahead of 31;
  });
  it('when you are first, compares with the businesses behind you', () => {
    const top = analyse({ keyword: 'seo company in kolkata', businesses, mineIndex: 1 });
    expect(top.comparingAbove).toBe(false);
    expect(top.competitors.map((c) => c.name)).toEqual(['AS Webmarketings - Digital Marketing']);
  });
});

describe('sites that block automated checks', () => {
  const [, piloto, aswm] = parseGoogleResults(DESKTOP);
  const terms = searchTerms('seo company in kolkata');
  const blocked = { ok: false, error: 'the site blocks automated visits (403)', manualHome: readPage('<title>Best SEO Company in Kolkata</title><h1>SEO Agency</h1>', 'https://manual.invalid/', terms, { partial: true }) };
  const r = analyse({ keyword: 'seo company in kolkata', mineIndex: 1, businesses: [
    { ...piloto, website: 'digitalpiloto.example', site: blocked },
    { ...aswm, website: 'aswm.example', site: { ...site(page('Website Design Company in Kolkata', 'Website Design Company in Kolkata')), service: { title: 'Best SEO Company in Kolkata', url: 'https://aswm.example/seo/', serviceInTitle: true } } },
  ] });
  const gaps = r.competitors[0].gaps;
  it('uses a hand-typed title and heading, and nothing else from that site', () => {
    expect(gaps.map((g) => g.key)).toEqual(expect.arrayContaining(['serviceInTitle', 'serviceInH1']));
    expect(gaps.map((g) => g.key)).not.toEqual(expect.arrayContaining(['localSchema']));
    expect(r.competitors[0].strengths.map((s) => s.key)).not.toContain('siteOk');
  });
  it('points to your existing service page instead of telling you to rewrite the home page', () => {
    expect(gaps.find((g) => g.key === 'serviceInTitle').fix).toContain('https://aswm.example/seo/');
  });
});

describe('report text', () => {
  it('keeps names that do not end in a full stop whole', () => {
    const [, , aswm] = parseGoogleResults(DESKTOP);
    const r = analyse({ keyword: 'seo company in kolkata', mineIndex: 1, businesses: [{ name: 'Anttech Digital Marketing Agency', rank: 1, rating: 4.9, reviews: 598 }, { ...aswm, rank: 2 }] });
    expect(r.competitors[0].gaps.find((g) => g.key === 'reviews').fix).toContain('to pass Anttech Digital Marketing Agency. Ask');
  });
});
