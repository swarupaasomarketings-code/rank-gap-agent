import * as cheerio from 'cheerio';
import { safeFetch } from './safeFetch.js';
import { searchTerms } from './terms.js';

// Every service word must appear: "website development" is not matched by "website design".
const has = (text, words) => words.length > 0 && words.every((w) => text.includes(w));
const countOf = (text, word) => (word ? text.split(word).length - 1 : 0);

const BUSINESS_TYPE = /LocalBusiness|ProfessionalService|Store|Organization|Dentist|Restaurant|MedicalBusiness|HomeAndConstructionBusiness|Agency/i;
// Last 10 digits identify an Indian phone number however it is written (+91, 0, spaces, dashes).
export const phoneKey = (s) => { const d = String(s || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : null; };

function schemaTypes($) {
  const types = new Set(); let rating = null; let name = null; let locality = null; let phone = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const walk = (n) => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        const t = [].concat(n['@type'] || []).map(String);
        t.forEach((x) => types.add(x));
        if (n.aggregateRating?.ratingValue) rating = Number(n.aggregateRating.ratingValue);
        if (t.some((x) => BUSINESS_TYPE.test(x))) {
          if (!name && typeof n.name === 'string') name = n.name.trim();
          const addr = [].concat(n.address || [])[0];
          if (!locality && addr?.addressLocality) locality = String(addr.addressLocality).trim();
          if (!phone && n.telephone) phone = String(n.telephone);
        }
        if (n['@graph']) walk(n['@graph']);
      };
      walk(JSON.parse($(el).contents().text()));
    } catch { /* ignore broken JSON-LD */ }
  });
  return { types: [...types], rating, name, locality, phone };
}

