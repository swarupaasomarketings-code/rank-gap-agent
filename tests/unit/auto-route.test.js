import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Websites are not fetched here: checkSite returns a small fixture per domain.
vi.mock('../../src/lib/siteCheck.js', async (orig) => {
  const real = await orig();
  const { searchTerms } = await import('../../src/lib/terms.js');
  return {
    ...real,
    checkSite: vi.fn(async (url, keyword) => {
      const host = new URL(url).hostname.replace(/^www\./, '');
      const home = real.readPage(`<title>${host.startsWith('me') ? 'Web Design Kolkata' : 'SEO Company in Kolkata'}</title><h1>x</h1>`, `https://${host}/`, searchTerms(keyword));
      return { ok: true, https: true, finalUrl: `https://${host}/`, responseMs: 300, htmlKb: 50, home, service: null, pages: [home], robots: { found: true, disallowAll: false, sitemaps: [] }, sitemap: { found: true, urlCount: host.startsWith('me') ? 20 : 200, blogCount: 0, servicePages: 0, cityPages: 0 }, brokenLinks: [], checkedLinks: 1 };
    }),
  };
});
const { POST } = await import('../../src/app/api/auto/route.js');

// Places API (New) answers (fixtures, not live calls).
const place = (i, over = {}) => ({ id: `p${i}`, displayName: { text: `Rival ${i}` }, rating: 4.8, userRatingCount: 100 + i, primaryTypeDisplayName: { text: 'Internet marketing service' }, websiteUri: `https://rival${i}.example/`, nationalPhoneNumber: `0700390000${i}`, ...over });
let placesCalls;
function mockGoogle(firstSearch, ownSearch = []) {
  placesCalls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    if (String(url).includes('places:searchText')) {
      const q = JSON.parse(init.body).textQuery; placesCalls.push(q);
      return Response.json({ places: placesCalls.length === 1 ? firstSearch : ownSearch });
    }
    if (String(url).includes('pagespeedonline')) return Response.json({ lighthouseResult: { categories: { performance: { score: 0.55 } }, audits: { 'largest-contentful-paint': { numericValue: 3100 } } } });
    throw new Error(`unexpected fetch ${url}`);
  }));
}
async function run(body) {
  const res = await POST(new Request('http://localhost/api/auto', { method: 'POST', body: JSON.stringify({ apiKey: 'AIzaTESTKEYTESTKEYTESTKEY123', website: 'https://www.me.example', keyword: 'seo company in kolkata', city: 'kolkata', name: 'Me Agency', phones: ['8972969179'], ...body }) }));
  const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
  return { lines, report: lines.find((l) => l.type === 'report')?.data, error: lines.find((l) => l.type === 'error')?.message };
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('/api/auto', () => {
  it('recognises your listing by website, compares the top 5 others and audits your site', async () => {
    mockGoogle([place(1), place(2), { ...place(3), displayName: { text: 'AS Me Agency Pvt' }, websiteUri: 'https://me.example/', userRatingCount: 31 }, place(4), place(5), place(6), place(7)]);
    const { report, lines } = await run({});
    expect(lines.filter((l) => l.type === 'progress').map((l) => l.text)[1]).toBe('Found 7 businesses. You are #3.');
    expect(report.mine).toMatchObject({ rank: 3, name: 'AS Me Agency Pvt' });
    expect(report.competitors.map((c) => c.name)).toEqual(['Rival 1', 'Rival 2', 'Rival 4', 'Rival 5']); // above you first, then the rest of the top 4
    expect(report.businesses).toHaveLength(5); // you plus 4 competitors in the side-by-side table
    expect(report.ranking.find((r) => r.mine).rank).toBe(3);
    expect(report.ranking.filter((r) => r.compared)).toHaveLength(4);
    expect(report.competitors[0].gaps.map((g) => g.key)).toEqual(expect.arrayContaining(['reviews', 'serviceInTitle', 'pages']));
    expect(report.audit.map((i) => i.title)).toContain('No page title mentions "seo company"');
    expect(report.site.speed).toMatchObject({ score: 55 });
  });
  it('recognises your listing by phone when the profile has no website', async () => {
    mockGoogle([place(1), { ...place(2), displayName: { text: 'Different Name' }, websiteUri: undefined, nationalPhoneNumber: '+91 89729 69179' }]);
    const { report } = await run({});
    expect(report.mine).toMatchObject({ rank: 2, name: 'Different Name' });
    expect(report.competitors[0].gaps.map((g) => g.key)).toContain('profileWebsite');
  });
  it('looks up your own listing when you are not in the results', async () => {
    mockGoogle([place(1), place(2), place(3)], [{ ...place(9), displayName: { text: 'Me Agency' }, websiteUri: 'https://me.example/' }]);
    const { report } = await run({});
    expect(placesCalls).toEqual(['seo company in kolkata', 'Me Agency kolkata']);
    expect(report.mine.rank).toBeNull();
    expect(report.totalResults).toBe(3);
    expect(report.competitors).toHaveLength(3);
  });
  it('without a key, audits your website only and says why', async () => {
    mockGoogle([]);
    const { report } = await run({ apiKey: '' });
    expect(placesCalls).toEqual([]);
    expect(report.competitors).toEqual([]);
    expect(report.notes[0]).toContain('No competitors were compared: add a Serper or Google key');
    expect(report.audit.length).toBeGreaterThan(0);
  });
  it('passes Google errors on in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'This API requires billing to be enabled' } }, { status: 403 })));
    const { error } = await run({});
    expect(error).toContain('billing account');
  });
});

