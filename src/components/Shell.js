'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, RotateCcw } from 'lucide-react';
import { Button, cx } from './Report';

const NAV = [['/', 'Automatic'], ['/manual', 'Manual']];

export function Shell({ children, onExample, onReset }) {
  const path = usePathname();
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-10 border-b border-line bg-panel/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-ink"><Sparkles size={18} /></span>
              <span className="leading-tight"><span className="block font-semibold">Rank Gap Agent</span><span className="block text-xs text-muted">AS Webmarketings</span></span>
            </Link>
            <nav className="flex rounded-lg bg-soft p-1" aria-label="Mode">
              {NAV.map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} className={cx('rounded-md px-3 py-1 text-[13px] font-medium', path === href ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink')}>{label}</Link>)}
            </nav>
          </div>
          <div className="flex gap-1">
            {onExample && <Button variant="ghost" onClick={onExample}>Load example</Button>}
            {onReset && <Button variant="ghost" onClick={onReset}><RotateCcw size={15} />Start over</Button>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:py-8">{children}</main>
      <footer className="no-print mx-auto max-w-5xl px-4 pb-10 text-xs text-muted">Google does not publish how it ranks local results. This agent compares the signals Google names (relevance, distance, prominence) and the website each listing links to. Websites are read live from this computer, respecting robots.txt; sites that block automated visits are reported, not bypassed.</footer>
    </div>
  );
}
