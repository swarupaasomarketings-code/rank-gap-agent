'use client';
import { useEffect, useState } from 'react';
import { Globe, Loader2, ArrowRight, Check, KeyRound, ScanSearch, Search, X, ChevronDown } from 'lucide-react';
import { Report, Button, cx } from '@/components/Report';
import { Shell } from '@/components/Shell';
import { parseGoogleResults } from '@/lib/parseResults';
import { websitesFromHtml } from '@/lib/pasteLinks';

// Google keys start with "AIza"; any other key is taken as a Serper key (the server checks the same way).
const kindOf = (k) => (!k ? null : /^AIza[\w-]{20,}$/.test(k) ? 'google' : 'serper');
const withWebsites = (found, links) => found.map((b) => ({ ...b, website: links.get(b.name) || '' }));

const STORE = 'rank-gap-agent:auto:v1';
const KEY_STORE = 'rank-gap-agent:google-key';
const load = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const save = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* storage unavailable */ } };

function Card({ step, icon: Icon, title, hint, children }) {
  return (
    <section className="rounded-2xl border border-line bg-panel shadow-sm">
      <header className="flex gap-3 border-b border-line px-5 py-4 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon size={18} /></span>
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted">Step {step}</p><h2 className="text-base font-semibold">{title}</h2>{hint && <p className="mt-0.5 max-w-2xl text-muted">{hint}</p>}</div>
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
const Label = ({ text, children, className }) => <label className={cx('block', className)}><span className="mb-1 block text-xs font-medium text-muted">{text}</span>{children}</label>;

export default function AutoMode() {
  const [website, setWebsite] = useState('');
  const [scan, setScan] = useState(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [keyword, setKeyword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { const s = JSON.parse(load(STORE) || 'null'); if (s) { setWebsite(s.website || ''); setScan(s.scan || null); setName(s.name || ''); setCity(s.city || ''); setKeyword(s.keyword || ''); } } catch { /* ignore */ }
    setApiKey(load(KEY_STORE) || ''); setReady(true);
  }, []);
  useEffect(() => { if (ready) save(STORE, JSON.stringify({ website, scan, name, city, keyword })); }, [ready, website, scan, name, city, keyword]);

  const [pasteText, setPasteText] = useState('');
  const [pasteLinks, setPasteLinks] = useState(new Map());
  const [pasted, setPasted] = useState([]);
  const kind = kindOf(apiKey.trim());
  const hasKey = Boolean(kind || scan?.serverKey);
  const pastedCount = pasted.filter((b) => !b.sponsored).length;
  // The clipboard's HTML carries each listing's Website link; the plain text carries the rest.
  const onPasteResults = (e) => {
    const html = e.clipboardData?.getData('text/html') || ''; const text = e.clipboardData?.getData('text/plain') || '';
    if (!text) return;
    e.preventDefault();
    const found = parseGoogleResults(text);
    const links = websitesFromHtml(html, found.map((b) => b.name));
    setPasteText(text); setPasteLinks(links); setPasted(withWebsites(found, links));
  };

  const runScan = async (e) => {
    e?.preventDefault();
    setScanning(true); setError(''); setReport(null); setSteps([]);
    try {
      const res = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ website }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not read the website');
      setScan(d); setName(d.name || ''); setCity(d.city || ''); setKeyword(d.keywords[0] || '');
      if (!d.serverKey && !apiKey) setShowKey(true);
    } catch (err) { setError(err.message); setScan(null); } finally { setScanning(false); }
  };

  const run = async () => {
    setBusy(true); setError(''); setReport(null); setSteps([]);
    try {
      const res = await fetch('/api/auto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ website: scan?.website || website, keyword, city, name, phones: scan?.phones || [], apiKey: apiKey.trim() || undefined, businesses: !hasKey && pastedCount ? pasted : undefined }) });
      if (!res.ok || !res.body) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'The analysis did not start'); }
      // Progress lines arrive while the agent works; the last line is the report or an error.
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (value) buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const m = JSON.parse(line);
          if (m.type === 'progress') setSteps((s) => [...s, m.text]);
          else if (m.type === 'error') throw new Error(m.message);
          else if (m.type === 'report') { setReport(m.data); setTimeout(() => document.getElementById('report')?.scrollIntoView({ behavior: 'smooth' }), 80); }
        }
        if (done) break;
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const reset = () => { setWebsite(''); setScan(null); setName(''); setCity(''); setKeyword(''); setReport(null); setSteps([]); setError(''); setPasteText(''); setPasted([]); setPasteLinks(new Map()); };

  return (
    <Shell onReset={reset}>
      <div className="no-print space-y-5">
        <div className="px-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Who outranks you on Google, and why?</h1>
          <p className="mt-1 max-w-2xl text-[15px] text-muted">Enter your website. The agent finds your top 4 competitors on Google, reads every website, audits yours and shows exactly what they have that you don&apos;t, and what to fix first.</p>
        </div>

        <Card step={1} icon={Globe} title="Your website" hint="The address of your business website.">
          <form onSubmit={runScan} className="flex flex-col gap-3 sm:flex-row">
            <input className="field flex-1 text-[15px]" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="e.g. aswebmarketings.com" aria-label="Your website" inputMode="url" />
            <Button variant="primary" type="submit" disabled={!website.trim() || scanning} className="px-5">{scanning ? <><Loader2 size={17} className="animate-spin" />Reading…</> : <><ScanSearch size={17} />Scan website</>}</Button>
          </form>
          {error && !scan && <p className="mt-3 text-high" role="alert">{error}</p>}
        </Card>

        {scan && (
          <Card step={2} icon={Search} title="Check what was found and pick the search" hint="Read from your website. Correct anything that is wrong.">
            <div className="grid gap-3 sm:grid-cols-3">
              <Label text="Business name (as on Google)" className="sm:col-span-2"><input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Business name" /></Label>
              <Label text="City"><input className="field" value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" placeholder="e.g. kolkata" /></Label>
            </div>
            {scan.phones?.length > 0 && <p className="mt-2 text-xs text-muted">Phone numbers on the site: {scan.phones.join(', ')} (used to recognise your Google listing)</p>}
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-muted">Searches your website is built for. Pick one, or type your own.</p>
              <div className="flex flex-wrap gap-2">
                {scan.keywords.map((k) => (
                  <button key={k} onClick={() => setKeyword(k)} className={cx('rounded-full border px-3 py-1.5 text-[13px] transition', keyword === k ? 'border-brand bg-brand text-brand-ink' : 'border-line hover:border-brand hover:text-brand')}>{keyword === k && <Check size={13} className="mr-1 inline" />}{k}</button>
                ))}
              </div>
              <Label text="Search keyword" className="mt-3"><input className="field text-[15px]" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. seo company in kolkata" aria-label="Search keyword" /></Label>
            </div>

            <div className="mt-5 rounded-xl border border-line bg-soft p-4">
              <button onClick={() => setShowKey(!showKey)} className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={showKey}>
                <span className="flex flex-wrap items-center gap-2 font-medium"><KeyRound size={16} />Competitor search key
                  {kind ? <span className="rounded-full bg-behind-bg px-2 py-0.5 text-xs text-behind">{kind === 'google' ? 'Google key saved' : 'Serper key saved'}</span> : scan.serverKey ? <span className="rounded-full bg-behind-bg px-2 py-0.5 text-xs text-behind">set on the server</span> : pastedCount ? <span className="rounded-full bg-behind-bg px-2 py-0.5 text-xs text-behind">using pasted results</span> : <span className="rounded-full bg-medium-bg px-2 py-0.5 text-xs text-medium">needed to find competitors</span>}</span>
                <ChevronDown size={16} className={cx('shrink-0 transition', showKey && 'rotate-180')} />
              </button>
              {showKey && (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-2">
                    <input className="field font-mono text-xs" type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); save(KEY_STORE, e.target.value.trim()); }} placeholder="Paste a Serper or Google API key" aria-label="API key" autoComplete="off" />
                    {apiKey && <Button onClick={() => { setApiKey(''); save(KEY_STORE, ''); }} aria-label="Remove key"><X size={15} /></Button>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-brand/40 bg-panel p-3">
                      <p className="font-semibold">Serper <span className="ml-1 rounded-full bg-behind-bg px-2 py-0.5 text-xs font-medium text-behind">recommended · no card</span></p>
                      <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-[13px] text-muted">
                        <li>Sign up at <b className="text-ink">serper.dev</b> with your email.</li>
                        <li>Open <b className="text-ink">API Key</b> in the dashboard and copy it.</li>
                        <li>Paste it above. One report uses 1–2 searches.</li>
                      </ol>
                    </div>
                    <div className="rounded-lg border border-line bg-panel p-3">
                      <p className="font-semibold">Google <span className="ml-1 text-xs font-normal text-muted">adds the PageSpeed score · needs billing</span></p>
                      <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-[13px] text-muted">
                        <li><b className="text-ink">console.cloud.google.com</b>: project + billing account.</li>
                        <li>Enable <b className="text-ink">Places API (New)</b> and <b className="text-ink">PageSpeed Insights API</b>.</li>
                        <li>Credentials → API key (starts with AIza), restrict it, paste above.</li>
                      </ol>
                    </div>
                  </div>
                  <p className="text-xs text-muted">The key stays in this browser and is sent only to this app on your computer, which passes it on to the search service.</p>
                </div>
              )}
              {!hasKey && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-[13px] font-medium">No key? Paste the Google results instead</p>
                  <p className="text-xs text-muted">Search “{keyword || 'your keyword'}” on Google, select the Businesses list from the first name to the last, copy (Ctrl+C) and paste (Ctrl+V) below. Websites are picked up from the copied links.</p>
                  <textarea className="field mt-2 min-h-20 font-mono text-xs" onPaste={onPasteResults} value={pasteText} onChange={(e) => { setPasteText(e.target.value); setPasted(withWebsites(parseGoogleResults(e.target.value), pasteLinks)); }} placeholder="Paste here" aria-label="Pasted Google results" />
                  {pastedCount > 0 && <p className="mt-1 text-xs text-behind">Read {pastedCount} businesses, {pasted.filter((b) => b.website).length} with a website. {pasted.some((b) => b.sponsored) ? 'Ads are left out.' : ''}</p>}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Button variant="primary" onClick={run} disabled={busy || !keyword.trim()} className="px-6 py-3 text-[15px]">
                {busy ? <><Loader2 size={18} className="animate-spin" />Working…</> : <>{hasKey || pastedCount ? 'Find competitors and gaps' : 'Audit my website only'}<ArrowRight size={18} /></>}
              </Button>
              {!hasKey && !pastedCount && <p className="text-muted">Add a key or paste the Google results to compare with competitors.</p>}
              {(hasKey || pastedCount > 0) && <p className="text-muted">Compares you with the top 4 competitors.</p>}
            </div>
            {steps.length > 0 && (
              <ol className="mt-4 space-y-1.5" aria-live="polite">
                {steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">{i === steps.length - 1 && busy ? <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-brand" /> : <Check size={16} className="mt-0.5 shrink-0 text-behind" />}<span className={cx(i === steps.length - 1 && busy ? 'text-ink' : 'text-muted')}>{s}</span></li>
                ))}
              </ol>
            )}
            {error && scan && <p className="mt-3 text-high" role="alert">{error}</p>}
          </Card>
        )}
      </div>

      {report && <Report r={report} />}
    </Shell>
  );
}
