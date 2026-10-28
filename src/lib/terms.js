// Splits a search such as "seo company in kolkata" into the service words and the place words.
const STOP = new Set(['in', 'near', 'me', 'the', 'a', 'an', 'of', 'for', 'and', 'best', 'top', 'at', 'around', 'my', 'nearby', 'cheap', 'good']);
// Generic business nouns: they do not tell Google which service is meant.
const GENERIC = new Set(['company', 'companies', 'agency', 'agencies', 'services', 'service', 'firm', 'provider', 'providers', 'shop', 'store', 'centre', 'center', 'expert', 'experts', 'consultant', 'consultants']);

export function searchTerms(keyword, city = '') {
  const kw = String(keyword || '').toLowerCase().trim();
  let place = String(city || '').toLowerCase().trim();
  let servicePart = kw;
  const m = /^(.*?)\s+(?:in|near|at)\s+(.+)$/.exec(kw);
  if (m) { servicePart = m[1]; if (!place && m[2] !== 'me') place = m[2]; }
  if (place) servicePart = servicePart.replace(new RegExp(`\\b${place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), ' ');
  const words = servicePart.split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));
  const core = words.filter((w) => !GENERIC.has(w));
  return { keyword: kw, service: core.length ? core : words, phrase: words.join(' '), city: place ? [place] : [] };
}
