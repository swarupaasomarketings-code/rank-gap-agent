// Reads text copied from Google's local results ("Businesses" block or Maps list) into business rows.
// Copied text varies by browser and layout, so every field is optional and the user can correct it afterwards.

const NOISE = /^(website|directions|call|save|share|sponsored|ad|ads|businesses|places|more businesses|more places|open in maps|viewed just now|map data.*|terms|choose area|online appointments|open now|top rated|order|book online|reserve|menu|·)$/i;
const RATING = /^(\d(?:[.,]\d)?)\s*[★☆\s]*(?:\(([\d.,]+[kK]?)\))?\s*(?:·\s*(.*))?$/;
const REVIEWS_ONLY = /^\(([\d.,]+[kK]?)\)\s*(?:·\s*(.*))?$/;
const PHONE = /(?:\+?\d[\d\s-]{7,}\d)/;

const count = (s) => {
  if (!s) return null;
  const k = /k$/i.test(s); const n = Number(String(s).replace(/[kK,]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(k ? n * 1000 : n) : null;
};
const clean = (s) => String(s || '').replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();

function emptyBusiness(name, sponsored) {
  return { name, sponsored, rating: null, reviews: null, category: '', years: '', address: '', hours: '', phone: '', provides: '', website: '' };
}

/** Pulls the detail lines that follow a business name into its fields. */
function readDetail(b, line) {
  const parts = line.split(/\s+·\s+|^·\s*/).map(clean).filter(Boolean);
  for (const p of parts) {
    let m;
    if ((m = /^provides:\s*(.+)$/i.exec(p))) b.provides = m[1];
    else if ((m = /^(\d+\+?)\s+years? in business$/i.exec(p))) b.years = `${m[1]} years`;
    else if (/^(open|closed|opens|closes|open 24 hours|temporarily closed|permanently closed)\b/i.test(p)) b.hours = b.hours ? `${b.hours} · ${p}` : p;
    else if (PHONE.test(p) && p.replace(/\D/g, '').length >= 8 && p.replace(/[\d\s+()-]/g, '').length === 0) b.phone = p;
    else if (!b.category && /(service|agency|company|consultant|designer|marketing|store|shop|clinic|restaurant|hotel|dentist|school|office|centre|center|studio|contractor)$/i.test(p) && p.length < 60) b.category = p;
    else if (!b.address && /\d|road|rd\b|street|st\b|lane|nagar|building|floor|fl\b|sector|block|market|avenue|park/i.test(p) && p.length < 120) b.address = p;
  }
}

export function parseGoogleResults(text) {
  const lines = String(text || '').split(/\r?\n/).map(clean).filter(Boolean);
  const out = []; let cur = null; let sponsoredPending = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(sponsored|ad|ads)$/i.test(line)) { sponsoredPending = true; continue; }
    // A rating line, or a rating split over two lines ("4.8" then "(104) · Category"), marks the line before it as a business name.
    const next = lines[i + 1] || '';
    const r = RATING.exec(next);
    const splitReviews = r && !r[2] && REVIEWS_ONLY.exec(lines[i + 2] || '');
    const looksLikeName = !NOISE.test(line) && !RATING.test(line) && !REVIEWS_ONLY.test(line) && line.length <= 120 && !/^provides:/i.test(line);
    if (r && looksLikeName && (r[2] || splitReviews || r[3] || /[★☆]/.test(next))) {
      cur = emptyBusiness(line.replace(/\s*[⋮:]\s*$/, ''), sponsoredPending); sponsoredPending = false;
      cur.rating = Number(r[1].replace(',', '.'));
      cur.reviews = count(r[2] || splitReviews?.[1]);
      const tail = r[3] || splitReviews?.[2];
      if (tail) cur.category = clean(tail.split('·')[0]);
      out.push(cur);
      i += splitReviews ? 2 : 1;
      continue;
    }
    if (/^no reviews/i.test(next) && looksLikeName) { cur = emptyBusiness(line, sponsoredPending); sponsoredPending = false; cur.reviews = 0; out.push(cur); i += 1; continue; }
    if (cur && !NOISE.test(line)) readDetail(cur, line);
  }
  let rank = 0;
  for (const b of out) b.rank = b.sponsored ? null : ++rank;
  return out;
}
