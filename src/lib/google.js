// Google APIs used by the automatic mode. One API key serves both:
//  - Places API (New) Text Search: the businesses Google lists for a search, in Google's order, with rating, reviews, category, hours and website.
//  - PageSpeed Insights: Lighthouse mobile performance and Core Web Vitals.
// Both have a free monthly allowance; Places needs a billing account on the Google Cloud project.

const FIELDS = ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'primaryType', 'primaryTypeDisplayName', 'types',
  'websiteUri', 'nationalPhoneNumber', 'internationalPhoneNumber', 'regularOpeningHours', 'businessStatus', 'reviews', 'editorialSummary', 'googleMapsUri'];

export class GoogleError extends Error {}

function explain(status, body) {
  const msg = body?.error?.message || '';
  if (status === 400 && /API key not valid/i.test(msg)) return 'The Google API key is not valid. Copy it again from Google Cloud → APIs & Services → Credentials.';
  if (status === 403 && /billing/i.test(msg)) return 'Places API needs a billing account on the Google Cloud project (the free monthly allowance still applies). Add billing, then try again.';
  if (status === 403) return `Google refused the request: ${msg || 'the API is not enabled for this key'}. Enable "Places API (New)" and "PageSpeed Insights API" for the project.`;
  if (status === 429) return 'Google quota reached for today. Try again tomorrow or raise the quota in Google Cloud.';
  return `Google answered ${status}${msg ? `: ${msg}` : ''}`;
}

async function call(url, init, timeoutMs) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new GoogleError(explain(res.status, body));
    return body;
  } catch (e) {
    if (e.name === 'AbortError') throw new GoogleError('Google did not answer in time. Try again.');
    throw e instanceof GoogleError ? e : new GoogleError(`Could not reach Google: ${e.message}`);
  } finally { clearTimeout(t); }
}

const DAY = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
/** Short opening-hours text: "Open 24 hours", or the usual hours plus closed days. */
export function hoursText(oh) {
  if (!oh) return '';
  const periods = oh.periods || [];
  if (periods.length === 1 && periods[0].open && !periods[0].close) return 'Open 24 hours';
  const desc = oh.weekdayDescriptions || [];
  if (desc.length && desc.every((d) => /open 24 hours/i.test(d))) return 'Open 24 hours';
  const openDays = new Set(periods.map((p) => p.open?.day));
  const closed = Object.keys(DAY).filter((d) => !openDays.has(Number(d))).map((d) => DAY[d]);
  const sample = desc.find((d) => !/closed/i.test(d));
  const times = sample ? sample.replace(/^[^:]+:\s*/, '').replace(/ | /g, ' ') : '';
  return [times, closed.length ? `closed ${closed.join(', ')}` : ''].filter(Boolean).join(' · ');
}

/** A Places result in the same shape as a business typed into the manual form. */
export function toBusiness(p, rank) {
  const reviews = p.reviews || [];
  const newest = reviews.map((r) => Date.parse(r.publishTime)).filter(Number.isFinite).sort((a, b) => b - a)[0];
  return {
    placeId: p.id, rank, name: p.displayName?.text || 'Unnamed', address: p.formattedAddress || '',
    lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null,
    rating: p.rating ?? null, reviews: p.userRatingCount ?? 0,
    category: p.primaryTypeDisplayName?.text || '', types: p.types || [],
    website: p.websiteUri || '', phone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
    hours: hoursText(p.regularOpeningHours), status: p.businessStatus || '',
    description: p.editorialSummary?.text || '', mapsUrl: p.googleMapsUri || '',
    lastReviewDays: newest ? Math.round((Date.now() - newest) / 86_400_000) : null,
    sampleReviews: reviews.slice(0, 5).map((r) => ({ rating: r.rating, when: r.relativePublishTimeDescription, text: (r.text?.text || '').slice(0, 280) })),
    profileWebsite: Boolean(p.websiteUri), sponsored: false, source: 'google_places',
  };
}

/** Businesses Google lists for a search, best first (up to 20). */
export async function searchPlaces(query, key) {
  if (!key) throw new GoogleError('No Google API key is set.');
  const body = await call('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS.map((f) => `places.${f}`).join(',') },
    body: JSON.stringify({ textQuery: query, pageSize: 20, languageCode: 'en' }),
  }, 20000);
  return (body?.places || []).filter((p) => p.businessStatus !== 'CLOSED_PERMANENTLY').map((p, i) => toBusiness(p, i + 1));
}

/** Lighthouse mobile performance for one URL. Returns null when the test cannot run, so the report can say so. */
export async function pageSpeed(url, key) {
  const q = new URLSearchParams({ url, strategy: 'mobile', category: 'performance' });
  if (key) q.set('key', key);
  try {
    const j = await call(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, {}, 90000);
    const a = j.lighthouseResult?.audits || {}; const field = j.loadingExperience?.metrics || {};
    return {
      score: Math.round((j.lighthouseResult?.categories?.performance?.score ?? NaN) * 100),
      lcpMs: a['largest-contentful-paint']?.numericValue ?? null,
      cls: a['cumulative-layout-shift']?.numericValue ?? null,
      tbtMs: a['total-blocking-time']?.numericValue ?? null,
      fieldLcpMs: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
      fieldCategory: j.loadingExperience?.overall_category || null,
    };
  } catch (e) { return { error: e.message }; }
}
