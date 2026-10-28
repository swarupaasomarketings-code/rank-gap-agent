import { describe, it, expect } from 'vitest';
import { toBusiness, hoursText } from '../../src/lib/google.js';
import { parseRobots, readPage } from '../../src/lib/siteCheck.js';
import { toSearch } from '../../src/lib/discover.js';
import { auditSite } from '../../src/lib/audit.js';
import { analyse } from '../../src/lib/engine.js';
import { searchTerms } from '../../src/lib/terms.js';

// Shaped like a Places API (New) Text Search result (fixture, not a live call).
const PLACE = {
  id: 'p1', displayName: { text: 'Digital Piloto Pvt. Ltd.' }, formattedAddress: 'Ranikuthi, Kolkata', location: { latitude: 22.49, longitude: 88.35 },
  rating: 4.8, userRatingCount: 104, primaryTypeDisplayName: { text: 'Internet marketing service' }, types: ['internet_marketing_service'],
  websiteUri: 'https://www.digitalpiloto.com/', nationalPhoneNumber: '070039 41041',
  regularOpeningHours: { periods: [{ open: { day: 0, hour: 0, minute: 0 } }], weekdayDescriptions: ['Monday: Open 24 hours'] },
  reviews: [{ rating: 5, publishTime: new Date(Date.now() - 3 * 86_400_000).toISOString(), relativePublishTimeDescription: '3 days ago', text: { text: 'Great work' } }],
  googleMapsUri: 'https://maps.google.com/?cid=1',
};

describe('Google Places data', () => {
  it('becomes the same business shape the comparison uses', () => {
    const b = toBusiness(PLACE, 1);
    expect(b).toMatchObject({ rank: 1, name: 'Digital Piloto Pvt. Ltd.', rating: 4.8, reviews: 104, category: 'Internet marketing service', hours: 'Open 24 hours', website: 'https://www.digitalpiloto.com/', lastReviewDays: 3, profileWebsite: true, source: 'google_places' });
  });
  it('summarises opening hours', () => {
    const week = [1, 2, 3, 4, 5, 6].map((d) => ({ open: { day: d, hour: 10 }, close: { day: d, hour: 19 } }));
    expect(hoursText({ periods: week, weekdayDescriptions: ['Monday: 10:00 AM – 7:00 PM', 'Sunday: Closed'] })).toBe('10:00 AM – 7:00 PM · closed Sun');
    expect(hoursText(null)).toBe('');
  });
});

