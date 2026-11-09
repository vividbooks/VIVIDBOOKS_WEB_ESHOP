import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2 } from 'lucide-react';
import { SEOHead } from './SEOHead';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const ff = "'Fenomen Sans', sans-serif";
const ENDPOINT = `https://${projectId}.supabase.co/functions/v1/make-server-93a20b6f/newsletter/unsubscribe`;

type State = 'idle' | 'loading' | 'done' | 'error';

/**
 * Odhlášení z newsletteru – náhrada původní stránky z Webflow (`/cs/odhlaseni-z-newsletteru`).
 * S `?token=` (odkaz z e-mailu) stačí potvrdit tlačítkem, bez tokenu se zadává e-mail ručně.
 */
export function NewsletterUnsubscribePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = (params.get('token') || '').trim();
  const [useToken, setUseToken] = useState(Boolean(token));
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const [doneEmail, setDoneEmail] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'loading') return;
    if (!useToken && !email.trim()) return;
    setState('loading');
    setMessage('');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify(useToken ? { token } : { email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (useToken) setUseToken(false);
        throw new Error(data?.error || 'Odhlášení se nepodařilo. Zkuste to prosím později.');
      }
      setDoneEmail(String(data?.email || email.trim()));
      setState('done');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Odhlášení se nepodařilo. Zkuste to prosím později.');
      setState('error');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4 py-16">
      <SEOHead
        title="Odhlášení z newsletteru"
        noIndex={true}
        description="Odhlášení z odběru novinek Vividbooks."
      />
      <div className="w-full max-w-[460px] bg-white rounded-[20px] p-8 sm:p-10 text-center shadow-[0_4px_24px_rgba(0,17,97,0.08)]">
        {state === 'done' ? (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-4" />
            <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] leading-tight mb-3">
              Jste odhlášeni
            </h1>
            <p className="text-[#001161]/70 text-[15px] leading-relaxed mb-6" style={{ fontFamily: ff }}>
              {doneEmail ? `Adresa ${doneEmail} už nebude dostávat` : 'Už vám nebudeme posílat'} novinky
              a nabídky Vividbooks. E-maily k objednávkám a webinářům, na které jste přihlášeni, chodí dál.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center bg-[#001161] text-white px-6 py-3 rounded-[14px] text-[15px] font-bold cursor-pointer hover:bg-[#000a3d] transition-colors"
              style={{ fontFamily: ff }}
            >
              Přejít na Vividbooks
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[28px] leading-tight mb-3">
              Odhlášení z newsletteru
            </h1>
            <p className="text-[#001161]/70 text-[15px] leading-relaxed mb-6" style={{ fontFamily: ff }}>
              {useToken
                ? 'Kliknutím níže odhlásíte svou adresu z odběru novinek Vividbooks.'
                : 'Zadejte e-mail, na který vám chodí novinky Vividbooks, a my ho z odběru odhlásíme.'}
            </p>
            {!useToken && (
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Váš e-mail *"
                aria-label="E-mail"
                className="w-full mb-3 px-4 py-3 rounded-[12px] border border-[#001161]/15 text-[15px] text-[#001161] text-center outline-none focus:border-[#001161]/40"
                style={{ fontFamily: ff }}
              />
            )}
            {message && (
              <p role="alert" className="text-red-600 text-[14px] mb-3" style={{ fontFamily: ff }}>
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={state === 'loading'}
              className="w-full bg-[#001161] text-white px-6 py-3 rounded-[14px] text-[15px] font-bold cursor-pointer hover:bg-[#000a3d] transition-colors disabled:opacity-60"
              style={{ fontFamily: ff }}
            >
              {state === 'loading' ? 'Počkejte prosím…' : 'Odhlásit'}
            </button>
            <p className="text-[#001161]/50 text-[13px] mt-5" style={{ fontFamily: ff }}>
              Nedaří se to? Napište nám na{' '}
              <a href="mailto:hello@vividbooks.com" className="underline">hello@vividbooks.com</a>.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