// Serper Maps answers (fixtures, not live calls).
const sp = (i, over = {}) => ({ position: i, title: `Rival ${i}`, rating: 4.7, ratingCount: 80 + i, type: 'Internet marketing service', website: `https://rival${i}.example/`, phoneNumber: `070039 0000${i}`, openingHours: { Monday: 'Open 24 hours', Tuesday: 'Open 24 hours' }, cid: `${i}`, ...over });
function mockSerper(places) {
  placesCalls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    if (String(url) === 'https://google.serper.dev/maps') { placesCalls.push({ q: JSON.parse(init.body).q, key: init.headers['X-API-KEY'] }); return Response.json({ places }); }
    throw new Error(`unexpected fetch ${url}`);
  }));
}

describe('/api/auto with a Serper key', () => {
  it('searches Google Maps through Serper and compares 4 competitors, without PageSpeed', async () => {
    mockSerper([sp(1), sp(2), { ...sp(3), title: 'Me Agency', website: 'https://me.example/', ratingCount: 31, openingHours: { Monday: '10 am–7 pm', Sunday: 'Closed' } }, sp(4), sp(5), sp(6)]);
    const { report } = await run({ apiKey: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' });
    expect(placesCalls).toEqual([{ q: 'seo company in kolkata', key: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' }]);
    expect(report.source).toBe('Google Maps (Serper)');
    expect(report.mine).toMatchObject({ rank: 3, name: 'Me Agency' });
    expect(report.competitors.map((c) => c.name)).toEqual(['Rival 1', 'Rival 2', 'Rival 4', 'Rival 5']);
    expect(report.competitors[0].gaps.map((g) => g.key)).toEqual(expect.arrayContaining(['reviews', 'hours']));
    expect(report.notes.join(' ')).toContain('Google API key adds the Google PageSpeed score');
    expect(report.profileAudit.map((i) => i.title)).toContain('Only 31 reviews; competitors average 83');
  });
  it('passes a bad Serper key on in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'Unauthorized' }, { status: 403 })));
    const { error } = await run({ apiKey: 'nope-not-a-real-key' });
    expect(error).toContain('Serper API key is not valid');
  });
});

describe('/api/auto with pasted Google results', () => {
  it('uses the pasted list, leaves ads out, and marks only the compared businesses', async () => {
    mockGoogle([]);
    const businesses = [
      { name: 'Ad Co', sponsored: true, rating: 4.7, reviews: 27, website: 'https://ad.example/' },
      { name: 'Digital Piloto Pvt. Ltd.', rating: 4.8, reviews: 104, hours: 'Open 24 hours', provides: 'Best SEO Company India', website: 'https://www.digitalpiloto.example/' },
      { name: 'Anttech', rating: 4.9, reviews: 598, website: '' },
      { name: 'Me Agency - Digital Marketing', rating: 4.9, reviews: 31, phone: '089729 69179', hours: 'Open · Closes 11:30 pm' },
    ];
    const { report } = await run({ apiKey: '', businesses });
    expect(placesCalls).toEqual([]);
    expect(report.source).toBe('Pasted Google results');
    expect(report.mine).toMatchObject({ rank: 3, name: 'Me Agency - Digital Marketing' });
    expect(report.competitors.map((c) => c.name)).toEqual(['Digital Piloto Pvt. Ltd.', 'Anttech']);
    expect(report.ranking.map((r) => [r.name, r.compared, r.mine])).toEqual([['Digital Piloto Pvt. Ltd.', true, false], ['Anttech', true, false], ['Me Agency - Digital Marketing', false, true]]);
    expect(report.competitors[0].gaps.map((g) => g.key)).toEqual(expect.arrayContaining(['provides', 'hours']));
  });
});
