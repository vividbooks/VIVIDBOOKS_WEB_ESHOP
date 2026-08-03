import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { SEOHead } from './SEOHead';
import { useVividbooksPresence } from '@/lib/vividbooksPresence';
import {
  APP_ENTRY_RESET_PARAM,
  appEntryTargetUrl,
  forgetAppEntryChoice,
  readAppEntryChoice,
  rememberAppEntryChoice,
  type AppEntryChoice,
} from '@/lib/appEntryChoice';

const FF = { fontFamily: "'Fenomen Sans', sans-serif" } as const;

const CHOICE_LABEL: Record<AppEntryChoice, string> = {
  nova: 'novou aplikaci',
  puvodni: 'původní aplikaci',
};

/**
 * Rozcestník mezi novou a původní aplikací. Web na něj odkazuje místo toho, aby si sám
 * vybíral — obě verze po spuštění nové aplikace běží souběžně.
 */
export function OtevritAplikaciPage() {
  const [searchParams] = useSearchParams();
  const forceChoice = searchParams.get(APP_ENTRY_RESET_PARAM) !== null;

  /** Zapamatovanou volbu čteme hned při prvním renderu, ať rozcestník zbytečně neproblikne. */
  const [forwardingTo] = useState<AppEntryChoice | null>(() =>
    forceChoice ? null : readAppEntryChoice(),
  );
  const [remember, setRemember] = useState(true);
  const presence = useVividbooksPresence();

  useEffect(() => {
    if (!forwardingTo) return;
    window.location.replace(appEntryTargetUrl(forwardingTo));
  }, [forwardingTo]);

  const handleChoose = useCallback(
    (choice: AppEntryChoice) => {
      if (remember) {
        rememberAppEntryChoice(choice);
      } else {
        forgetAppEntryChoice();
      }
    },
    [remember],
  );

  if (forwardingTo) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-20 text-center">
        <SEOHead title="Otevřít aplikaci" path="/otevrit" noIndex />
        <div>
          <p style={FF} className="text-[15px] text-[#001161]/70">
            {`Otevíráme ${CHOICE_LABEL[forwardingTo]}…`}
          </p>
          <a
            href={appEntryTargetUrl(forwardingTo)}
            style={FF}
            className="mt-3 inline-block text-[14px] font-semibold text-[#5139ed] underline underline-offset-2"
          >
            {'Pokračovat ručně'}
          </a>
          <div className="mt-6">
            <Link
              to={`/otevrit?${APP_ENTRY_RESET_PARAM}=1`}
              style={FF}
              className="text-[13px] text-[#001161]/50 underline underline-offset-2 hover:text-[#001161]"
            >
              {'Vybrat jinou aplikaci'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen px-6 md:px-10 py-14"
    >
      <SEOHead title="Otevřít aplikaci" path="/otevrit" noIndex />

      <div className="max-w-[880px] mx-auto">
        <header className="text-center mb-10">
          <h1 className="font-['Cooper_Light',serif] text-[#001161] text-[32px] md:text-[40px] leading-tight mb-3">
            {'Kterou aplikaci otevřít?'}
          </h1>
          <p style={FF} className="text-[#001161]/60 text-[15px] md:text-[16px] max-w-[560px] mx-auto leading-relaxed">
            {'Nová aplikace je tu. Původní zůstává v provozu, takže můžete přejít, až se vám to bude hodit.'}
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <a
            href={appEntryTargetUrl('nova')}
            onClick={() => handleChoose('nova')}
            style={FF}
            className="group flex flex-col rounded-[20px] border-2 border-[#5139ed] bg-white p-7 no-underline shadow-[0_10px_30px_rgba(81,57,237,0.12)] transition-transform hover:scale-[1.01]"
          >
            <span className="self-start rounded-full bg-[#5139ed] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              {'Novinka'}
            </span>
            <h2 className="mt-4 text-[20px] font-bold text-[#001161]">{'Nová aplikace'}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#001161]/70">
              {'Přepracovaná knihovna, vlastní obsah, AI asistent a Moje třída. Všechno pod jedním účtem.'}
            </p>
            {presence ? (
              <p className="mt-3 text-[13px] font-semibold text-[#5139ed]">
                {`Jste přihlášeni jako ${presence.name}`}
              </p>
            ) : null}
            <span className="mt-auto pt-6 inline-flex items-center gap-2 text-[15px] font-bold text-[#5139ed]">
              {'Otevřít novou aplikaci'}
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </a>

          <a
            href={appEntryTargetUrl('puvodni')}
            onClick={() => handleChoose('puvodni')}
            style={FF}
            className="group flex flex-col rounded-[20px] border border-[#001161]/12 bg-white p-7 no-underline transition-transform hover:scale-[1.01]"
          >
            <span className="self-start rounded-full bg-[#001161]/8 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#001161]/60">
              {'Beze změny'}
            </span>
            <h2 className="mt-4 text-[20px] font-bold text-[#001161]">{'Původní aplikace'}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#001161]/70">
              {'Zůstává beze změny. Vaše přípravy i materiály najdete přesně tam, kde jste zvyklí.'}
            </p>
            <span className="mt-auto pt-6 inline-flex items-center gap-2 text-[15px] font-bold text-[#001161]">
              {'Otevřít původní aplikaci'}
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </a>
        </div>

        <label
          style={FF}
          className="mt-8 flex cursor-pointer items-center justify-center gap-2.5 text-[14px] text-[#001161]/70"
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-4 w-4 accent-[#5139ed]"
          />
          {'Zapamatovat si volbu a příště otevřít rovnou'}
        </label>
      </div>
    </motion.div>
  );
}
