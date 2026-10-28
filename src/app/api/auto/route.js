import { checkSite, phoneKey } from '@/lib/siteCheck';
import { searchPlaces, pageSpeed, GoogleError } from '@/lib/google';
import { searchSerper, keyKind } from '@/lib/serper';
import { analyse } from '@/lib/engine';
import { auditSite, auditProfile } from '@/lib/audit';
import { searchTerms } from '@/lib/terms';

export const runtime = 'nodejs';
export const maxDuration = 300;

const COMPETITORS = 4;
const hostOf = (u) => { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const str = (v, max) => String(v ?? '').slice(0, max).trim();
const numOrNull = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
// A business read from pasted Google results, in the same shape as a search result.
const fromPaste = (b) => ({ name: str(b.name, 160) || 'Unnamed', sponsored: Boolean(b.sponsored), rating: numOrNull(b.rating), reviews: numOrNull(b.reviews), category: str(b.category, 120),
  hours: str(b.hours, 120), provides: str(b.provides, 200), years: str(b.years, 40), address: str(b.address, 200), phone: str(b.phone, 40), website: str(b.website, 500), source: 'pasted' });
const nameKey = (s) => String(s || '').toLowerCase().split(/\s[-|–:]\s|,/)[0].replace(/[^a-z0-9]+/g, ' ').trim();

/** Is this listing your business? Website domain first, then phone, then name. */
function isMine(p, me) {
  if (me.host && hostOf(p.website) === me.host) return true;
  const ph = phoneKey(p.phone); if (ph && me.phones.includes(ph)) return true;
  return Boolean(me.name) && nameKey(p.name) === nameKey(me.name);
}

/** The key sent from the browser, or the one in .env.local. Google keys also run PageSpeed. */
function keysFrom(body) {
  const sent = str(body.apiKey, 200);
  const kind = keyKind(sent);
  return {
    google: kind === 'google' ? sent : process.env.GOOGLE_API_KEY || '',
    serper: kind === 'serper' ? sent : process.env.SERPER_API_KEY || '',
  };
}

// Streams progress lines while it works, then the report: one JSON object per line.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Send JSON' }, { status: 400 }); }
  const website = str(body.website, 300);
  const keyword = str(body.keyword, 120).toLowerCase();
  const city = str(body.city, 80).toLowerCase();
  const name = str(body.name, 160);
  const keys = keysFrom(body);
  if (!website || !keyword) return Response.json({ error: 'Enter your website and the search keyword' }, { status: 400 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o) => ctrl.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
      const progress = (text) => send({ type: 'progress', text });
      try {
        const query = city && !keyword.includes(city) ? `${keyword} in ${city}` : keyword;
        const terms = searchTerms(query, city);
        const meHint = { host: hostOf(website), phones: (body.phones || []).map(phoneKey).filter(Boolean), name };
        // Serper first when both are set: it has no card behind it.
        const search = keys.serper ? { label: 'Google Maps (Serper)', run: (q) => searchSerper(q, keys.serper) } : keys.google ? { label: 'Google Places', run: (q) => searchPlaces(q, keys.google) } : null;

        let results = []; let me = null; let found = false; const notes = [];
        const pasted = Array.isArray(body.businesses) ? body.businesses.slice(0, 20).map(fromPaste) : [];
        if (pasted.length) {
          // Copied from Google by the user: Google's order, ads left out.
          results = pasted.filter((b) => !b.sponsored).map((b, i) => ({ ...b, rank: i + 1 }));
          me = results.find((p) => isMine(p, meHint)) || null;
          found = Boolean(me);
          progress(me ? `Read ${results.length} businesses from the pasted Google results. You are #${me.rank}.` : `Read ${results.length} businesses from the pasted Google results. ${name || meHint.host} is not among them.`);
        } else if (search) {
          progress(`Searching ${search.label} for "${query}"…`);
          results = await search.run(query);
          me = results.find((p) => isMine(p, meHint)) || null;
          if (!me) {
            progress(`${name || meHint.host} is not in the top ${results.length} for this search. Looking up your own listing…`);
            const own = await search.run(`${name || meHint.host} ${city}`.trim()).catch(() => []);
            const mine = own.find((p) => isMine(p, meHint));
            if (mine) me = { ...mine, rank: null };
          } else progress(`Found ${results.length} businesses. You are #${me.rank}.`);
          found = Boolean(me);
        } else notes.push('No competitors were compared: add a Serper or Google key, or paste your Google results. The website audit below still ran.');

        if (!me) me = { name: name || meHint.host, rank: null, source: 'website' };
        me.website = me.website || website;
        const rivals = results.filter((p) => p !== me && !isMine(p, meHint)).slice(0, COMPETITORS);
        if (results.length && rivals.length < COMPETITORS) notes.push(`Only ${rivals.length} other business${rivals.length === 1 ? '' : 'es'} came up for this search.`);

        const all = [me, ...rivals];
        const withSites = all.filter((b) => b.website).length;
        progress(`Reading ${withSites} website${withSites === 1 ? '' : 's'}: pages, sitemap, schema, and links on yours…`);
        await Promise.all(all.map(async (b, i) => {
          if (!b.website) return;
          try { b.site = await checkSite(b.website, query, city, { deep: i === 0 }); } catch (e) { b.site = { ok: false, error: e?.name === 'AbortError' ? 'timed out after 15 s' : e.message }; }
        }));
        if (keys.google) {
          progress('Running Google PageSpeed on every home page (mobile)…');
          await Promise.all(all.map(async (b) => { if (b.site?.ok) b.site.speed = await pageSpeed(b.site.finalUrl, keys.google); }));
          if (all.every((b) => !b.site?.ok || b.site.speed?.error)) notes.push(`Google PageSpeed did not run: ${all.find((b) => b.site?.speed?.error)?.site.speed.error || 'no website loaded'}`);
        } else notes.push('Speed is measured from this computer. A Google API key adds the Google PageSpeed score and load times.');

        progress('Writing the report…');
        const report = rivals.length
          ? analyse({ keyword: query, city, businesses: all, mineIndex: 0, compareAll: true })
          : { keyword: query, city, generatedAt: new Date().toISOString(), mine: { index: 0, name: me.name, rank: me.rank, sponsored: false }, competitors: [], plan: [], matrix: [], warnings: [], businesses: [] };
        report.mode = 'auto';
        report.source = pasted.length ? 'Pasted Google results' : search?.label || null;
        report.notes = notes;
        report.profileAudit = results.length || found ? auditProfile(me, rivals, { terms, totalResults: results.length, found }) : [];
        report.audit = auditSite(me.site, { business: me, terms });
        report.site = me.site?.ok ? { url: me.site.finalUrl, pagesRead: me.site.pages.length, checkedLinks: me.site.checkedLinks, sitemap: me.site.sitemap, speed: me.site.speed || null, responseMs: me.site.responseMs } : { error: me.site?.error || 'No website' };
        report.ranking = results.slice(0, 10).map((p) => ({ rank: p.rank, name: p.name, rating: p.rating, reviews: p.reviews, category: p.category, website: hostOf(p.website), mapsUrl: p.mapsUrl, mine: isMine(p, meHint), compared: rivals.includes(p) }));
        report.totalResults = results.length;
        send({ type: 'report', data: report });
      } catch (e) {
        send({ type: 'error', message: e instanceof GoogleError ? e.message : `Something went wrong: ${e.message}` });
      } finally { ctrl.close(); }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
