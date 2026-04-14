/**
 * PopupRenderer — globální renderer aktivních popupů.
 * Načte aktivní popupy ze serveru, registruje triggery
 * a zobrazuje je jako modální okna s animacemi.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, CheckCircle2, Radio } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import type { PopupData } from './admin/PopupManager';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f`;
const ff = "'Fenomen Sans', sans-serif";
const STORAGE_PREFIX = 'vvb_popup_';

/* ── Helpers ──────────────────────────────────────────────────── */
function getCooldownKey(id: string) { return `${STORAGE_PREFIX}${id}_closed`; }
function getSessionKey(id: string)  { return `${STORAGE_PREFIX}${id}_session`; }

function isCooledDown(popup: PopupData): boolean {
  try {
    const val = localStorage.getItem(getCooldownKey(popup.id));
    if (!val) return false;
    const closedAt = Number(val);
    const msSince = Date.now() - closedAt;
    return msSince < popup.cooldownDays * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

function sessionCount(id: string): number {
  try { return Number(sessionStorage.getItem(getSessionKey(id)) ?? '0'); }
  catch { return 0; }
}

function incrementSession(id: string) {
  try { sessionStorage.setItem(getSessionKey(id), String(sessionCount(id) + 1)); }
  catch { /* noop */ }
}

function matchesPage(popup: PopupData, pathname: string): boolean {
  const pages = popup.pages ?? ['*'];
  return pages.some(pattern => {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) return pathname.startsWith(pattern.slice(0, -1));
    return pathname === pattern;
  });
}

async function trackStat(id: string, event: 'shown' | 'converted') {
  try {
    await fetch(`${SERVER}/popups/${id}/stat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ event }),
    });
  } catch { /* noop */ }
}

/* ── Popup content by type ────────────────────────────────────── */
function PopupContent({ popup, onClose, onConvert }: { popup: PopupData; onClose: () => void; onConvert: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [nlState, setNlState] = useState<'idle' | 'loading' | 'done'>('idle');
  const { type, content } = popup;

  const handleNLSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setNlState('loading');
    try {
      await fetch(`${SERVER}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ email: email.trim(), source: `popup-${popup.id}` }),
      });
      setNlState('done');
      onConvert();
    } catch { setNlState('done'); }
  };

  const handleCTA = () => {
    const url = type === 'webinar' ? (content.webinarUrl ?? content.ctaUrl ?? '/webinare') : (content.ctaUrl ?? '/');
    onConvert();
    onClose();
    if (url.startsWith('http')) { window.open(url, '_blank'); }
    else { navigate(url); }
  };

  // Type color
  const typeColor: Record<string, string> = {
    newsletter: '#E8942A', cta: '#7C3AED', announcement: '#0EA5E9', webinar: '#10B981',
  };
  const accent = typeColor[type] ?? '#E8942A';

  return (
    <div className="relative bg-white rounded-[28px] overflow-hidden w-full max-w-[400px] mx-4"
      style={{ boxShadow: '0 24px 80px rgba(0,17,97,0.22)' }}>
      {/* Top accent stripe */}
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)` }} />

      {/* Close button */}
      <button onClick={onClose}
        className="absolute top-4 right-4 w-7 h-7 rounded-full bg-[#001161]/6 flex items-center justify-center hover:bg-[#001161]/12 transition-colors cursor-pointer z-10">
        <X className="w-3.5 h-3.5 text-[#001161]/60" />
      </button>

      <div className="px-7 pt-6 pb-7">
        {/* Badge */}
        {content.badge && (
          <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full mb-3"
            style={{ background: `${accent}18`, color: accent, fontFamily: ff }}>
            {content.badge}
          </span>
        )}

        {/* Icon row */}
        <div className="flex items-center gap-2 mb-4">
          {type === 'webinar'
            ? <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center"><Radio className="w-5 h-5 text-[#10B981]" /></div>
            : null}
          {content.emoji && <span className="text-[26px] leading-none">{content.emoji}</span>}
        </div>

        {/* Webinar date ribbon */}
        {type === 'webinar' && content.webinarDate && (
          <div className="inline-flex items-center gap-1.5 text-[#10B981] text-[12px] font-bold mb-2 bg-[#ECFDF5] px-3 py-1.5 rounded-full"
            style={{ fontFamily: ff }}>
            📅 {content.webinarDate}
          </div>
        )}

        <h3 className="text-[#001161] text-[20px] font-black leading-snug mb-2" style={{ fontFamily: ff }}>
          {content.headline}
        </h3>
        <p className="text-[#001161]/60 text-[14px] leading-relaxed mb-5" style={{ fontFamily: ff }}>
          {content.body}
        </p>

        {/* Newsletter form */}
        {type === 'newsletter' && (
          <AnimatePresence mode="wait">
            {nlState === 'done' ? (
              <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 bg-[#F0FDF4] rounded-2xl px-4 py-4">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-[14px] font-bold text-[#001161]" style={{ fontFamily: ff }}>{'Přihlásili jste se!'}</p>
                  <p className="text-[12px] text-[#001161]/50" style={{ fontFamily: ff }}>{'První e-mail dorazí brzy.'}</p>
                </div>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={handleNLSubmit} className="space-y-2.5">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={'Váš e-mail'}
                  className="w-full bg-[#F7F8FC] rounded-2xl px-4 py-3.5 text-[14px] text-[#001161] placeholder:text-[#001161]/30 border border-[#001161]/8 focus:border-[#E8942A] focus:outline-none transition-colors"
                  style={{ fontFamily: ff }} />
                <button type="submit" disabled={nlState === 'loading' || !email.trim()}
                  className="w-full py-3.5 rounded-2xl text-white text-[14px] font-bold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  style={{ background: accent, fontFamily: ff, boxShadow: `0 4px 16px ${accent}40` }}>
                  {nlState === 'loading' ? 'Odesílám...' : (
                    <>{content.ctaLabel || 'Přihlásit se k odběru'} <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
                <p className="text-[10px] text-[#001161]/30 text-center" style={{ fontFamily: ff }}>
                  {'Bez spamu. Odhlásit se lze kdykoliv.'}
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        )}

        {/* CTA / Announcement / Webinar button */}
        {(type === 'cta' || type === 'announcement' || type === 'webinar') && content.ctaLabel && (
          <button onClick={handleCTA}
            className="w-full py-3.5 rounded-2xl text-white text-[14px] font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: accent, fontFamily: ff, boxShadow: `0 4px 16px ${accent}40` }}>
            {content.ctaLabel} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Main Renderer ────────────────────────────────────────────── */
export function PopupRenderer() {
  const location = useLocation();
  const [allPopups, setAllPopups] = useState<PopupData[]>([]);
  const [activePopup, setActivePopup] = useState<PopupData | null>(null);
  const triggerCleanups = useRef<(() => void)[]>([]);
  const isCheckoutFlow =
    location.pathname === '/objednat'
    || location.pathname === '/pokladna'
    || location.pathname === '/platit'
    || location.pathname === '/objednavka/dekujeme';

  // Load active popups on mount
  useEffect(() => {
    fetch(`${SERVER}/popups/active`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => r.json())
      .then(({ popups }) => setAllPopups(popups ?? []))
      .catch(e => console.warn('[PopupRenderer] load failed:', e));
  }, []);

  const showPopup = useCallback((popup: PopupData) => {
    if (activePopup) return; // one at a time
    if (isCooledDown(popup)) return;
    if (sessionCount(popup.id) >= (popup.maxPerSession ?? 1)) return;
    incrementSession(popup.id);
    trackStat(popup.id, 'shown');
    setActivePopup(popup);
  }, [activePopup]);

  // Set up triggers for current page
  useEffect(() => {
    // cleanup old triggers
    triggerCleanups.current.forEach(fn => fn());
    triggerCleanups.current = [];

    if (isCheckoutFlow) {
      setActivePopup(null);
      return;
    }

    if (!allPopups.length) return;

    const eligible = allPopups.filter(p =>
      p.active && matchesPage(p, location.pathname) && !isCooledDown(p)
    );

    eligible.forEach(popup => {
      const t = popup.trigger;

      if (t === 'immediate') {
        const id = setTimeout(() => showPopup(popup), 300);
        triggerCleanups.current.push(() => clearTimeout(id));

      } else if (t === 'time_5s' || t === 'time_10s' || t === 'time_20s') {
        const ms = t === 'time_5s' ? 5000 : t === 'time_10s' ? 10000 : 20000;
        const id = setTimeout(() => showPopup(popup), ms);
        triggerCleanups.current.push(() => clearTimeout(id));

      } else if (t === 'scroll_30' || t === 'scroll_50') {
        const threshold = t === 'scroll_30' ? 0.30 : 0.50;
        let fired = false;
        const handler = () => {
          if (fired) return;
          const scrolled = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
          if (scrolled >= threshold) { fired = true; showPopup(popup); }
        };
        window.addEventListener('scroll', handler, { passive: true });
        triggerCleanups.current.push(() => window.removeEventListener('scroll', handler));

      } else if (t === 'exit_intent') {
        let fired = false;
        const handler = (e: MouseEvent) => {
          if (fired || e.clientY > 5) return;
          fired = true; showPopup(popup);
        };
        document.documentElement.addEventListener('mouseleave', handler);
        triggerCleanups.current.push(() => document.documentElement.removeEventListener('mouseleave', handler));
      }
    });

    return () => { triggerCleanups.current.forEach(fn => fn()); };
  }, [allPopups, isCheckoutFlow, location.pathname, showPopup]);

  const handleClose = () => {
    if (activePopup) {
      try { localStorage.setItem(getCooldownKey(activePopup.id), String(Date.now())); }
      catch { /* noop */ }
    }
    setActivePopup(null);
  };

  const handleConvert = () => {
    if (activePopup) trackStat(activePopup.id, 'converted');
  };

  return (
    <AnimatePresence>
      {!isCheckoutFlow && activePopup && (
        <motion.div
          key={activePopup.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,17,97,0.45)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{ width: '100%', maxWidth: 400 }}
          >
            <PopupContent popup={activePopup} onClose={handleClose} onConvert={handleConvert} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
