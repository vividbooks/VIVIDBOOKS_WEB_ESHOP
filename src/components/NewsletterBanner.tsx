import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const ff = "'Fenomen Sans', sans-serif";

const BENEFITS = [
  'Nové tituly dřív než ostatní',
  'Metodické tipy přímo do výuky',
  'Exkluzivní slevy jen pro odběratele',
  'Pozvánky na webináře zdarma',
];

export function NewsletterBanner() {
  const [email, setEmail]     = useState('');
  const [state, setState]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || state === 'loading') return;
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/newsletter/subscribe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ email: email.trim(), source: 'homepage-banner' }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Chyba');
      setState('success');
    } catch (err: any) {
      console.error('[newsletter] error:', err);
      setErrorMsg(err.message ?? 'Něco se pokazilo, zkuste to znovu.');
      setState('error');
    }
  };

  return (
    <section className="px-4 md:px-8 py-8">
      <div
        className="rounded-[24px] px-8 md:px-14 py-10 md:py-12 flex flex-col lg:flex-row items-center gap-10 lg:gap-14"
        style={{ background: '#0F1B6B' }}
      >
        {/* ── Levá strana ── */}
        <div className="flex-1 text-center lg:text-left">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 mb-5 border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-[#E8942A]" />
            <span className="text-white/75 text-[12px] font-bold" style={{ fontFamily: ff }}>
              {'Newsletter pro učitele'}
            </span>
          </div>

          <h2
            className="text-white text-[28px] md:text-[36px] xl:text-[42px] font-black leading-tight mb-3"
            style={{ fontFamily: ff }}
          >
            {'Buďte první,'}
            <br />
            <span style={{ color: '#E8942A' }}>{'kdo se dozví novinky'}</span>
          </h2>

          <p className="text-white/55 text-[14px] md:text-[15px] leading-relaxed mb-6" style={{ fontFamily: ff }}>
            {'Pravidelně. Žádný spam. Jen to, co vám ve výuce opravdu pomůže.'}
          </p>

          {/* Benefity */}
          <ul className="flex flex-col gap-2.5 mb-7 text-left">
            {BENEFITS.map(b => (
              <li key={b} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#E8942A]/25 border border-[#E8942A]/50 flex items-center justify-center shrink-0">
                  <svg className="w-2.5 h-2.5 text-[#E8942A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-white/75 text-[13px] md:text-[14px]" style={{ fontFamily: ff }}>{b}</span>
              </li>
            ))}
          </ul>

          {/* Social proof — bez fotek */}
          <p className="text-white/40 text-[13px]" style={{ fontFamily: ff }}>
            {'Odebírá přes '}
            <span className="text-white/80 font-bold">{'25 000'}</span>
            {' progresivních učitelů'}
          </p>
        </div>

        {/* ── Pravá strana — formulář ── */}
        <div className="w-full lg:w-[360px] shrink-0">
          <div
            className="rounded-[20px] p-6 md:p-8"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.13)',
            }}
          >
            {state === 'success' ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-green-400" />
                </div>
                <p className="text-white text-[19px] font-black mb-2" style={{ fontFamily: ff }}>
                  {'Výborně! Jste přihlášeni.'}
                </p>
                <p className="text-white/50 text-[13px] leading-relaxed" style={{ fontFamily: ff }}>
                  {'Brzy se ozveme s tipy, které ve výuce opravdu fungují.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <p className="text-white text-[17px] font-black mb-0.5" style={{ fontFamily: ff }}>
                  {'Přihlaste se zdarma'}
                </p>
                <p className="text-white/45 text-[13px] mb-1 leading-snug" style={{ fontFamily: ff }}>
                  {'Stačí váš pracovní e-mail — zbytek zařídíme my.'}
                </p>

                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={'vas@skola.cz'}
                  className="w-full rounded-xl px-5 py-4 text-[15px] text-[#001161] placeholder:text-[#001161]/35 focus:outline-none bg-white"
                  style={{ fontFamily: ff }}
                />

                <button
                  type="submit"
                  disabled={state === 'loading' || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white text-[15px] font-black transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  style={{ background: '#E8942A', fontFamily: ff }}
                >
                  {state === 'loading' ? 'Přihlašuji…' : (
                    <>
                      {'Chci dostávat novinky'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {state === 'error' && (
                  <p className="text-red-300 text-[12px] text-center" style={{ fontFamily: ff }}>{errorMsg}</p>
                )}

                <div className="flex items-center justify-center gap-2 pt-0.5 text-white/30 text-[11px]" style={{ fontFamily: ff }}>
                  <span>{'Bez spamu'}</span>
                  <span>·</span>
                  <span>{'Odhlásit kdykoliv'}</span>
                  <span>·</span>
                  <span>{'GDPR'}</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
