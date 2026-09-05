/**
 * DVPP zdarma — společný rám stránek knihovny (hlavička, navigace, patička).
 * Funguje na vividbooks.com i na samostatné doméně dvppzdarma.cz.
 * `tone="dark"` = rozvržení jako Netflix (knihovna, přehrávač): tmavá plocha, karty v barvách jako na homepage.
 */
import React, { type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { Award, LogOut, Users } from 'lucide-react';
import { SEOHead } from '../SEOHead';
import { useDvppSession } from './DvppSession';

export const DVPP_FONT = "'Fenomen Sans', sans-serif";
export const DVPP_SERIF = "'Cooper Light', serif";

export type DvppTone = 'light' | 'dark';

/** Barvy rámu jako CSS proměnné — karty a texty si je berou přes `var(--dvpp-*)`, takže fungují na světlé i tmavé ploše. */
export function dvppToneVars(tone: DvppTone): CSSProperties {
  return tone === 'dark'
    ? ({
      '--dvpp-bg': '#050B2E',
      '--dvpp-ink': '#FFFFFF',
      '--dvpp-heading': '#FFFFFF',
      '--dvpp-muted': '#A9B2D8',
      '--dvpp-card': 'rgba(255,255,255,0.06)',
      '--dvpp-line': 'rgba(255,255,255,0.12)',
      '--dvpp-chip': 'rgba(255,255,255,0.10)',
      '--dvpp-chip-active': '#FFFFFF',
      '--dvpp-chip-active-ink': '#001161',
    } as CSSProperties)
    : ({
      '--dvpp-bg': '#F6F7FB',
      '--dvpp-ink': '#0d1440',
      '--dvpp-heading': '#001161',
      '--dvpp-muted': '#6b7398',
      '--dvpp-card': '#FFFFFF',
      '--dvpp-line': 'rgba(0,17,97,0.10)',
      '--dvpp-chip': '#FFFFFF',
      '--dvpp-chip-active': '#001161',
      '--dvpp-chip-active-ink': '#FFFFFF',
    } as CSSProperties);
}

export function isDvppStandaloneHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.replace(/^www\./, '').toLowerCase() === 'dvppzdarma.cz';
}

export function DvppShell({
  title,
  description,
  path,
  children,
  wide = false,
  tone = 'light',
  flush = false,
}: {
  title: string;
  description: string;
  path: string;
  children: ReactNode;
  wide?: boolean;
  tone?: DvppTone;
  /** Bez vnitřního odsazení a šířky — stránka si billboard a řádky rozvrhne sama (knihovna). */
  flush?: boolean;
}) {
  const { me, logout } = useDvppSession();
  const dark = tone === 'dark';
  const nav = [
    { to: '/knihovna', label: 'Knihovna' },
    { to: '/sborovna', label: 'Sborovna' },
    { to: '/pro-reditele', label: 'Pro ředitele' },
  ];
  const container = wide ? 'max-w-[1400px]' : 'max-w-[1120px]';
  return (
    <div
      className="min-h-screen"
      style={{ ...dvppToneVars(tone), fontFamily: DVPP_FONT, background: 'var(--dvpp-bg)', color: 'var(--dvpp-ink)' }}
    >
      <SEOHead title={title} description={description} path={path} />
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur ${dark ? 'border-white/10 bg-[#050B2E]/80' : 'border-[#001161]/10 bg-white/90'}`}
      >
        <div className={`mx-auto flex items-center justify-between gap-4 px-4 py-3 md:px-8 ${container}`}>
          <Link to="/knihovna" className="flex items-center gap-2 no-underline">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${dark ? 'bg-[#F06632] text-white' : 'bg-[#001161] text-white'}`}><Award className="h-4 w-4" /></span>
            <span className={`text-[17px] font-extrabold tracking-tight ${dark ? 'text-white' : 'text-[#001161]'}`}>DVPP zdarma</span>
            <span className={`hidden text-[12px] sm:inline ${dark ? 'text-white/55' : 'text-[#6b7398]'}`}>· knihovna pro sborovny</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-full px-3.5 py-1.5 text-[14px] font-semibold no-underline transition ${
                    isActive
                      ? dark ? 'bg-white text-[#001161]' : 'bg-[#001161] text-white'
                      : dark ? 'text-white/85 hover:bg-white/10' : 'text-[#001161] hover:bg-[#001161]/8'
                  }`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {me ? (
              <>
                <span className={`hidden text-[13px] sm:inline ${dark ? 'text-white/70' : 'text-[#3a4270]'}`}>{me.firstName || me.email}</span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${dark ? 'border-white/20 text-white hover:bg-white/10' : 'border-[#001161]/15 text-[#001161] hover:bg-white'}`}
                >
                  <LogOut className="h-3.5 w-3.5" /> Odhlásit
                </button>
              </>
            ) : (
              <Link
                to="/knihovna/prihlaseni"
                className="inline-flex items-center gap-1 rounded-full bg-[#F06632] px-4 py-1.5 text-[13px] font-bold text-white no-underline hover:bg-[#d9552a]"
              >
                <Users className="h-3.5 w-3.5" /> Přihlásit se
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className={flush ? 'pb-20' : `mx-auto px-4 pb-20 pt-8 md:px-8 ${container}`}>{children}</main>
      <footer className={`border-t ${dark ? 'border-white/10' : 'border-[#001161]/10 bg-white'}`}>
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[12px]" style={{ color: 'var(--dvpp-muted)' }}>
          <span>© {new Date().getFullYear()} Vividbooks s.r.o. · Osvědčení DVPP podle § 10 vyhlášky 317/2005 Sb.</span>
          <span className="flex gap-4">
            <a href="https://www.vividbooks.com/webinare" style={{ color: 'var(--dvpp-heading)' }}>Živé webináře</a>
            <a href="mailto:hello@vividbooks.com" style={{ color: 'var(--dvpp-heading)' }}>hello@vividbooks.com</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

export function DvppButton({
  children, onClick, to, href, variant = 'primary', disabled, type = 'button', className = '',
}: {
  children: ReactNode; onClick?: () => void; to?: string; href?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass'; disabled?: boolean; type?: 'button' | 'submit'; className?: string;
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold no-underline transition disabled:opacity-50';
  const v = variant === 'primary'
    ? 'bg-[#F06632] text-white hover:bg-[#d9552a]'
    : variant === 'secondary'
      ? 'bg-[#001161] text-white hover:bg-[#001a8a]'
      : variant === 'glass'
        ? 'bg-white/15 text-white backdrop-blur hover:bg-white/25'
        : 'border border-[#001161]/15 bg-white text-[#001161] hover:bg-[#f0f2f8]';
  const cls = `${base} ${v} ${className}`;
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  if (href) return <a href={href} className={cls} target="_blank" rel="noreferrer">{children}</a>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

/** Karta si barvu bere z rámu (`--dvpp-card`), takže na tmavé ploše je průsvitná, na světlé bílá. */
export function DvppCard({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div
      id={id}
      className={`rounded-[18px] border p-5 shadow-[0_2px_12px_rgba(0,17,97,0.06)] ${className}`}
      style={{ background: 'var(--dvpp-card, #fff)', borderColor: 'var(--dvpp-line, rgba(0,17,97,0.10))' }}
    >
      {children}
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      {label ? <div className="mb-1 flex justify-between text-[13px] text-[#3a4270]"><span>{label}</span><span className="tabular-nums">{value} / {max}</span></div> : null}
      <div className="h-3 w-full overflow-hidden rounded-full bg-[#e6e9f3]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#F06632] to-[#ff9a6b] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
