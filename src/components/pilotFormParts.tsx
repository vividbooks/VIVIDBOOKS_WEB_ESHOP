/**
 * Části přihlášky do pilotáže matematiky: pole s e-maily kolegů, výsledek pozvánek a volání serveru.
 * Používá je PilotForm v MathPilotLandingPage (otázka „Má vaše škola Vividbooks?“ → odemknout + pozvat kolegy).
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const FF = "'Fenomen Sans', sans-serif";
const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MAX_COLLEAGUES = 15;

export type InviteStatus = 'sent' | 'has_account' | 'already_invited' | 'failed';
export type InviteResult = { email: string; status: InviteStatus };
export type SchoolLookup = { found: boolean; schoolName?: string; status?: string; subjects?: string[]; trialEndsOn?: string | null };

export const DEFAULT_INVITE_MESSAGE =
  'Ahoj, zkouším s žáky matematiku a Přijímací zkoušky ve Vividbooks. Přidej se, máme to celá škola zdarma do konce školního roku.';

async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as T | null;
  return { ok: res.ok, status: res.status, data };
}

export async function lookupSchool(email: string): Promise<SchoolLookup> {
  const r = await post<SchoolLookup & { ok?: boolean; message?: string }>('/pilot/school-lookup', { email });
  if (!r.ok || !r.data) throw new Error(r.data?.message || 'Školu se teď nepodařilo ověřit.');
  return r.data;
}

export async function sendInvites(input: {
  mode: 'invite' | 'tip';
  inviterEmail: string;
  inviterName: string;
  emails: string[];
  message: string;
}): Promise<{ results: InviteResult[]; error?: string }> {
  const r = await post<{ ok?: boolean; results?: InviteResult[]; message?: string }>('/pilot/invite', {
    ...input,
    subjects: ['mat', 'prij'],
  });
  if (!r.ok || !r.data?.ok) return { results: [], error: r.data?.message || 'Pozvánky se nepodařilo odeslat.' };
  return { results: r.data.results || [] };
}

export function ColleaguesField({
  label,
  emails,
  onChange,
  optional = false,
  hint = 'Nejvýš 15 adres. Dostanou pozvánku vaším jménem.',
}: {
  label: string;
  emails: string[];
  onChange: (emails: string[]) => void;
  optional?: boolean;
  hint?: string;
}) {
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState('');

  const commit = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return;
    const next = [...emails];
    const bad: string[] = [];
    for (const p of parts) {
      if (!EMAIL_RE.test(p)) bad.push(p);
      else if (!next.includes(p) && next.length < MAX_COLLEAGUES) next.push(p);
    }
    onChange(next);
    setInvalid(bad.length ? `Tohle nevypadá jako e-mail: ${bad.join(', ')}` : '');
    setDraft(bad.join(' '));
  };

  return (
    <div style={{ fontFamily: FF }}>
      <label htmlFor="pilot-colleagues" className="mb-2 block text-[14px] font-bold text-[#001161]">
        {label}
        {optional ? <span className="font-normal text-[#001161]/50"> (nepovinné)</span> : null}
      </label>
      <div className="flex min-h-[52px] flex-wrap items-center gap-1.5 rounded-[14px] border border-[#001161]/15 bg-white px-2.5 py-2 focus-within:border-[#7C3AED] focus-within:ring-2 focus-within:ring-[#7C3AED]/15">
        {emails.map((e) => (
          <span key={e} className="inline-flex items-center gap-1.5 rounded-full bg-[#f3eeff] py-1 pl-3 pr-1.5 text-[13px] font-bold text-[#5B21B6]">
            {e}
            <button
              type="button"
              aria-label={`Odebrat ${e}`}
              onClick={() => onChange(emails.filter((x) => x !== e))}
              className="grid h-5 w-5 place-items-center rounded-full bg-black/5 hover:bg-black/10"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id="pilot-colleagues"
          type="email"
          value={draft}
          placeholder={emails.length ? 'další e-mail…' : 'e-mail kolegy, Enter pro další'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
              e.preventDefault();
              commit(draft);
            } else if (e.key === 'Backspace' && !draft && emails.length) {
              onChange(emails.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (/[\s,;]/.test(text)) {
              e.preventDefault();
              commit(`${draft} ${text}`);
            }
          }}
          className="min-w-[180px] flex-1 border-0 bg-transparent px-1.5 py-1.5 text-[15px] text-[#001161] outline-none placeholder:text-[#001161]/40"
        />
      </div>
      <p className={`mt-1.5 text-[12px] ${invalid ? 'text-red-600' : 'text-[#001161]/50'}`}>{invalid || hint}</p>
    </div>
  );
}

export function MessageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ fontFamily: FF }}>
      <label htmlFor="pilot-message" className="mb-2 block text-[14px] font-bold text-[#001161]">
        Vzkaz pro kolegy <span className="font-normal text-[#001161]/50">(nepovinné)</span>
      </label>
      <textarea
        id="pilot-message"
        value={value}
        maxLength={600}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[92px] w-full resize-y rounded-[14px] border border-[#001161]/15 bg-white px-4 py-3 text-[15px] leading-relaxed text-[#001161] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15"
      />
    </div>
  );
}

const STATUS_LABEL: Record<InviteStatus, string> = {
  sent: 'pozvánka odeslána',
  has_account: 'už u vás účet má',
  already_invited: 'pozvánku nedávno dostal/a',
  failed: 'nepodařilo se odeslat',
};

export function InviteResultList({ results, tip = false }: { results: InviteResult[]; tip?: boolean }) {
  if (!results.length) return null;
  return (
    <ul className="mx-auto mt-5 grid max-w-md gap-2 text-left" style={{ fontFamily: FF }}>
      {results.map((r) => (
        <li key={r.email} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-white px-4 py-2.5 text-[14px] text-[#001161] shadow-sm">
          <span className="break-all">{r.email}</span>
          <span className={`text-[12px] font-bold ${r.status === 'sent' ? 'text-green-700' : r.status === 'failed' ? 'text-red-600' : 'text-amber-700'}`}>
            {r.status === 'sent' && tip ? 'tip odeslán' : STATUS_LABEL[r.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
