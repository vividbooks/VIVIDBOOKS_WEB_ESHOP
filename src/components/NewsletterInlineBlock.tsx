import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const ff = "'Fenomen Sans', sans-serif";

const TEAM_IMGS = [
  'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/68499506e61fe43631528e42_gabriela-vividbooks.avif',
  'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/66b10b0f591597464fe410a0_obchodni-zastupce-vividbooks-iveta-fiserova.webp',
  'https://cdn.prod.website-files.com/5dfa34b974e1f6e9cbef33b5/66b10b0fed611ead6c658025_obchodni-zastupce-vividbooks-eva-bukolska.webp',
];

interface Props {
  /** Identifikuje odkud se přihlásil — ukládá se do DB */
  source?: string;
  /** Kompaktní varianta pro sidebar / inline v článku */
  compact?: boolean;
}

export function NewsletterInlineBlock({ source = 'unknown', compact = false }: Props) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
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
          body: JSON.stringify({ email: email.trim(), source }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Chyba');
      setState('success');
    } catch (err: any) {
      console.error('[newsletter] error:', err);
      setErrorMsg(err.message ?? 'Něco se pokazilo');
      setState('error');
    }
  };

  if (compact) {
    /* ── Kompaktní varianta (sidebar, mezi kartami) ── */
    return (
      <div
        className="rounded-[18px] p-5 border border-[#E8942A]/20"
        style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FEF3C7 100%)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-[#E8942A]" />
          <p className="text-[#001161] text-[14px] font-bold" style={{ fontFamily: ff }}>
            {'Novinky do schránky'}
          </p>
        </div>
        <p className="text-[#001161]/65 text-[12px] leading-snug mb-4" style={{ fontFamily: ff }}>
          {'Jednou m\u011bs\u00ed\u010dn\u011b: nov\u00e9 tituly, tipy do v\u00fduk y a slevy.'}
        </p>

        <AnimatePresence mode="wait">
          {state === 'success' ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-green-700 text-[13px]" style={{ fontFamily: ff }}>
                {'P\u0159ihlášeno!'}
              </span>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={handleSubmit} className="flex flex-col gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={'V\u00e1\u0161 e-mail'}
                className="w-full bg-white rounded-xl px-3.5 py-2.5 text-[13px] text-[#001161] placeholder:text-[#001161]/30 border border-[#001161]/10 focus:border-[#E8942A] focus:outline-none transition-colors"
                style={{ fontFamily: ff }}
              />
              <button
                type="submit"
                disabled={state === 'loading'}
                className="w-full py-2.5 rounded-xl bg-[#E8942A] hover:bg-[#d4831f] text-white text-[13px] font-bold transition-all cursor-pointer active:scale-[0.98] disabled:opacity-60"
                style={{ fontFamily: ff }}
              >
                {state === 'loading' ? 'Odesílám…' : 'Odebírat'}
              </button>
              {state === 'error' && (
                <p className="text-red-500 text-[11px]" style={{ fontFamily: ff }}>{errorMsg}</p>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ── Plná varianta (přehledy, konce stránek) ── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45 }}
      className="rounded-[28px] px-8 md:px-14 py-10 md:py-12 flex flex-col md:flex-row items-center gap-8 md:gap-12"
      style={{
        background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFBEB 60%, #F5F3FF 100%)',
        border: '1px solid rgba(232,148,42,0.18)',
        boxShadow: '0 4px 32px rgba(0,17,97,0.06)',
      }}
    >
      {/* Levá strana */}
      <div className="flex-1 text-center md:text-left">
        {/* Avatary */}
        <div className="flex -space-x-2 justify-center md:justify-start mb-4">
          {TEAM_IMGS.map((src, i) => (
            <div
              key={i}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-white"
              style={{ boxShadow: '0 1px 4px rgba(0,17,97,0.12)', zIndex: TEAM_IMGS.length - i }}
            >
              <img src={src} alt="Tým Vividbooks" className="w-full h-full object-cover object-top" />
            </div>
          ))}
          <div
            className="w-10 h-10 rounded-full bg-[#E8942A] flex items-center justify-center border-2 border-white text-white text-[11px] font-bold"
            style={{ fontFamily: ff }}
          >
            +2
          </div>
        </div>

        <h3
          className="text-[#001161] text-[22px] md:text-[26px] font-black leading-tight mb-2"
          style={{ fontFamily: ff }}
        >
          {'P\u0159ihlaste se k odb\u011bru novinek'}
        </h3>
        <p className="text-[#001161]/60 text-[14px] md:text-[15px] leading-relaxed" style={{ fontFamily: ff }}>
          {'Jednou m\u011bs\u00ed\u010dn\u011b p\u00eds\u00e1me u\u010ditel\u016fm o nov\u00fdch titulech, metodick\u00fdch tipech a akcích.'}
          <br />
          <span className="text-[#001161]/40 text-[13px]">{'Bez spamu. Odhlásit se m\u016f\u017eete kdykoliv.'}</span>
        </p>
      </div>

      {/* Pravá strana — formulář */}
      <div className="w-full md:w-[320px] flex-shrink-0">
        <AnimatePresence mode="wait">
          {state === 'success' ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl px-6 py-8 text-center"
              style={{ boxShadow: '0 2px 12px rgba(0,17,97,0.07)' }}
            >
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-[#001161] text-[17px] font-bold mb-1" style={{ fontFamily: ff }}>
                {'Super! Jste p\u0159ihlášeni.'}
              </p>
              <p className="text-[#001161]/50 text-[13px]" style={{ fontFamily: ff }}>
                {'První e-mail dorazí do m\u011bs\u00edce. \u0160koda, \u017ee d\u0159\u00edv.'}
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-3"
            >
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={'V\u00e1\u0161 e-mail *'}
                className="w-full bg-white rounded-2xl px-5 py-4 text-[15px] text-[#001161] placeholder:text-[#001161]/30 border border-[#001161]/10 focus:border-[#E8942A] focus:ring-2 focus:ring-[#E8942A]/15 focus:outline-none transition-all"
                style={{ fontFamily: ff, boxShadow: '0 1px 6px rgba(0,17,97,0.05)' }}
              />
              <button
                type="submit"
                disabled={state === 'loading' || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white text-[15px] font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                style={{ background: '#E8942A', fontFamily: ff, boxShadow: '0 4px 16px rgba(232,148,42,0.30)' }}
              >
                {state === 'loading' ? 'Odesílám…' : (
                  <>
                    {'Chci dostávat novinky'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              {state === 'error' && (
                <p className="text-red-500 text-[12px] text-center" style={{ fontFamily: ff }}>{errorMsg}</p>
              )}
              <p className="text-[#001161]/30 text-[11px] text-center" style={{ fontFamily: ff }}>
                {'Odesláním souhlasíte se zpracováním e-mailu za ú\u010delem zasílání novinek.'}
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