/** Reads one HTML page into the signals the comparison uses. */
export function readPage(html, url, terms, { partial = false } = {}) {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim();
  const description = $('meta[name="description"]').attr('content')?.trim() || '';
  const h1 = $('h1').map((_, e) => $(e).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
  // Typed in by hand: only the title and heading are known, so nothing else is compared.
  if (partial) {
    const t = title.toLowerCase(); const h = h1.join(' ').toLowerCase();
    return { partial: true, url: null, title, h1, schemaTypes: [], serviceInTitle: title ? has(t, terms.service) : undefined, cityInTitle: title ? has(t, terms.city) : undefined, serviceInH1: h1.length ? has(h, terms.service) : undefined, cityInH1: h1.length ? has(h, terms.city) : undefined };
  }
  const robots = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  const { types, rating, name: schemaName, locality: schemaLocality, phone: schemaPhone } = schemaTypes($);
  const scripts = $('script[src]').length;
  const telLinks = $('a[href^="tel:"]').map((_, e) => $(e).attr('href')).get();
  $('script, style, noscript, svg').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim().toLowerCase();
  const lower = { title: title.toLowerCase(), description: description.toLowerCase(), h1: h1.join(' ').toLowerCase() };
  const origin = new URL(url).origin;
  const links = $('a[href]').map((_, e) => ({ href: $(e).attr('href'), text: $(e).text().replace(/\s+/g, ' ').trim().toLowerCase() })).get();
  const internal = links.map((l) => { try { return { ...l, abs: new URL(l.href, url) }; } catch { return null; } }).filter((l) => l && l.abs.origin === origin);
  const servicePage = internal.find((l) => has(l.text, terms.service) || has(l.abs.pathname.toLowerCase(), terms.service.map((w) => w.replace(/\s+/g, '-'))));
  const textPhones = text.match(/(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}\b|(?:\+?91[\s-]?|0)?33[\s-]?\d{4}[\s-]?\d{4}\b/g) || [];
  const externalHosts = links.map((l) => { try { return new URL(l.href, url).hostname; } catch { return ''; } });
  return {
    url, title, description, h1,
    titleLength: title.length, descriptionLength: description.length, h1Count: h1.length,
    canonical: $('link[rel="canonical"]').attr('href') || null,
    lang: $('html').attr('lang') || null,
    ogSiteName: $('meta[property="og:site_name"]').attr('content')?.trim() || null,
    schemaName, schemaLocality, schemaPhone,
    faqSchema: types.includes('FAQPage'),
    phones: [...new Set([...telLinks, ...textPhones, schemaPhone].map(phoneKey).filter(Boolean))],
    contactForm: $('form').filter((_, f) => $(f).find('textarea, input[type="email"], input[type="tel"]').length > 0).length > 0,
    whatsapp: externalHosts.some((h) => /(^|\.)wa\.me$|whatsapp\.com$/.test(h)),
    socialProfiles: new Set(externalHosts.filter((h) => /facebook\.com|instagram\.com|linkedin\.com|youtube\.com|twitter\.com|(^|\.)x\.com/.test(h)).map((h) => h.replace(/^www\./, ''))).size,
    imagesTotal: $('img').length, scripts,
    h2: $('h2').map((_, e) => $(e).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean).slice(0, 12),
    internalUrls: [...new Set(internal.map((l) => { const u = new URL(l.abs); u.hash = ''; return u.toString(); }))],
    wordCount: text ? text.split(' ').length : 0,
    serviceInTitle: has(lower.title, terms.service), cityInTitle: has(lower.title, terms.city),
    serviceInH1: has(lower.h1, terms.service), cityInH1: has(lower.h1, terms.city),
    serviceInDescription: has(lower.description, terms.service),
    cityMentions: terms.city.reduce((a, w) => a + countOf(text, w), 0),
    serviceMentions: terms.service.reduce((a, w) => a + countOf(text, w), 0),
    localSchema: types.some((t) => BUSINESS_TYPE.test(t)),
    schemaTypes: types, schemaRating: rating,
    phoneLink: telLinks.length > 0,
    mapEmbed: $('iframe[src*="google.com/maps"], iframe[src*="maps.google"]').length > 0,
    viewport: $('meta[name="viewport"]').length > 0,
    noindex: robots.includes('noindex'),
    blog: internal.some((l) => /\/blog|\/news|\/articles/i.test(l.abs.pathname) || /^blog$/.test(l.text)),
    testimonials: /testimonial|what our clients say|client reviews|google reviews/.test(text),
    imagesWithoutAlt: $('img:not([alt]), img[alt=""]').length,
    internalLinks: new Set(internal.map((l) => l.abs.pathname)).size,
    servicePageUrl: servicePage && servicePage.abs.pathname !== new URL(url).pathname ? servicePage.abs.toString() : null,
  };
}

async function fetchPage(url) {
  const t0 = Date.now();
  const res = await safeFetch(url, { timeoutMs: 15000 });
  const ms = Date.now() - t0;
  if ([401, 403, 429, 503].includes(res.status)) throw new Error(`the site blocks automated visits (${res.status}). Open it in your browser and type its page title and main heading under More details`);
  if (res.status >= 400) throw new Error(`the site answered ${res.status}`);
  if (!/html/i.test(res.contentType)) throw new Error('The page is not HTML');
  return { res, ms };
}

/** robots.txt rules for all crawlers ("*"), with the longest matching rule winning, as Google reads them. */
export function parseRobots(text) {
  const groups = []; let cur = null; let lastWasAgent = false; const sitemaps = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line); if (!m) continue;
    const k = m[1].toLowerCase(); const v = m[2].trim();
    if (k === 'sitemap') { sitemaps.push(v); continue; }
    if (k === 'user-agent') { if (!lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasAgent = true; continue; }
    lastWasAgent = false;
    if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push({ allow: k === 'allow', path: v });
  }
  const rules = groups.filter((g) => g.agents.includes('*')).flatMap((g) => g.rules).filter((r) => r.path);
  const allowed = (pathname) => {
    let best = null;
    for (const r of rules) {
      const re = new RegExp(`^${r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')}`);
      if (re.test(pathname) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
    }
    return !best || best.allow;
  };
  return { rules, sitemaps, allowed, disallowAll: !allowed('/') };
}

async function getText(url, timeoutMs = 12000) {
  try { const r = await safeFetch(url, { timeoutMs, maxBytes: 5_000_000 }); return r.status < 400 ? r.body : null; } catch { return null; }
}
const locs = (xml) => [...String(xml || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));

/** Reads the sitemap (following a sitemap index) and counts pages by kind. */
async function readSitemap(origin, robots, terms) {
  const candidates = [...new Set([...robots.sitemaps, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`])];
  let xml = null; let used = null;
  for (const c of candidates.slice(0, 5)) { xml = await getText(c); if (xml && /<(urlset|sitemapindex)/i.test(xml)) { used = c; break; } xml = null; }
  if (!xml) return { found: false };
  let urls = []; let posts = 0;
  if (/<sitemapindex/i.test(xml)) {
    // Posts, pages and services first; tag and author archives say little about the business.
    const children = locs(xml).filter((u) => !/tag|author|category|attachment|format/i.test(u)).slice(0, 10);
    const lists = await Promise.all(children.map(async (c) => ({ c, list: locs(await getText(c)) })));
    for (const { c, list } of lists) { urls.push(...list); if (/post-sitemap|posts?[-_.]|blog/i.test(c)) posts += list.length; }
  } else urls = locs(xml);
  urls = [...new Set(urls)].slice(0, 5000);
  const slug = (u) => { try { return decodeURIComponent(new URL(u).pathname.toLowerCase()); } catch { return ''; } };
  const blogUrls = urls.filter((u) => /\/(blog|news|articles?|insights)\/.+|\/20\d\d\/\d\d\//.test(slug(u)));
  return {
    found: true, url: used, urlCount: urls.length,
    blogCount: Math.max(posts, blogUrls.length),
    servicePages: urls.filter((u) => terms.service.length && terms.service.every((w) => slug(u).includes(w))).length,
    cityPages: urls.filter((u) => terms.city.some((c) => slug(u).includes(c.replace(/\s+/g, '-')))).length,
  };
}

const PAGE_HINT = /about|contact|service|seo|web|design|develop|market|pricing|price|package|portfolio|case|work|location|area/;
const NOT_PAGE = /\.(jpe?g|png|gif|webp|svg|pdf|zip|docx?|xlsx?|mp4|mp3|css|js|xml)$|\/(wp-admin|wp-login|cart|checkout|my-account|feed|tag|author)\b|\?/i;

async function mapLimit(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

/**
 * Checks a business website: robots.txt, sitemap, home page, the page that best matches the searched service and a few more.
 * deep: also reads more pages and checks internal links, for the full audit of your own site.
 */
export async function checkSite(rawUrl, keyword, city, { deep = false } = {}) {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const terms = searchTerms(keyword, city);
  const { res, ms } = await fetchPage(url);
  const origin = new URL(res.url).origin;
  const home = { ...readPage(res.body, res.url, terms), status: res.status, responseMs: ms };
  const robotsText = await getText(`${origin}/robots.txt`, 8000);
  const robots = parseRobots(robotsText);
  const sitemap = await readSitemap(origin, robots, terms);

  const seen = new Set([home.url]);
  const pick = home.internalUrls.filter((u) => !seen.has(u) && !NOT_PAGE.test(u) && robots.allowed(new URL(u).pathname));
  const ranked = [...(home.servicePageUrl ? [home.servicePageUrl] : []), ...pick.filter((u) => PAGE_HINT.test(new URL(u).pathname.toLowerCase())), ...pick];
  const toRead = [...new Set(ranked)].filter((u) => robots.allowed(new URL(u).pathname)).slice(0, deep ? 14 : 5);
  const pages = [home, ...(await mapLimit(toRead, 4, async (u) => {
    try { const p = await fetchPage(u); return { ...readPage(p.res.body, p.res.url, terms), status: p.res.status, responseMs: p.ms }; } catch (e) { return { url: u, error: e.message, status: Number(/\b(\d{3})\b/.exec(e.message)?.[1]) || null }; }
  }))];
  for (const p of pages) seen.add(p.url);
  const ok = pages.filter((p) => !p.error);
  const service = ok.find((p) => p.url === home.servicePageUrl) || ok.find((p) => p !== home && p.serviceInTitle) || null;

  // Internal links that answer with an error, checked on your own site only.
  let brokenLinks = []; let checkedLinks = 0;
  if (deep) {
    const linkFrom = new Map();
    for (const p of ok) for (const u of p.internalUrls || []) if (!seen.has(u) && !NOT_PAGE.test(u) && !linkFrom.has(u)) linkFrom.set(u, p.url);
    const sample = [...linkFrom.keys()].slice(0, 40); checkedLinks = sample.length + pages.length;
    const statuses = await mapLimit(sample, 6, async (u) => { try { return (await safeFetch(u, { method: 'HEAD', timeoutMs: 10000 })).status; } catch { return null; } });
    brokenLinks = [
      ...pages.filter((p) => p.error && p.status >= 400).map((p) => ({ url: p.url, status: p.status, from: home.url })),
      ...sample.map((u, k) => ({ url: u, status: statuses[k], from: linkFrom.get(u) })).filter((l) => l.status >= 400 && l.status !== 405 && l.status !== 403),
    ];
  }
  return { ok: true, finalUrl: res.url, https: res.url.startsWith('https://'), responseMs: ms, htmlKb: Math.round(res.bytes / 1024), home, service, pages, robots: { found: robotsText != null, disallowAll: robots.disallowAll, sitemaps: robots.sitemaps }, sitemap, brokenLinks, checkedLinks };
}
