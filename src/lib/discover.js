import { safeFetch } from './safeFetch.js';
import { readPage } from './siteCheck.js';

// From your website alone: business name, city, phone numbers and the searches the site is built for.

const FILLER = /\b(best|top|leading|trusted|affordable|cheap|professional|expert|experts|award winning|no\.?\s?1|#1|number one|since \d{4}|\d+\+? years?|india'?s?)\b/g;
const SERVICE_NOUN = /\b(company|agency|services?|consultants?|firm|studio|clinic|experts?)\b/;

const clean = (s) => String(s || '').toLowerCase().replace(/&amp;/g, '&').replace(FILLER, ' ').replace(/[^a-z0-9& ]+/g, ' ').replace(/\be commerce\b/g, 'ecommerce').replace(/\s+/g, ' ').trim();

/** Turns a title piece or URL slug into a search such as "seo company in kolkata", or null. */
export function toSearch(text, city) {
  let s = clean(text);
  if (!s || s.split(' ').length > 8) return null;
  if (/^(service areas?|areas? (we )?serve|locations?|contact|about|home|blog|our |careers?|privacy|terms|sitemap)/.test(s)) return null; // site navigation, not a search
  if (city) {
    const c = city.toLowerCase();
    if (!s.includes(c)) return null; // a search without the city is not a local search for this business
    s = s.replace(new RegExp(`\\s*(?:in\\s+)?${c}\\b.*$`), '').trim();
    if (!s || s.split(' ').length < 1) return null;
    return `${s} in ${c}`;
  }
  return SERVICE_NOUN.test(s) ? s : null;
}

function guessCity(home, slugs) {
  if (home.schemaLocality) return home.schemaLocality.toLowerCase();
  const m = /\bin\s+([A-Z][a-zA-Z]+)\b/.exec(`${home.title} ${home.h1.join(' ')}`);
  if (m) return m[1].toLowerCase();
  // The last slug word that repeats most often is usually the city ("...-kolkata").
  const counts = new Map();
  for (const s of slugs) { const w = s.split('-').pop(); if (w && w.length > 3) counts.set(w, (counts.get(w) || 0) + 1); }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best && best[1] >= 3 ? best[0] : '';
}

function guessName(home, host) {
  if (home.schemaName) return home.schemaName;
  if (home.ogSiteName) return home.ogSiteName;
  const parts = home.title.split(/\s[|–-]\s/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) return parts[parts.length - 1];
  return host.replace(/^www\./, '').split('.')[0];
}

export async function scanOwnSite(rawUrl) {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const res = await safeFetch(url, { timeoutMs: 15000 });
  if ([401, 403, 429, 503].includes(res.status)) throw new Error(`Your website blocks automated visits (${res.status}). Allow normal visitors and crawlers, or use the manual mode.`);
  if (res.status >= 400) throw new Error(`Your website answered ${res.status}`);
  const host = new URL(res.url).hostname;
  const home = readPage(res.body, res.url, { service: [], city: [], phrase: '' });
  const slugs = home.internalUrls.map((u) => { try { return decodeURIComponent(new URL(u).pathname).replace(/^\/|\/$/g, '').toLowerCase(); } catch { return ''; } }).filter((s) => s && !s.includes('/'));
  const city = guessCity(home, slugs);

  // Title and heading count most, then the site's own page addresses.
  const scored = new Map();
  const add = (q, w) => { if (q) scored.set(q, (scored.get(q) || 0) + w); };
  for (const part of home.title.split(/\s[|–:-]\s/)) add(toSearch(part, city), 3);
  for (const h of home.h1) add(toSearch(h.replace(/[–—-].*$/, ''), city), 2);
  for (const s of slugs) add(toSearch(s.replace(/-/g, ' '), city), 1);
  // Ties go to the shorter search: it is broader and searched more often.
  const keywords = [...scored.entries()].sort((a, b) => b[1] - a[1] || a[0].split(' ').length - b[0].split(' ').length).map(([q]) => q).slice(0, 8);

  return { website: res.url, host, name: guessName(home, host), city, phones: home.phones, keywords, title: home.title };
}