describe('robots.txt', () => {
  const r = parseRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\nDisallow: /*?s=\nSitemap: https://x.example/sitemap_index.xml');
  it('applies the rules for every crawler, longest match winning', () => {
    expect(r.allowed('/services/seo/')).toBe(true);
    expect(r.allowed('/wp-admin/options.php')).toBe(false);
    expect(r.allowed('/wp-admin/admin-ajax.php')).toBe(true);
    expect(r.allowed('/page?s=test')).toBe(false);
    expect(r.disallowAll).toBe(false);
    expect(r.sitemaps).toEqual(['https://x.example/sitemap_index.xml']);
  });
  it('spots a site that blocks everything', () => { expect(parseRobots('User-agent: *\nDisallow: /').disallowAll).toBe(true); });
});

describe('searches found on your website', () => {
  it('turns titles and page addresses into local searches', () => {
    expect(toSearch('Best SEO Company in Kolkata', 'kolkata')).toBe('seo company in kolkata');
    expect(toSearch('website design company kolkata', 'kolkata')).toBe('website design company in kolkata');
    expect(toSearch('e commerce website development kolkata', 'kolkata')).toBe('ecommerce website development in kolkata');
  });
  it('skips navigation pages and pages without the city', () => {
    expect(toSearch('service areas kolkata', 'kolkata')).toBeNull();
    expect(toSearch('About us', 'kolkata')).toBeNull();
  });
});

const terms = searchTerms('seo company in kolkata');
const page = (html, url = 'https://me.example/') => ({ ...readPage(`<html><head>${html.head || ''}</head><body>${html.body || ''}</body></html>`, url, terms), status: 200 });

describe('website audit', () => {
  const home = page({ head: '<title>Me | Web Design</title><meta name="viewport" content="width=device-width">', body: '<h1>Web design</h1><img src="a.jpg"><a href="tel:+918972969179">Call</a>' });
  const svc = page({ head: '<title>Me | Web Design</title>', body: '<p>short</p>' }, 'https://me.example/seo-services/');
  const site = { ok: true, https: true, finalUrl: 'https://me.example/', responseMs: 400, htmlKb: 80, home, service: null, pages: [home, svc], robots: { found: true, disallowAll: false, sitemaps: [] }, sitemap: { found: false }, brokenLinks: [{ url: 'https://me.example/old/', status: 404 }], checkedLinks: 20, speed: { score: 42, lcpMs: 5200, cls: 0.02 } };
  const issues = auditSite(site, { business: { phone: '033 4000 1234' }, terms });
  const titles = issues.map((i) => i.title);
  it('finds the problems, most serious first', () => {
    expect(titles).toEqual(expect.arrayContaining(['1 broken internal link', 'Mobile performance score 42/100', 'Main content appears after 5.2 s on mobile', '2 pages share a title with another page',
      '2 pages have no meta description', '1 page has no H1 heading', 'No XML sitemap found', 'No page title mentions "seo company"', 'Phone on Google differs from the website', 'No LocalBusiness schema']));
    expect(issues[0].severity).toBe('High');
    expect(issues.at(-1).severity).toBe('Low');
  });
  it('says where each problem is', () => {
    expect(issues.find((i) => i.title === '1 page has no H1 heading').urls).toEqual(['/seo-services/']);
  });
  it('reports a site that could not be read', () => {
    expect(auditSite({ ok: false, error: 'the site answered 500' })[0]).toMatchObject({ severity: 'Critical', detail: 'the site answered 500' });
  });
});

describe('whole-site comparison', () => {
  const mk = (name, rank, sitemap, speed, extra = {}) => ({ name, rank, rating: 4.8, reviews: 50, website: `${name}.example`, source: 'google_places', profileWebsite: true, ...extra,
    site: { ok: true, https: true, responseMs: 500, home: page({ head: `<title>${name}</title>` }), pages: [], sitemap: { found: true, ...sitemap }, speed } });
  const r = analyse({ keyword: 'seo company in kolkata', mineIndex: 0, businesses: [
    mk('me', 3, { urlCount: 40, blogCount: 2, servicePages: 1, cityPages: 2 }, { score: 38, lcpMs: 6000 }, { lastReviewDays: 90 }),
    mk('rival', 1, { urlCount: 300, blogCount: 140, servicePages: 9, cityPages: 40 }, { score: 81, lcpMs: 2100 }, { lastReviewDays: 2 }),
  ] });
  it('counts blog posts, service pages, city pages, speed and review recency', () => {
    const g = Object.fromEntries(r.competitors[0].gaps.map((x) => [x.key, x]));
    expect(Object.keys(g)).toEqual(expect.arrayContaining(['blog', 'servicePages', 'cityPages', 'pages', 'psi', 'lcp', 'lastReview']));
    expect(g.psi).toMatchObject({ impact: 'High', theirs: '81/100', yours: '38/100' });
    expect(g.blog.why).toContain('about 140 blog posts, you have 2');
  });
});

import { fromSerper, serperHours, keyKind } from '../../src/lib/serper.js';
import { auditProfile } from '../../src/lib/audit.js';

describe('Serper data', () => {
  it('becomes the same business shape', () => {
    expect(fromSerper({ position: 2, title: 'Digital Piloto Pvt. Ltd.', rating: 4.8, ratingCount: 104, type: 'Internet marketing service', website: 'https://digitalpiloto.com/', phoneNumber: '070039 41041', openingHours: { Monday: 'Open 24 hours' }, cid: '99' }, 0))
      .toMatchObject({ rank: 2, name: 'Digital Piloto Pvt. Ltd.', reviews: 104, category: 'Internet marketing service', hours: 'Open 24 hours', phone: '070039 41041', mapsUrl: 'https://maps.google.com/?cid=99', profileWebsite: true, source: 'serper' });
  });
  it('summarises hours', () => {
    expect(serperHours({ Monday: '10 am–7 pm', Tuesday: '10 am–7 pm', Sunday: 'Closed' })).toBe('10 am–7 pm · closed Sun');
    expect(serperHours(undefined)).toBe('');
  });
  it('tells Google keys from Serper keys', () => {
    expect(keyKind('AIzaSyD-abcdefghijklmnopqrstuvwxyz12345')).toBe('google');
    expect(keyKind('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')).toBe('serper');
    expect(keyKind('')).toBeNull();
  });
});

describe('Google profile audit', () => {
  const t = searchTerms('seo company in kolkata');
  const rivals = [{ reviews: 104, rating: 4.8, category: 'SEO agency' }, { reviews: 598, rating: 4.9, category: 'Internet marketing service' }];
  it('compares your listing with the competitors', () => {
    const titles = auditProfile({ rank: 4, reviews: 31, rating: 4.4, category: 'Website designer', hours: '', website: 'https://me.example', phone: '' }, rivals, { terms: t, found: true }).map((i) => i.title);
    expect(titles).toEqual(['#4 for "seo company in kolkata", outside the top 3', 'Only 31 reviews; competitors average 351', 'Rating 4.4; competitors average 4.8',
      'No opening hours on the profile', 'No phone number on the profile', 'Primary category "Website designer" does not match the search']);
  });
  it('says so when the profile is not found', () => {
    expect(auditProfile({}, rivals, { terms: t, found: false })[0]).toMatchObject({ severity: 'Critical', title: 'Your Google Business Profile was not found' });
  });
});
