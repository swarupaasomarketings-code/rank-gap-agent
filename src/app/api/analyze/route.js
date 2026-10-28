import { checkSite, readPage } from '@/lib/siteCheck';
import { analyse } from '@/lib/engine';
import { searchTerms } from '@/lib/terms';

const escape = (s) => String(s || '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

export const runtime = 'nodejs';
export const maxDuration = 60;

const str = (v, max = 300) => String(v ?? '').slice(0, max).trim();
const numOrNull = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const bad = (message) => Response.json({ error: message }, { status: 400 });

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return bad('Send JSON'); }
  const keyword = str(body.keyword, 120);
  if (!keyword) return bad('Enter the search keyword');
  if (!Array.isArray(body.businesses) || body.businesses.length < 2) return bad('Add your business and at least one competitor');
  if (body.businesses.length > 12) return bad('Compare at most 12 businesses at a time');
  const mineIndex = Number(body.mineIndex);
  if (!Number.isInteger(mineIndex) || !body.businesses[mineIndex]) return bad('Choose which business is yours');

  const businesses = body.businesses.map((b) => ({
    name: str(b.name, 160) || 'Unnamed business', sponsored: Boolean(b.sponsored), rank: numOrNull(b.rank),
    rating: numOrNull(b.rating), reviews: numOrNull(b.reviews), reviews90: numOrNull(b.reviews90), photos: numOrNull(b.photos), distanceKm: numOrNull(b.distanceKm),
    category: str(b.category, 120), years: str(b.years, 40), address: str(b.address, 200), hours: str(b.hours, 120), phone: str(b.phone, 40), provides: str(b.provides, 200),
    website: str(b.website, 500), manualTitle: str(b.manualTitle, 300), manualH1: str(b.manualH1, 300),
  }));
  const terms = searchTerms(keyword, body.city);

  // Sponsored listings are ads: their position is bought, so their websites are not worth checking.
  await Promise.all(businesses.map(async (b) => {
    if (!b.website || b.sponsored) return;
    try { b.site = await checkSite(b.website, keyword, body.city); } catch (e) { b.site = { ok: false, error: e?.name === 'AbortError' ? 'timed out after 15 s' : e.message || 'failed to load' }; }
    if (!b.site.ok && (b.manualTitle || b.manualH1)) b.site.manualHome = readPage(`<title>${escape(b.manualTitle)}</title><h1>${escape(b.manualH1)}</h1>`, 'https://manual.invalid/', terms, { partial: true });
  }));

  try {
    return Response.json(analyse({ keyword, city: str(body.city, 80), businesses, mineIndex }));
  } catch (e) {
    return bad(e.message);
  }
}
