/**
 * /knihovna/prihlaseni — vyžádání magic linku a jeho ověření (?token=).
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { dvppApi } from '../../utils/dvppApi';
import { DvppButton, DvppCard, DvppShell } from './DvppShell';
import { useDvppSession } from './DvppSession';

export function DvppLoginPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { me, setMe } = useDvppSession();
  const token = sp.get('token') || '';
  const next = sp.get('next') || '/knihovna';
  const code = sp.get('code') || '';

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [newsletter, setNewsletter] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [verifyState, setVerifyState] = useState<'idle' | 'verifying' | 'error'>(token ? 'verifying' : 'idle');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await dvppApi.verify(token);
        if (cancelled) return;
        setMe(r.me);
        const target = r.firstLogin && !r.me.profileDone ? `/kviz?next=${encodeURIComponent(r.next)}` : r.next;
        navigate(target, { replace: true, state: { joined: r.joined } });
      } catch (e) {
        if (!cancelled) { setVerifyState('error'); setError(e instanceof Error ? e.message : 'Odkaz nefunguje.'); }
      }
    })();
    return () => { cancelled = true; };
  }, [token, navigate, setMe]);

  useEffect(() => {
    if (me && !token) navigate(next, { replace: true });
  }, [me, token, next, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await dvppApi.requestMagicLink({ email, name, next, newsletter, staffroomCode: code || null });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se odeslat.');
    } finally {
      setSending(false);
    }
  };

  return (
    <DvppShell title="Přihlášení do knihovny" description="Přihlaste se e-mailem do knihovny DVPP zdarma. Bez hesla, odkaz přijde do minuty." path="/knihovna/prihlaseni">
      <div className="mx-auto max-w-[520px]">
        {verifyState === 'verifying' ? (
          <DvppCard className="text-center">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#001161]" />
            <p className="text-[16px] font-semibold text-[#001161]">Přihlašujeme vás…</p>
          </DvppCard>
        ) : sent ? (
          <DvppCard className="text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-[#1f7a4d]" />
            <h1 className="mb-2 text-[24px] font-extrabold text-[#001161]">Odkaz je na cestě</h1>
            <p className="mb-4 text-[15px] text-[#3a4270]">Do minuty vám přijde e-mail na <strong>{email}</strong>. Kliknutím na tlačítko v něm se přihlásíte. Odkaz platí 24 hodin.</p>
            <p className="text-[13px] text-[#6b7398]">Nepřišel? Zkontrolujte hromadné zprávy nebo spam. Školní schránky někdy zdrží doručení o pár minut.</p>
          </DvppCard>
        ) : (
          <DvppCard>
            <h1 className="mb-1 text-[26px] font-extrabold leading-tight text-[#001161]">Přihlášení bez hesla</h1>
            <p className="mb-5 text-[15px] text-[#3a4270]">Zadejte e-mail a my vám pošleme přihlašovací odkaz. Žádné heslo, žádná registrace navíc.</p>
            {verifyState === 'error' && error ? (
              <p className="mb-4 rounded-xl bg-[#fde9df] px-4 py-3 text-[14px] text-[#8a3a1f]">{error} Vyžádejte si nový odkaz níže.</p>
            ) : null}
            {code ? (
              <p className="mb-4 rounded-xl bg-[#efe8ff] px-4 py-3 text-[14px] text-[#3a2470]">Po přihlášení vás přidáme do sborovny s kódem <strong>{code}</strong>.</p>
            ) : null}
            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[13px] font-semibold text-[#001161]">E-mail</span>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="jana.novakova@zsmilovice.cz"
                  className="w-full rounded-xl border border-[#001161]/15 bg-white px-4 py-3 text-[15px] outline-none focus:border-[#001161]"
                />
                <span className="mt-1 block text-[12px] text-[#6b7398]">Školní e-mail nám pomůže poznat vaši školu. Soukromý funguje taky.</span>
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-semibold text-[#001161]">Jméno a příjmení <span className="font-normal text-[#6b7398]">(na osvědčení)</span></span>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Jana Nováková"
                  className="w-full rounded-xl border border-[#001161]/15 bg-white px-4 py-3 text-[15px] outline-none focus:border-[#001161]"
                />
              </label>
              <label className="flex items-start gap-2 text-[13px] text-[#3a4270]">
                <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-0.5" />
                <span>Chci dostávat týdenní přehled nových záznamů a termínů webinářů. Odhlásit se jde jedním klikem.</span>
              </label>
              {error && verifyState !== 'error' ? <p className="text-[13px] text-[#b3261e]">{error}</p> : null}
              <DvppButton type="submit" disabled={sending} className="w-full">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Poslat přihlašovací odkaz
              </DvppButton>
              <p className="text-[12px] leading-relaxed text-[#6b7398]">
                Odesláním souhlasíte se zpracováním údajů pro vedení účtu a vystavování osvědčení (Vividbooks s.r.o.). Podrobnosti v <a href="https://www.vividbooks.com/kontakt" className="text-[#001161]">zásadách ochrany údajů</a>.
              </p>
            </form>
          </DvppCard>
        )}
        <p className="mt-6 text-center text-[13px] text-[#6b7398]">
          Nový tady? Podívejte se nejdřív, <Link to="/knihovna" className="text-[#001161]">co v knihovně je</Link>.
        </p>
      </div>
    </DvppShell>
  );
}
