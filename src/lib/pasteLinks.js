// When Google results are copied in a browser, the clipboard also holds HTML with each listing's "Website" link.
// This finds those links and gives each one to the business listed just before it.

const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const norm = (s) => decode(s).toLowerCase().replace(/\s+/g, ' ').trim();

/** Google often wraps links as /url?q=… or /url?url=…; returns the real address, or null for Google's own pages. */
export function realUrl(href) {
  let u;
  try { u = new URL(decode(href), 'https://www.google.com'); } catch { return null; }
  if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === '/url') {
    const target = u.searchParams.get('url') || u.searchParams.get('q');
    return target ? realUrl(target) : null;
  }
  if (!/^https?:$/.test(u.protocol) || /(^|\.)(google|gstatic|googleusercontent|youtube)\.[a-z.]+$/.test(u.hostname)) return null;
  return u.toString();
}

/** @returns {Map<string, string>} business name → website, for the names given. */
export function websitesFromHtml(html, names) {
  const text = []; const links = []; let len = 0;
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>|<(script|style)\b[\s\S]*?<\/\3>|<[^>]+>|([^<]+)/gi;
  for (const m of String(html || '').matchAll(re)) {
    if (m[4]) { const t = decode(m[4]); text.push(t); len += t.length; continue; }
    if (m[1] === undefined) { text.push(' '); len += 1; continue; }
    const inner = decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const href = /\bhref\s*=\s*"([^"]*)"|\bhref\s*=\s*'([^']*)'/i.exec(m[1]);
    const label = /\baria-label\s*=\s*"([^"]*)"/i.exec(m[1])?.[1] || '';
    if (href && (/^website$/i.test(inner) || /^website\b/i.test(label))) links.push({ at: len, url: realUrl(href[1] || href[2]) });
    text.push(` ${inner} `); len += inner.length + 2;
  }
  const all = norm(text.join(''));
  // Positions are taken in the normalised text, so recompute link positions the same way.
  const raw = text.join(''); const shift = (at) => norm(raw.slice(0, at)).length;
  const starts = []; let from = 0;
  for (const n of names) {
    const at = all.indexOf(norm(n), from);
    starts.push(at); if (at >= 0) from = at + 1;
  }
  const out = new Map();
  for (const l of links) {
    if (!l.url) continue;
    const pos = shift(l.at);
    let owner = -1;
    starts.forEach((s, i) => { if (s >= 0 && s <= pos && (owner < 0 || s > starts[owner])) owner = i; });
    if (owner >= 0 && !out.has(names[owner])) out.set(names[owner], l.url);
  }
  return out;
}
