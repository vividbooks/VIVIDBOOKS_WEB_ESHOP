/**
 * DVPP zdarma — společný rám stránek knihovny (hlavička, navigace, patička).
 * Funguje na vividbooks.com i na samostatné doméně dvppzdarma.cz.
 * `tone="dark"` = rozvržení jako Netflix (knihovna, přehrávač): tmavá plocha, karty v barvách jako na homepage.
 */
import React, { type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { LogOut, Users } from 'lucide-react';
import { SEOHead } from '../SEOHead';
import logoPaths from '../../imports/svg-fupfguvmdt';
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
      '--dvpp-btn': '#FFFFFF',
      '--dvpp-btn-ink': '#001161',
      '--dvpp-btn-hover': '#E9ECFF',
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
      '--dvpp-btn': '#001161',
      '--dvpp-btn-ink': '#FFFFFF',
      '--dvpp-btn-hover': '#5B4FD8',
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
          <div className="flex items-center gap-4">
            <a href={isDvppStandaloneHost() ? 'https://www.vividbooks.com/' : '/'} aria-label="Přejít na hlavní web Vividbooks" className="shrink-0">
              <VividbooksWordmark dark={dark} />
            </a>
            <Link to="/knihovna" className={`flex items-center gap-2 border-l pl-4 no-underline ${dark ? 'border-white/15' : 'border-[#001161]/12'}`}>
              <span className={`text-[16px] font-bold tracking-tight ${dark ? 'text-white' : 'text-[#001161]'}`}>DVPP zdarma</span>
              <span className={`hidden text-[12px] sm:inline ${dark ? 'text-white/55' : 'text-[#001161]/55'}`}>· knihovna pro sborovny</span>
            </Link>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-[10px] px-3.5 py-1.5 text-[14px] font-bold no-underline transition ${
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
                  className={`inline-flex items-center gap-1 rounded-[10px] border px-3 py-1.5 text-[13px] font-bold ${dark ? 'border-white/20 text-white hover:bg-white/10' : 'border-[#001161]/15 text-[#001161] hover:bg-white'}`}
                >
                  <LogOut className="h-3.5 w-3.5" /> Odhlásit
                </button>
              </>
            ) : (
              <Link
                to="/knihovna/prihlaseni"
                className={`inline-flex items-center gap-1 rounded-[10px] px-4 py-2 text-[13px] font-bold no-underline transition ${dark ? 'bg-white text-[#001161] hover:bg-[#E9ECFF]' : 'bg-[#001161] text-white hover:bg-[#5B4FD8]'}`}
              >
                <Users className="h-3.5 w-3.5" /> Přihlásit se
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className={flush ? 'pb-20' : `mx-auto px-4 pb-20 pt-8 md:px-8 ${container}`}>{children}</main>
      <footer className={dark ? 'border-t border-white/10' : 'bg-[#001161] text-white'}>
        <div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-5 px-4 py-10 md:flex-row md:items-center md:px-8">
          <div>
            <div className={`text-[20px] font-black ${dark ? 'text-white' : ''}`}>DVPP zdarma</div>
            <p className={`mt-1 text-[13px] ${dark ? 'text-white/55' : 'text-white/55'}`}>Záznamy webinářů pro pedagogy od Vividbooks. Osvědčení DVPP podle § 10 vyhlášky 317/2005 Sb.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-[13px] font-bold text-white/70">
            <Link to="/pro-reditele" className="no-underline hover:text-white" style={{ color: 'inherit' }}>Pro ředitele</Link>
            <a href="https://www.vividbooks.com/webinare" className="no-underline hover:text-white" style={{ color: 'inherit' }}>Živé webináře</a>
            <a href="https://www.vividbooks.com/kontakt" className="no-underline hover:text-white" style={{ color: 'inherit' }}>Kontakt</a>
            <a href="https://www.vividbooks.com" className="no-underline hover:text-white" style={{ color: 'inherit' }}>Vividbooks.com</a>
          </div>
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
  const base = 'inline-flex items-center justify-center gap-2 rounded-[10px] px-5 py-2.5 text-[14px] font-bold no-underline transition disabled:opacity-50';
  const v = variant === 'primary'
    ? 'text-[color:var(--dvpp-btn-ink,#fff)] bg-[color:var(--dvpp-btn,#001161)] hover:bg-[color:var(--dvpp-btn-hover,#5B4FD8)] shadow-[0_10px_26px_rgba(0,17,97,0.16)]'
    : variant === 'secondary'
      ? 'bg-[#E8942A] text-white hover:bg-[#d3821f]'
      : variant === 'glass'
        ? 'bg-white/15 text-white backdrop-blur hover:bg-white/25'
        : 'border border-[#001161]/15 bg-white text-[#001161] hover:bg-[#f0f2f8]';
  const cls = `${base} ${v} ${className}`;
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  if (href) return <a href={href} className={cls} target="_blank" rel="noreferrer">{children}</a>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

/** Logo Vividbooks — stejné cesty SVG jako na landing dvppzdarma.cz a homepage. */
function VividbooksWordmark({ dark }: { dark: boolean }) {
  const fill = dark ? '#FFFFFF' : '#001161';
  return (
    <svg viewBox="0 0 1786.62 869.93" fill="none" className="block h-auto w-[76px] md:w-[88px]" aria-hidden focusable="false">
      {(['p299c6b00', 'p3cc4870', 'p98d9300', 'pf524b00', 'p26e2d80', 'p15998cf0', 'p1bd3b900', 'p19a24c00', 'p34d64300', 'p396dedf0'] as const).map((k) => <path key={k} d={(logoPaths as Record<string, string>)[k]} fill={fill} />)}
    </svg>
  );
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
