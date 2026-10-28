// Serper.dev: Google Maps results through an API (sign-up with email, no card for the free credits).
// Returns businesses in the same shape as the Google Places adapter, so the rest of the app does not care which one ran.
import { GoogleError } from './google.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Serper gives hours as { Monday: "9 am–7 pm", ... }; returns "Open 24 hours" or the usual hours plus closed days. */
export function serperHours(oh) {
  if (!oh) return '';
  if (typeof oh === 'string') return oh;
  const vals = DAYS.map((d) => oh[d] ?? oh[d.toLowerCase()]).filter((v) => v != null).map(String);
  if (!vals.length) return '';
  if (vals.every((v) => /24 hours/i.test(v))) return 'Open 24 hours';
  const closed = DAYS.filter((d) => /closed/i.test(String(oh[d] ?? oh[d.toLowerCase()] ?? ''))).map((d) => d.slice(0, 3));
  const sample = vals.find((v) => !/closed/i.test(v)) || '';
  return [sample.replace(/ | /g, ' '), closed.length ? `closed ${closed.join(', ')}` : ''].filter(Boolean).join(' · ');
}

export function fromSerper(p, i) {
  const website = p.website || p.link || '';
  return {
    placeId: p.placeId || p.cid || null, rank: Number(p.position) || i + 1, name: p.title || 'Unnamed', address: p.address || '',
    lat: p.latitude ?? null, lng: p.longitude ?? null,
    rating: p.rating ?? null, reviews: p.ratingCount ?? p.reviews ?? p.reviewsCount ?? 0,
    category: p.type || (p.types || [])[0] || p.category || '', types: p.types || [],
    website, phone: p.phoneNumber || p.phone || '', hours: serperHours(p.openingHours), description: p.description || '',
    mapsUrl: p.cid ? `https://maps.google.com/?cid=${p.cid}` : '', lastReviewDays: null, sampleReviews: [],
    profileWebsite: Boolean(website), sponsored: false, source: 'serper',
  };
}

function explain(status, body) {
  const msg = body?.message || body?.error || '';
  if (status === 401 || status === 403) return 'The Serper API key is not valid. Copy it again from serper.dev → API Key.';
  if (status === 400 && /credit/i.test(msg)) return 'Serper credits are used up. Add credits at serper.dev, or use a Google key or the paste option.';
  if (status === 429) return 'Serper is rate-limiting requests. Wait a minute and try again.';
  return `Serper answered ${status}${msg ? `: ${msg}` : ''}`;
}

/** Businesses Google Maps lists for a search, best first. */
export async function searchSerper(query, key, { gl = process.env.SERPER_GL || 'in' } = {}) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch('https://google.serper.dev/maps', { method: 'POST', signal: ctrl.signal, headers: { 'X-API-KEY': key, 'content-type': 'application/json' }, body: JSON.stringify({ q: query, gl, hl: 'en' }) });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new GoogleError(explain(res.status, body));
    return (body?.places || []).map(fromSerper).sort((a, b) => a.rank - b.rank).map((b, i) => ({ ...b, rank: i + 1 }));
  } catch (e) {
    if (e.name === 'AbortError') throw new GoogleError('Serper did not answer in time. Try again.');
    throw e instanceof GoogleError ? e : new GoogleError(`Could not reach Serper: ${e.message}`);
  } finally { clearTimeout(t); }
}

/** Which service a key belongs to: Google keys start with "AIza"; anything else is treated as Serper. */
export const keyKind = (key) => (!key ? null : /^AIza[\w-]{20,}$/.test(key.trim()) ? 'google' : 'serper');
