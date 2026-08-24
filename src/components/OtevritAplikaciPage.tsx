import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles, CheckCircle2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
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
const COOPER = { fontFamily: "'Cooper Light', serif" } as const;

const CHOICE_LABEL: Record<AppEntryChoice, string> = {
  nova: 'novou aplikaci',
  puvodni: 'původní aplikaci',
};

interface AppFeature {
  icon: React.ReactNode;
  text: string;
}

interface AppImage {
  id: string;
  placeholder: string;
  label: string;
  imageSrc?: string;
}

// Colors from the codebase
const COLORS = {
  NOVA_ACCENT: '#5139ed',
  NOVA_GRADIENT_1: '#5139ed',
  NOVA_GRADIENT_2: '#7C3AED',
  NOVA_GRADIENT_3: '#a89bff',
  NOVA_ACCENT_ALT: '#ff8158',
  PUVODNI_ACCENT: '#001161',
  PUVODNI_GRADIENT_1: '#4a7fd4',
  PUVODNI_GRADIENT_2: '#b8d4f5',
  PUVODNI_ACCENT_ALT: '#FF8C00',
};

const NOVA_IMAGES: AppImage[] = [
  { id: 'nova-1', placeholder: '📚', label: 'Knihovna', imageSrc: '/app-screenshots/nova-1.png' },
  { id: 'nova-2', placeholder: '🎯', label: 'Dashboard', imageSrc: '/app-screenshots/nova-2.png' },
  { id: 'nova-3', placeholder: '✍️', label: 'Editor', imageSrc: '/app-screenshots/nova-3.png' },
  { id: 'nova-4', placeholder: '🤖', label: 'AI Asistent', imageSrc: '/app-screenshots/nova-4.png' },
];

const PUVODNI_IMAGES: AppImage[] = [
  { id: 'puvodni-1', placeholder: '📖', label: 'Přípravy', imageSrc: '/app-screenshots/puvodni-1.png' },
  { id: 'puvodni-2', placeholder: '📝', label: 'Testy', imageSrc: '/app-screenshots/puvodni-2.png' },
];

const NOVA_FEATURES: AppFeature[] = [
  { icon: '📚', text: 'Přepracovaná knihovna s novým designem' },
  { icon: '✍️', text: 'Vlastní obsah a materiály' },
  { icon: '🤖', text: 'AI asistent pro studium' },
  { icon: '👥', text: 'Moje třída a spolupráce' },
  { icon: '⚡', text: 'Rychlejší a modernější' },
  { icon: '🎯', text: 'Lepší uživatelský zážitek' },
];

const PUVODNI_FEATURES: AppFeature[] = [
  { icon: '✓', text: 'Všechny vaše přípravy na místě' },
  { icon: '✓', text: 'Známé rozhraní' },
  { icon: '✓', text: 'Bez nutnosti přechodu' },
];



/**
 * Image Gallery Component for App Cards
 */
