'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, ClipboardPaste, Plus, Trash2, Loader2, ArrowRight, ChevronDown, Building2, Users, X } from 'lucide-react';
import { Report, Button, cx } from '@/components/Report';
import { Shell } from '@/components/Shell';
import { parseGoogleResults } from '@/lib/parseResults';
import { searchTerms } from '@/lib/terms';

const STORE = 'rank-gap-agent:v2';
const EXAMPLE = `Sponsored
Web Make
4.7(27) · Internet marketing service
10+ years in business · 2 Brabourne Road
Open · Closes 7 pm · 093393 97327
Grow Your Business Online - Get a professional website designed to attract customers and gro...
Website
Directions
Digital Piloto Pvt. Ltd.
4.8(104) · Internet marketing service
7+ years in business · Ranikuthi Ground Fl, 113, ne...
Open 24 hours · 070039 41041
Provides: Best SEO Company India
Website
Directions
Anttech Digital Marketing Agency
4.9(598) · Internet marketing service
15+ years in business · Corparation Building, D2, B...
Open 24 hours · 079808 15656
Provides: Best SEO Company in Kolkata
Website
Directions
AS Webmarketings - Digital Marketing
4.9(31) · Internet marketing service
15+ years in business · 1d, Middle Rd
Open · Closes 11:30 pm · 089729 69179
Website
Directions`;

const blank = () => ({ name: '', website: '', rank: '', rating: '', reviews: '', reviews90: '', photos: '', category: '', hours: '', provides: '', years: '', distanceKm: '', sponsored: false, manualTitle: '', manualH1: '' });
const key = (s) => String(s || '').toLowerCase().split(/\s[-|–:]\s|,/)[0].replace(/[^a-z0-9]+/g, ' ').trim();
const sameBusiness = (a, b) => key(a) && key(a) === key(b);
// A listing read from Google, merged into what was already typed (a typed website or optional number is kept).
const fromListing = (old, b) => ({ ...blank(), ...old, ...Object.fromEntries(Object.entries({ name: b.name, rank: b.rank ?? '', rating: b.rating ?? '', reviews: b.reviews ?? '', category: b.category, hours: b.hours, provides: b.provides, years: b.years, sponsored: b.sponsored }).filter(([, v]) => v !== '' && v != null)) });

function loadSaved() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; } }

