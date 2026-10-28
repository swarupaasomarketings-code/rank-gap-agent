'use client';
import { Printer, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const cx = (...a) => a.filter(Boolean).join(' ');
export const Button = ({ variant = 'default', className, ...p }) => (
  <button {...p} className={cx('inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'primary' ? 'bg-brand text-brand-ink shadow-sm hover:opacity-90' : variant === 'ghost' ? 'text-muted hover:bg-soft hover:text-ink' : 'border border-line bg-panel hover:bg-soft', className)} />
);
export const Impact = ({ level }) => <span className={cx('inline-block rounded-full px-2 py-0.5 text-xs font-semibold', level === 'High' ? 'bg-high-bg text-high' : level === 'Medium' ? 'bg-medium-bg text-medium' : 'bg-low-bg text-low')}>{level}</span>;


export function Report({ r }) {
  const above = r.competitors.length;
  const known = r.mine.rank != null;
  const ranked = known && r.comparingAbove;
  const high = r.plan.filter((p) => p.impact === 'High').length;
  const date = new Date(r.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const auto = r.mode === 'auto';
  const auditOnly = auto && !r.competitors.length;
  const seriousIssues = (r.audit || []).filter((i) => i.severity === 'Critical' || i.severity === 'High').length;
  return (
    <div id="report" className="scroll-mt-20 space-y-5">
      <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Rank gap report · {date}</p>
            <h1 className="mt-1 text-xl font-semibold">“{r.keyword}”</h1>
            <p className="mt-2 text-[15px]">
              <b>{r.mine.name}</b>{auditOnly ? ': ' : ' '}
              {r.mine.sponsored ? 'appears only as an ad. ' : known ? <>ranks <b>#{r.mine.rank}</b> in Google&apos;s local results. </> : auto && r.totalResults ? <>is <b>not in Google&apos;s top {r.totalResults}</b> for this search. </> : above ? <>compared with {above} competitor{above > 1 ? 's' : ''}. </> : ''}
              {!above ? '' : !known ? 'Below is where they beat you, and what to do.' : r.comparingAbove ? <>{above} competitor{above > 1 ? 's rank' : ' ranks'} above you. Below is why, and what to do.</> : 'You are on top. These are the gaps to watch so it stays that way.'}
              {auto && r.audit?.length > 0 && <>{auditOnly ? 'the' : ' The'} website audit found <b>{r.audit.length} problem{r.audit.length > 1 ? 's' : ''}</b> on your site.</>}
            </p>
          </div>
          <Button onClick={() => window.print()} className="no-print"><Printer size={16} />Print / save PDF</Button>
        </div>
        {auditOnly ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Pages read" value={r.site?.pagesRead ?? '–'} />
            <Stat label="Pages in sitemap" value={r.site?.sitemap?.found ? r.site.sitemap.urlCount : 'none'} />
            <Stat label="Blog posts" value={r.site?.sitemap?.found ? r.site.sitemap.blogCount : '–'} />
            <Stat label="Problems (serious)" value={`${r.audit.length} (${seriousIssues})`} />
          </div>
        ) : <div className={cx('mt-4 grid gap-3', auto ? 'grid-cols-2 sm:grid-cols-4' : 'sm:grid-cols-3')}>
          <Stat label="Your position" value={known ? `#${r.mine.rank}` : r.mine.sponsored ? 'Ad only' : auto && r.totalResults ? `Not in top ${r.totalResults}` : 'Not entered'} />
          <Stat label={ranked ? 'Ranking above you' : 'Competitors compared'} value={above} />
          <Stat label="High-impact gaps" value={high} />
          {auto && <Stat label="Website problems (serious)" value={`${seriousIssues} / ${r.audit?.length || 0}`} />}
        </div>}
        {r.notes?.length > 0 && <div className="mt-4 space-y-2">{r.notes.map((n) => <p key={n} className="rounded-lg bg-low-bg px-3 py-2 text-low">{n}</p>)}</div>}
        {r.warnings.length > 0 && (
          <div className="mt-4 space-y-2">{r.warnings.map((w) => (
            <div key={w.title} className="flex gap-2.5 rounded-lg bg-medium-bg p-3 text-medium"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><div><p className="font-semibold">{w.title}</p><p className="text-ink">{w.detail}</p></div></div>
          ))}</div>
        )}
      </section>

      {r.ranking?.length > 0 && <Ranking rows={r.ranking} total={r.totalResults} keyword={r.keyword} source={r.source} />}

      {above > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{auto ? 'Your competitors: what they have that you don’t' : ranked ? 'Why they rank above you' : known ? 'Closest competitors' : 'Where competitors beat you'}</h2>
          {r.competitors.map((c) => <CompetitorCard key={c.index} c={c} mine={r.mine.name} myRank={r.mine.rank} />)}
        </section>
      )}

      {r.plan.length > 0 && (
        <section className="print-break rounded-xl border border-line bg-panel shadow-sm">
          <header className="border-b border-line px-5 py-4"><h2 className="text-lg font-semibold">Action plan</h2><p className="text-muted">Do these in order. The first ones close the biggest gaps.</p></header>
          <ol className="divide-y divide-line">
            {r.plan.map((p, i) => (
              <li key={p.action} className="flex gap-4 px-5 py-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-soft font-semibold">{i + 1}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{p.action}</p><Impact level={p.impact} /><span className="text-xs text-muted">{p.group}</span></div>
                  <p className="mt-1">{p.fix}</p>
                  <p className="mt-1 text-xs text-muted">Closes the gap with: {p.against.join(', ')}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {r.profileAudit?.length > 0 && <Audit title="Your Google profile problems" issues={r.profileAudit} intro="Your listing compared with the competitors found for this search." />}
      {r.audit && <Audit title="Your website problems" issues={r.audit} site={r.site} />}

      {r.matrix.length > 0 && <section className="print-break rounded-xl border border-line bg-panel shadow-sm">
        <header className="border-b border-line px-5 py-4"><h2 className="text-lg font-semibold">Side by side: who has what</h2>
          <p className="text-muted"><span className="font-medium text-ahead">Red</span>: that business beats you. <span className="font-medium text-behind">Green</span>: you beat them. Your column is highlighted.</p></header>
        <div className="overflow-x-auto p-2">
          <table className="min-w-[720px]">
            <thead><tr><th className="w-56">Factor</th>{r.businesses.map((b) => <th key={b.index} className={cx(b.index === r.mine.index && 'bg-brand-soft text-ink')}>{b.sponsored ? 'Ad ' : b.rank != null ? `#${b.rank} ` : ''}{b.name.length > 28 ? `${b.name.slice(0, 26)}…` : b.name}</th>)}</tr></thead>
            <tbody>
              {r.matrix.map((row, k) => (
                <tr key={row.key}>
                  <td><span className="font-medium">{row.label}</span>{(k === 0 || r.matrix[k - 1].group !== row.group) && <span className="ml-2 text-xs text-muted">{row.group}</span>}</td>
                  {row.cells.map((c, i) => (
                    <td key={i} className={cx(c.state === 'mine' && 'bg-brand-soft font-medium', c.state === 'ahead' && 'bg-ahead-bg text-ahead', c.state === 'behind' && 'bg-behind-bg text-behind')}>{c.text}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>}
    </div>
  );
}

function Ranking({ rows, total, keyword, source }) {
  return (
    <section className="print-break rounded-xl border border-line bg-panel shadow-sm">
      <header className="border-b border-line px-5 py-4"><h2 className="text-lg font-semibold">Google&apos;s order for “{keyword}”</h2>
        <p className="text-muted">Top {rows.length} of {total} businesses ({source || 'Google'}). The map pack a particular person sees can differ with their location.</p></header>
      <div className="overflow-x-auto p-2">
        <table className="min-w-[640px]">
          <thead><tr><th>#</th><th>Business</th><th>Rating</th><th>Reviews</th><th>Category</th><th>Website</th></tr></thead>
          <tbody>{rows.map((b) => (
            <tr key={b.rank} className={cx(b.mine && 'bg-brand-soft font-medium')}>
              <td className="font-semibold">{b.rank}</td>
              <td>{b.mapsUrl ? <a href={b.mapsUrl} target="_blank" rel="noreferrer" className="hover:underline">{b.name}</a> : b.name}{b.mine && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs text-brand-ink">You</span>}{b.compared && <span className="ml-2 text-xs text-muted">compared</span>}</td>
              <td>{b.rating ?? '–'}</td><td>{b.reviews ?? '–'}</td><td>{b.category || '–'}</td><td className="text-muted">{b.website || 'none'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

const SEV = { Critical: 'bg-high text-panel', High: 'bg-high-bg text-high', Medium: 'bg-medium-bg text-medium', Low: 'bg-low-bg text-low' };
function Audit({ title, issues, site, intro }) {
  const counts = ['Critical', 'High', 'Medium', 'Low'].map((s) => [s, issues.filter((i) => i.severity === s).length]).filter(([, n]) => n);
  return (
    <section className="print-break rounded-xl border border-line bg-panel shadow-sm">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted">{intro || (site?.error ? `Your website could not be checked: ${site.error}` : <>Read {site?.pagesRead} pages and checked {site?.checkedLinks} internal links on {site?.url}{site?.sitemap?.found ? `; the sitemap lists ${site.sitemap.urlCount} pages` : ''}{site?.speed && !site.speed.error ? `; Google PageSpeed mobile score ${site.speed.score}/100` : ''}.</>)}</p>
        {counts.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{counts.map(([s, n]) => <span key={s} className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold', SEV[s])}>{n} {s}</span>)}</div>}
      </header>
      {!issues.length ? <p className="px-5 py-4 text-behind">No problems found on the pages read.</p> : (
        <ul className="divide-y divide-line">{issues.map((i) => (
          <li key={i.title} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2"><span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', SEV[i.severity])}>{i.severity}</span><p className="font-semibold">{i.title}</p><span className="text-xs text-muted">{i.area}</span></div>
            <p className="mt-1.5">{i.detail}</p>
            <p className="mt-1.5 text-muted"><span className="font-medium text-ink">Fix: </span>{i.fix}</p>
            {i.urls.length > 0 && <details open={i.urls.length <= 4} className="mt-1.5 text-xs text-muted"><summary className="cursor-pointer">Where ({i.urls.length + i.more})</summary><ul className="mt-1 list-disc pl-5">{i.urls.map((u) => <li key={u}>{u}</li>)}{i.more > 0 && <li>and {i.more} more</li>}</ul></details>}
          </li>
        ))}</ul>
      )}
    </section>
  );
}

const Stat =({ label, value }) => <div className="rounded-lg bg-soft px-4 py-3"><p className="text-xs text-muted">{label}</p><p className="text-2xl font-semibold">{value}</p></div>;

function CompetitorCard({ c, mine, myRank }) {
  const side = c.rank == null ? null : myRank == null || c.rank < myRank ? 'above' : 'below';
  return (
    <article className="print-break rounded-xl border border-line bg-panel shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
        <h3 className="text-base font-semibold">{c.rank != null && <span className="mr-2 rounded-md bg-soft px-2 py-0.5">#{c.rank}</span>}{c.name}{side && <span className={cx('ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-medium', side === 'above' ? 'bg-ahead-bg text-ahead' : 'bg-behind-bg text-behind')}>ranks {side} you</span>}</h3>
        <p className="text-muted">{c.gaps.length ? `${c.gaps.length} gap${c.gaps.length > 1 ? 's' : ''} against ${mine.split(/\s[-|–]\s/)[0]}` : 'No measurable gap'}</p>
      </header>
      <div className="divide-y divide-line">
        {c.gaps.map((g) => (
          <div key={g.key} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2"><Impact level={g.impact} /><p className="font-semibold">{g.label}</p><span className="text-xs text-muted">They: <b className="text-ink">{g.theirs}</b> · You: <b className="text-ink">{g.yours}</b></span></div>
            <p className="mt-1.5">{g.why}</p>
            <p className="mt-1.5 text-muted"><span className="font-medium text-ink">Fix: </span>{g.fix}</p>
          </div>
        ))}
        {!c.gaps.length && <p className="px-5 py-4 text-muted">On the signals that could be compared, you are level or ahead. The difference is likely distance from the searcher, review recency or signals Google does not show (links, citations, profile age).</p>}
        {c.siteError && <p className="px-5 py-3 text-xs text-muted">Their website could not be checked: {c.siteError}</p>}
        {c.strengths.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3">
            <CheckCircle2 size={16} className="text-behind" /><span className="text-xs font-medium text-muted">Where you are ahead:</span>
            {c.strengths.map((s) => <span key={s.key} className="rounded-full bg-behind-bg px-2.5 py-0.5 text-xs font-medium text-behind">{s.label} ({s.yours} vs {s.theirs})</span>)}
          </div>
        )}
      </div>
    </article>
  );
}
