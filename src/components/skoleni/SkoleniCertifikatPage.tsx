import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Award, Download, Loader2 } from 'lucide-react';
import { SEOHead } from '../SEOHead';
import { CertificatePreview } from '../WebinarDvppCertificateSuccess';
import { edgeFunctionBase } from '../../utils/edgeFunctionBase';
import { publicAnonKey } from '../../utils/supabase/info';
import {
  SKOLENI_KIND_LABEL,
  buildSkoleniCertificateHtml,
  formatSkoleniDateCs,
  printCertificateHtml,
  type SkoleniCertPublic,
} from '../../lib/skoleniCertifikat';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;
const COOPER = { fontFamily: "'Cooper Light', serif" } as const;
const INPUT =
  'w-full rounded-xl border border-[#001161]/15 bg-white px-4 py-3 text-[15px] text-[#001161] outline-none focus:border-[#001161]/40';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; skoleni: SkoleniCertPublic };

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${edgeFunctionBase()}/skoleni-certifikaty/verejne/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Něco se nepovedlo. Zkuste to prosím znovu.');
  return data;
}

/**
 * `/skoleni/certifikat/:token` — učitel po školení zadá jméno, e-mail (a u DVPP datum
 * narození) a stáhne si certifikát. Odkaz škole posílá obchodník z adminu.
 */
export function SkoleniCertifikatPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDateIso, setBirthDateIso] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    call<{ skoleni: SkoleniCertPublic }>(encodeURIComponent(token))
      .then((d) => alive && setLoad({ status: 'ready', skoleni: d.skoleni }))
      .catch((e) => alive && setLoad({ status: 'error', message: e instanceof Error ? e.message : 'Chyba' }));
    return () => {
      alive = false;
    };
  }, [token]);

  const skoleni = load.status === 'ready' ? load.skoleni : null;
  const needBirth = skoleni?.kind === 'dvpp';

  const html = useMemo(
    () =>
      skoleni
        ? buildSkoleniCertificateHtml(skoleni, {
            name: name.trim() || 'Jméno a příjmení',
            email: email.trim(),
            birthDateIso,
          })
        : '',
    [skoleni, name, email, birthDateIso],
  );

  const seo = <SEOHead title="Certifikát ze školení" path={`/skoleni/certifikat/${token}`} noIndex />;

  if (load.status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        {seo}
        <Loader2 className="h-6 w-6 animate-spin text-[#001161]/50" />
      </div>
    );
  }

  if (!skoleni) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        {seo}
        <h1 style={COOPER} className="text-[26px] text-[#001161]">
          Certifikát se nepodařilo najít
        </h1>
        <p style={FF} className="mt-3 max-w-[420px] text-[15px] leading-relaxed text-[#001161]/70">
          {load.status === 'error' ? load.message : ''} Zkontrolujte, že máte celý odkaz, nebo napište na
          hello@vividbooks.com.
        </p>
      </div>
    );
  }

  const docLabel = SKOLENI_KIND_LABEL[skoleni.kind];
  const canSubmit = name.trim().length > 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && (!needBirth || !!birthDateIso);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    setError('');
    try {
      await call(`${encodeURIComponent(token)}/vydat`, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        birthDateIso,
      });
      setIssued(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-12 sm:py-16">
      {seo}
      <div className="mx-auto max-w-[560px] text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#001161]/8">
          <Award className="h-7 w-7 text-[#001161]" strokeWidth={1.5} />
        </div>
        <h1 style={COOPER} className="text-[28px] leading-tight text-[#001161] sm:text-[34px]">
          {docLabel} ze školení
        </h1>
        <p style={FF} className="mt-3 text-[16px] font-semibold text-[#001161]">
          {skoleni.title}
        </p>
        <p style={FF} className="mt-1 text-[14px] text-[#001161]/65">
          {formatSkoleniDateCs(skoleni.dateIso)}
          {skoleni.schoolName ? ` · ${skoleni.schoolName}` : ''}
        </p>
      </div>

      {!issued ? (
        <form onSubmit={submit} className="mx-auto mt-8 flex max-w-[440px] flex-col gap-4 text-left" style={FF}>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[#001161]/80">Jméno a příjmení (i s titulem)</span>
            <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[#001161]/80">E-mail</span>
            <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            {skoleni.restricted ? (
              <span className="mt-1 block text-[12px] text-[#001161]/55">
                Použijte e-mail, pod kterým vás škola na školení nahlásila.
              </span>
            ) : null}
          </label>
          {needBirth ? (
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[#001161]/80">Datum narození</span>
              <input className={INPUT} type="date" value={birthDateIso} onChange={(e) => setBirthDateIso(e.target.value)} required />
              <span className="mt-1 block text-[12px] text-[#001161]/55">Uvádí se na osvědčení, aby šlo přiřadit ke konkrétní osobě.</span>
            </label>
          ) : null}
          {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="mt-2 w-full rounded-xl bg-[#001161] px-6 py-3 text-[15px] font-bold text-white shadow-lg shadow-[#001161]/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Připravuji…' : 'Zobrazit certifikát'}
          </button>
        </form>
      ) : (
        <div className="mt-8 text-center" style={FF}>
          <CertificatePreview srcDoc={html} className="mx-auto" />
          <button
            type="button"
            onClick={() => setPopupBlocked(!printCertificateHtml(html))}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-[#001161] px-6 py-3 text-[14px] font-bold text-white shadow-lg shadow-[#001161]/20 transition hover:scale-[1.02]"
          >
            <Download className="h-4 w-4 shrink-0" />
            Stáhnout PDF
          </button>
          <p className="mt-3 text-[12px] text-[#001161]/55">
            V okně tisku zvolte „Uložit jako PDF“ a ponechte A4 na šířku.
          </p>
          {popupBlocked ? (
            <p className="mt-2 text-[13px] text-red-600">Prohlížeč zablokoval nové okno. Povolte pro tuto stránku vyskakovací okna a zkuste to znovu.</p>
          ) : null}
          <button
            type="button"
            onClick={() => setIssued(false)}
            className="mt-4 text-[13px] font-semibold text-[#001161]/55 underline-offset-2 hover:text-[#001161] hover:underline"
          >
            Opravit údaje
          </button>
        </div>
      )}
    </div>
  );
}