function Section({ step, icon: Icon, title, hint, actions, children }) {
  return (
    <section className="rounded-2xl border border-line bg-panel shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">{Icon ? <Icon size={18} /> : step}</span>
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted">Step {step}</p><h2 className="text-base font-semibold">{title}</h2>{hint && <p className="mt-0.5 max-w-2xl text-muted">{hint}</p>}</div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Field({ label, hint, span, children }) {
  return (
    <label className={cx('block', span === 2 && 'sm:col-span-2')}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function PasteBox({ label, placeholder, onRead, onClose }) {
  const [text, setText] = useState(''); const [note, setNote] = useState('');
  return (
    <div className="mb-5 rounded-xl border border-dashed border-line bg-soft p-4">
      <div className="mb-2 flex items-center justify-between"><p className="font-medium">{label}</p>{onClose && <button onClick={onClose} className="rounded p-1 text-muted hover:text-ink" aria-label="Close"><X size={16} /></button>}</div>
      <textarea className="field min-h-28 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label} />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={!text.trim()} onClick={() => { const n = onRead(text); setNote(n || ''); if (!n) setText(''); }}><ClipboardPaste size={16} />Fill in</Button>
        {note && <p className="text-medium" role="status">{note}</p>}
      </div>
    </div>
  );
}

function BusinessForm({ value, onChange, mine, index, onRemove }) {
  const [paste, setPaste] = useState(false);
  const [more, setMore] = useState(Boolean(value.manualTitle || value.manualH1));
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const who = mine ? 'your business' : `competitor ${index + 1}`;
  const input = (k, placeholder, props = {}) => <input className="field" value={value[k] ?? ''} onChange={set(k)} placeholder={placeholder} aria-label={`${k} of ${who}`} {...props} />;
  return (
    <div className={cx('rounded-xl border p-4 sm:p-5', mine ? 'border-brand/40 bg-brand-soft/40' : 'border-line')}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold', mine ? 'bg-brand text-brand-ink' : 'bg-soft text-ink')}>{mine ? 'You' : `Competitor ${index + 1}`}</span>
          <p className="font-semibold">{value.name || <span className="font-normal text-muted">No name yet</span>}</p>
          {value.sponsored && <span className="rounded bg-soft px-1.5 py-0.5 text-xs text-muted">Ad: left out of the comparison</span>}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" onClick={() => setPaste(!paste)} className="px-2.5 py-1.5 text-[13px]"><ClipboardPaste size={15} />Paste listing</Button>
          {onRemove && <Button variant="ghost" onClick={onRemove} className="px-2.5 py-1.5 text-[13px] hover:text-high" aria-label={`Remove ${who}`}><Trash2 size={15} />Remove</Button>}
        </div>
      </div>
      {/* A single pasted listing says nothing about its position, so rank is cleared. */}
      {paste && <PasteBox label={`Paste ${mine ? 'your' : 'this competitor’s'} Google listing`} placeholder={'Business name\n4.8(104) · Internet marketing service\n7+ years in business · Address\nOpen 24 hours · Phone\nProvides: …'} onClose={() => setPaste(false)}
        onRead={(t) => { const [b] = parseGoogleResults(t); if (!b) return 'Could not read it. Copy from the business name down to the phone number.'; onChange(fromListing(value, { ...b, rank: null })); setPaste(false); return ''; }} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Business name *" span={2}>{input('name', 'Exactly as on Google')}</Field>
        <Field label="Website" span={2}>{input('website', 'e.g. example.com', { inputMode: 'url' })}</Field>
        <Field label="Position on Google" hint="1 = top of the list">{input('rank', 'e.g. 1', { inputMode: 'numeric' })}</Field>
        <Field label="Star rating">{input('rating', 'e.g. 4.8', { inputMode: 'decimal' })}</Field>
        <Field label="Number of reviews">{input('reviews', 'e.g. 120', { inputMode: 'numeric' })}</Field>
        <Field label="Reviews in last 90 days">{input('reviews90', 'optional', { inputMode: 'numeric' })}</Field>
        <Field label="Primary category" span={2}>{input('category', 'e.g. Internet marketing service')}</Field>
        <Field label="Opening hours" span={2}>{input('hours', 'e.g. Open 24 hours')}</Field>
        <Field label={'"Provides" line under the listing'} span={2} hint="Copy it exactly if Google shows one. Leave empty if not.">{input('provides', 'e.g. Best SEO Company India')}</Field>
        <Field label="Years in business">{input('years', 'e.g. 7+ years')}</Field>
        <Field label="Photos on profile">{input('photos', 'optional', { inputMode: 'numeric' })}</Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button onClick={() => setMore(!more)} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand" aria-expanded={more}><ChevronDown size={15} className={cx('transition', more && 'rotate-180')} />More options</button>
        {!mine && <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" checked={Boolean(value.sponsored)} onChange={set('sponsored')} className="h-4 w-4" />This is an ad (Sponsored)</label>}
      </div>
      {more && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Distance to the searcher (km)">{input('distanceKm', 'optional', { inputMode: 'decimal' })}</Field>
          <Field label="Home page title" span={2} hint="Only if the website blocks automated checks: open it and copy its title.">{input('manualTitle', 'optional')}</Field>
          <Field label="Main heading (H1)">{input('manualH1', 'optional')}</Field>
        </div>
      )}
    </div>
  );
}

export default function ManualMode() {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [me, setMe] = useState(blank);
  const [rivals, setRivals] = useState(() => Array.from({ length: 4 }, blank)) // room for the usual 4 competitors; empty cards are skipped;
  const [bulk, setBulk] = useState(false);
  const [choose, setChoose] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = loadSaved();
    if (s) { setKeyword(s.keyword ?? ''); setCity(s.city ?? ''); setMe({ ...blank(), ...s.me }); setRivals((s.rivals?.length ? s.rivals : [{}, {}, {}, {}]).map((r) => ({ ...blank(), ...r }))); }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(STORE, JSON.stringify({ keyword, city, me, rivals })); } catch { /* storage unavailable */ } }, [loaded, keyword, city, me, rivals]);

  const autoCity = useMemo(() => searchTerms(keyword).city[0] || '', [keyword]);

  // Splits a pasted results list into your business and the competitors.
  const applyResults = (found, mineAt) => {
    const others = found.filter((_, i) => i !== mineAt);
    if (mineAt >= 0) setMe((m) => fromListing(m, found[mineAt]));
    setRivals((rs) => {
      const kept = rs.filter((r) => r.name && !others.some((o) => sameBusiness(o.name, r.name)) && !(mineAt >= 0 && sameBusiness(found[mineAt].name, r.name)));
      return [...others.map((o) => fromListing(rs.find((r) => sameBusiness(r.name, o.name)) || {}, o)), ...kept];
    });
    setChoose(null); setBulk(false); setReport(null);
  };
  const readBulk = (text) => {
    const found = parseGoogleResults(text);
    if (!found.length) return 'No businesses found. Copy the list including the star ratings.';
    const at = found.findIndex((b) => sameBusiness(b.name, me.name));
    if (at >= 0 || me.name) { applyResults(found, at); return ''; }
    setChoose(found); return '';
  };
  const loadExample = () => {
    setKeyword('seo company in kolkata'); setCity('');
    const found = parseGoogleResults(EXAMPLE);
    setMe(fromListing(blank(), found[3])); setRivals(found.slice(0, 3).map((b) => fromListing(blank(), b))); setReport(null); setChoose(null);
  };
  const reset = () => { setKeyword(''); setCity(''); setMe(blank()); setRivals(Array.from({ length: 4 }, blank)); setReport(null); setChoose(null); setError(''); };

  const named = rivals.filter((r) => r.name.trim());
  const compared = named.filter((r) => !r.sponsored);
  const problems = [!keyword.trim() && 'enter the search keyword', !me.name.trim() && 'enter your business name', !compared.length && 'add at least one competitor'].filter(Boolean);
  const checking = [me, ...compared].filter((b) => b.website.trim()).length;

  const run = async () => {
    setBusy(true); setError(''); setReport(null);
    try {
      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keyword, city: city || autoCity, mineIndex: 0, businesses: [me, ...named] }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setReport(data);
      setTimeout(() => document.getElementById('report')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Shell onExample={loadExample} onReset={reset}>
        <div className="no-print space-y-5">
          <div className="px-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Compare by hand</h1>
            <p className="mt-1 max-w-2xl text-[15px] text-muted">Enter your Google listing and your competitors&apos;, copied from Google. Use this when no Google API key is set, or to compare businesses the automatic search did not pick.</p>
          </div>

          <Section step={1} icon={Search} title="What are customers searching?" hint="The exact search you want to rank for on Google Maps and the local results.">
            <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
              <Field label="Search keyword *"><input className="field" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. seo company in kolkata" aria-label="Search keyword" /></Field>
              <Field label="City"><input className="field" value={city} onChange={(e) => setCity(e.target.value)} placeholder={autoCity || 'e.g. kolkata'} aria-label="City" /></Field>
            </div>
          </Section>

          <Section step={2} icon={Building2} title="Your business" hint="Your details as they appear on Google. Paste your listing to fill it in, or type it.">
            <BusinessForm value={me} onChange={setMe} mine />
          </Section>

          <Section step={3} icon={Users} title="Competitors" hint="The businesses you want to compare with. Add them one by one, or paste the whole Google results list at once."
            actions={<Button onClick={() => setBulk(!bulk)}><ClipboardPaste size={16} />Paste Google results list</Button>}>
            {bulk && <PasteBox label="Paste the Google results list" placeholder={'Copy the Businesses list on Google, from the first name down to the last phone number.\nYour business is recognised by its name and goes into Step 2.'} onClose={() => setBulk(false)} onRead={readBulk} />}
            {choose && (
              <div className="mb-5 rounded-xl border border-brand/40 bg-brand-soft p-4">
                <p className="font-medium">Found {choose.length} businesses. Which one is yours?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {choose.map((b, i) => <Button key={i} onClick={() => applyResults(choose, i)}>{b.name}</Button>)}
                  <Button variant="ghost" onClick={() => applyResults(choose, -1)}>None of these</Button>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {rivals.map((r, i) => (
                <BusinessForm key={i} index={i} value={r} onChange={(v) => setRivals((rs) => rs.map((x, j) => (j === i ? v : x)))} onRemove={rivals.length > 1 ? () => setRivals((rs) => rs.filter((_, j) => j !== i)) : undefined} />
              ))}
            </div>
            <Button onClick={() => setRivals((rs) => [...rs, blank()])} className="mt-4 w-full border-dashed py-3"><Plus size={16} />Add competitor</Button>
          </Section>

          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-panel px-5 py-4 shadow-sm sm:px-6">
            <Button variant="primary" onClick={run} disabled={problems.length > 0 || busy} className="px-6 py-3 text-[15px]">
              {busy ? <><Loader2 size={18} className="animate-spin" />{checking ? `Checking ${checking} website${checking > 1 ? 's' : ''}…` : 'Comparing…'}</> : <>Find the gap<ArrowRight size={18} /></>}
            </Button>
            <div className="text-muted">
              {problems.length ? <p>To start, {problems.join(', ')}.</p> : <p>Compares you with {compared.length} competitor{compared.length > 1 ? 's' : ''}{checking ? ` and checks ${checking} website${checking > 1 ? 's' : ''} live` : ''}.{!me.website.trim() && ' Add your website for the website comparison.'}</p>}
              {error && <p className="text-high" role="alert">{error}</p>}
            </div>
          </div>
        </div>

        {report && <Report r={report} />}
    </Shell>
  );
}

