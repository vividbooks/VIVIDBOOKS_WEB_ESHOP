/**
 * DVPP zdarma — společný rám stránek knihovny (hlavička, navigace, patička).
 * Funguje na vividbooks.com i na samostatné doméně dvppzdarma.cz.
 */
import React, { type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { Award, LogOut, Users } from 'lucide-react';
import { SEOHead } from '../SEOHead';
import { useDvppSession } from './DvppSession';

export const DVPP_FONT = "'Fenomen Sans', sans-serif";

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
}: {
  title: string;
  description: string;
  path: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { me, logout } = useDvppSession();
  const nav = [
    { to: '/knihovna', label: 'Knihovna' },
    { to: '/sborovna', label: 'Sborovna' },
    { to: '/pro-reditele', label: 'Pro ředitele' },
  ];
  return (
    <div className="min-h-screen bg-[#F6F7FB] text-[#0d1440]" style={{ fontFamily: DVPP_FONT }}>
      <SEOHead title={title} description={description} path={path} />
      <header className="sticky top-0 z-30 border-b border-[#001161]/10 bg-white/90 backdrop-blur">
        <div className={`mx-auto flex items-center justify-between gap-4 px-4 py-3 ${wide ? 'max-w-[1400px]' : 'max-w-[1120px]'}`}>
          <Link to="/knihovna" className="flex items-center gap-2 no-underline">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#001161] text-white"><Award className="h-4 w-4" /></span>
            <span className="text-[17px] font-extrabold tracking-tight text-[#001161]">DVPP zdarma</span>
            <span className="hidden text-[12px] text-[#6b7398] sm:inline">· knihovna pro sborovny</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-full px-3.5 py-1.5 text-[14px] font-semibold no-underline transition ${isActive ? 'bg-[#001161] text-white' : 'text-[#001161] hover:bg-[#001161]/8'}`}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {me ? (
              <>
                <span className="hidden text-[13px] text-[#3a4270] sm:inline">{me.firstName || me.email}</span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex items-center gap-1 rounded-full border border-[#001161]/15 px-3 py-1.5 text-[13px] font-semibold text-[#001161] hover:bg-white"
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
      <main className={`mx-auto px-4 pb-20 pt-8 ${wide ? 'max-w-[1400px]' : 'max-w-[1120px]'}`}>{children}</main>
      <footer className="border-t border-[#001161]/10 bg-white">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[12px] text-[#6b7398]">
          <span>© {new Date().getFullYear()} Vividbooks s.r.o. · Osvědčení DVPP podle § 10 vyhlášky 317/2005 Sb.</span>
          <span className="flex gap-4">
            <a href="https://www.vividbooks.com/webinare" className="text-[#001161]">Živé webináře</a>
            <a href="mailto:hello@vividbooks.com" className="text-[#001161]">hello@vividbooks.com</a>
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
  variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; type?: 'button' | 'submit'; className?: string;
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold no-underline transition disabled:opacity-50';
  const v = variant === 'primary'
    ? 'bg-[#F06632] text-white hover:bg-[#d9552a]'
    : variant === 'secondary'
      ? 'bg-[#001161] text-white hover:bg-[#001a8a]'
      : 'border border-[#001161]/15 bg-white text-[#001161] hover:bg-[#f0f2f8]';
  const cls = `${base} ${v} ${className}`;
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  if (href) return <a href={href} className={cls} target="_blank" rel="noreferrer">{children}</a>;
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

export function DvppCard({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={`rounded-[18px] border border-[#001161]/10 bg-white p-5 shadow-[0_2px_12px_rgba(0,17,97,0.06)] ${className}`}>{children}</div>;
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