function AppImageGallery({ images, accentColor }: { images: AppImage[]; accentColor: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="w-full">
      {/* Main Image Display */}
      <div
        className="w-full aspect-video rounded-[24px] flex items-center justify-center relative overflow-hidden group/img transition-all duration-300"
        style={{
          background: `linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}05 100%)`,
        }}
      >
        {images[currentIndex].imageSrc ? (
          <motion.img
            key={currentIndex}
            src={images[currentIndex].imageSrc}
            alt={images[currentIndex].label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full object-cover"
          />
        ) : (
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center text-center"
          >
            <div className="text-7xl mb-4">{images[currentIndex].placeholder}</div>
            <p style={FF} className="text-[16px] font-semibold" style={{ color: accentColor }}>
              {images[currentIndex].label}
            </p>
          </motion.div>
        )}

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 p-2 rounded-full bg-white/80 hover:bg-white shadow-md"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: accentColor }} />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 p-2 rounded-full bg-white/80 hover:bg-white shadow-md"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" style={{ color: accentColor }} />
            </button>
          </>
        )}
      </div>


    </div>
  );
}

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-6 flex justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-10 h-10 text-[#5139ed]" />
            </motion.div>
          </div>
          <p style={FF} className="text-[15px] text-[#001161]/70">
            {`Otevíráme ${CHOICE_LABEL[forwardingTo]}…`}
          </p>
          <a
            href={appEntryTargetUrl(forwardingTo)}
            style={FF}
            className="mt-3 inline-block text-[14px] font-semibold text-[#5139ed] underline underline-offset-2 hover:text-[#001161]/70 transition-colors"
          >
            {'Pokračovat ručně'}
          </a>
          <div className="mt-6">
            <Link
              to={`/otevrit?${APP_ENTRY_RESET_PARAM}=1`}
              style={FF}
              className="text-[13px] text-[#001161]/50 underline underline-offset-2 hover:text-[#001161] transition-colors"
            >
              {'Vybrat jinou aplikaci'}
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen px-6 md:px-10 py-12 md:py-20 bg-gradient-to-br from-[#f8f9fc] via-white to-[#f0f2f8]"
    >
      <SEOHead title="Otevřít aplikaci" path="/otevrit" noIndex />

      <div className="max-w-[1000px] mx-auto">
        {/* Hero Section */}
        <header className="text-center mb-12 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex items-center justify-center gap-2 mb-4"
          >
            <Sparkles className="w-5 h-5 text-[#5139ed]" />
            <span style={FF} className="text-[12px] md:text-[13px] font-bold uppercase tracking-widest text-[#5139ed]">
              {'Nová generace aplikace'}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={COOPER}
            className="text-[36px] md:text-[52px] lg:text-[64px] leading-tight mb-4 text-[#001161] font-light"
          >
            {'Kterou aplikaci otevřít?'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={FF}
            className="text-[15px] md:text-[17px] text-[#001161]/65 max-w-[620px] mx-auto leading-relaxed"
          >
            {'Obě aplikace běží souběžně. Nová aplikace vám přináší lepší zážitek, původní zůstává dostupná.'}
          </motion.p>
        </header>

        {/* App Selection Grid */}
        <div className="grid gap-6 md:gap-8 md:grid-cols-2 mb-16">
          {/* New App Card - Featured */}
          <motion.a
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            whileHover={{ y: -8 }}
            href={appEntryTargetUrl('nova')}
            onClick={() => handleChoose('nova')}
            style={FF}
            className="group relative flex flex-col overflow-hidden rounded-[32px] bg-white no-underline transition-all duration-300 cursor-pointer shadow-[0_12px_40px_rgba(81,57,237,0.2)] hover:shadow-[0_24px_64px_rgba(81,57,237,0.3)]"
          >
            {/* Accent Bar */}
            <div className="h-3 bg-[#5139ed]" />

            {/* Image Gallery */}
            <div className="px-6 pt-6">
              <AppImageGallery images={NOVA_IMAGES} accentColor={COLORS.NOVA_ACCENT} />
            </div>

            {/* Content */}
            <div className="p-8 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <motion.div
                  animate={{ rotate: [0, 15, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-5 h-5 text-[#5139ed]" />
                </motion.div>
                <span className="inline-block rounded-full bg-[#FF8C00] px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
                  {'Doporučujeme'}
                </span>
              </div>

              <h2 style={COOPER} className="text-[32px] md:text-[36px] font-light text-[#001161] mb-2 leading-tight">
                {'Nová aplikace'}
              </h2>

              <p style={FF} className="text-[15px] leading-relaxed text-[#001161]/70 mb-6 flex-grow">
                {'Moderní a intuitivní design. Všechny funkce na jednom místě. Speciálně navržena pro vás.'}
              </p>

              {/* User Info */}
              {presence ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.8 }}
                  className="mb-6 flex items-center gap-2 p-3 rounded-[12px] bg-[#5139ed]/8 border border-[#5139ed]/20"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#5139ed] flex-shrink-0" />
                  <p style={FF} className="text-[13px] font-semibold text-[#5139ed]">
                    {`Přihlášeni: ${presence.name}`}
                  </p>
                </motion.div>
              ) : null}

              {/* CTA */}
              <button
                onClick={() => handleChoose('nova')}
                className="w-full py-4 px-6 bg-gradient-to-r from-[#5139ed] to-[#7C3AED] text-white font-bold rounded-[14px] inline-flex items-center justify-center gap-2 group/btn transition-all duration-300 hover:shadow-[0_12px_32px_rgba(81,57,237,0.3)] active:scale-95"
              >
                {'Otevřít novou aplikaci'}
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.a>

          {/* Original App Card */}
          <motion.a
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            whileHover={{ y: -8 }}
            href={appEntryTargetUrl('puvodni')}
            onClick={() => handleChoose('puvodni')}
            style={FF}
            className="group relative flex flex-col overflow-hidden rounded-[32px] bg-white no-underline transition-all duration-300 cursor-pointer shadow-[0_8px_24px_rgba(0,17,97,0.12)] hover:shadow-[0_16px_40px_rgba(0,17,97,0.18)]"
          >
            {/* Accent Bar */}
            <div className="h-2 bg-[#cbd5e1]" />

            {/* Image Gallery */}
            <div className="px-6 pt-6">
              <AppImageGallery images={PUVODNI_IMAGES} accentColor={COLORS.PUVODNI_ACCENT} />
            </div>

            {/* Content */}
            <div className="p-8 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-[#64748b]" />
                <span className="inline-block rounded-full bg-[#e2e8f0] px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                  {'Beze změny'}
                </span>
              </div>

              <h2 style={COOPER} className="text-[32px] md:text-[36px] font-light text-[#001161] mb-2 leading-tight">
                {'Původní aplikace'}
              </h2>

              <p style={FF} className="text-[15px] leading-relaxed text-[#001161]/70 mb-6 flex-grow">
                {'Vyzkoušená a spolehlivá. Všechny vaše přípravy a materiály jsou zde, kde jste zvyklí.'}
              </p>

              {/* CTA */}
              <button
                onClick={() => handleChoose('puvodni')}
                className="w-full py-4 px-6 border-2 border-[#001161]/20 text-[#001161] font-bold rounded-[14px] inline-flex items-center justify-center gap-2 group/btn transition-all duration-300 hover:bg-[#001161]/6 hover:border-[#001161]/40 active:scale-95"
              >
                {'Otevřít původní aplikaci'}
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.a>
        </div>

        {/* Remember Preference */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="flex items-center justify-center"
        >
          <label
            style={FF}
            className="flex cursor-pointer items-center gap-3 text-[14px] text-[#001161]/65 select-none group"
          >
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-5 w-5 rounded-[4px] accent-[#5139ed] cursor-pointer"
            />
            <span className="group-hover:text-[#001161]/80 transition-colors">
              {'Zapamatovat si volbu a příště otevřít rovnou'}
            </span>
          </label>
        </motion.div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="mt-12 p-6 rounded-[20px] bg-[#E6EAF4]/60 border border-[#001161]/10"
        >
          <div className="flex gap-4">
            <div className="flex-shrink-0 text-2xl">ℹ️</div>
            <div>
              <h3 style={FF} className="font-bold text-[15px] text-[#001161] mb-2">
                {'Jak to funguje?'}
              </h3>
              <p style={FF} className="text-[14px] text-[#001161]/70 leading-relaxed">
                {'Obě aplikace jsou nyní dostupné a běží souběžně. Můžete si novou aplikaci vyzkoušet a kdykoliv se vrátit k původní. Vaše data jsou v obou verzích synchronizована.'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
