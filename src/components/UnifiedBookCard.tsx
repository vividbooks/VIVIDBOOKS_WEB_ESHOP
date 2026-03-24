import React from 'react';
import { motion } from 'motion/react';
import { BookOpen } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { BookCoverFloorShadow } from './BookCoverFloorShadow';

/* ─── helpers ───────────────────────────────────────────── */
const formatTypography = (text: string) => {
  if (!text) return '';
  return text
    .replace(/(\b[vszkuoia])\s+/gi, '$1\u00A0')
    .replace(/(\d+\.?)\s+/g, '$1\u00A0');
};

const formatPrice = (book: any): string => {
  const raw = book.price?.toString() ?? '';
  if (!raw) return '';
  // Odstraníme trailing ",-" nebo ",–" (i s mezerou) ať je kdekoliv
  const p = raw.replace(/,[\u2013\-]\s*$/, '').replace(/,\s*$/, '').trim();
  if (p.includes('Cena') || isNaN(parseInt(p))) return p;
  if (p.includes('K\u010d')) return p;
  return `${p.replace(/[,\s\.].*$/, '').trim()}\u00a0K\u010d`;
};

const getNote = (book: any): string =>
  book.note || book.poznamka || book.metadata?.poznamka || book.metadata?.note || '';

// Seřazeno od nejdelšího — aby "Anglický jazyk" byl nalezen dříve než "Anglický"
const KNOWN_SUBJECTS = [
  'Anglick\u00fd jazyk',
  '\u010cesk\u00fd jazyk',
  'P\u0159\u00edrodopis',
  'Matematika',
  'Fyzika',
  'Chemie',
  'Prvouka',
];

const extractSubject = (name: string): { subject: string | null; rest: string } => {
  for (const s of KNOWN_SUBJECTS) {
    if (name.startsWith(s)) {
      const rest = name.slice(s.length).replace(/^\s*[\u2013\-]\s*/, '').trim();
      return { subject: s, rest: rest || name };
    }
  }
  return { subject: null, rest: name };
};

const CATEGORY_COLORS: Record<string, string> = {
  'Matematika': '#5533DD',
  'Anglick\u00fd jazyk': '#FF4500',
  'Fyzika': '#0099BB',
  'Chemie': '#E08800',
  'P\u0159\u00edrodopis': '#1A9E40',
  '\u010cesk\u00fd jazyk': '#CC1F30',
  'Prvouka': '#9933CC',
};

const CATEGORY_BG: Record<string, string> = {
  'Matematika': '#EEEAFF',
  'Anglick\u00fd jazyk': '#FFF2EC',
  'Fyzika': '#E2F8FF',
  'Chemie': '#FFF8E0',
  'P\u0159\u00edrodopis': '#E8F9EE',
  '\u010cesk\u00fd jazyk': '#FEF1F1',
  'Prvouka': '#F5E8FF',
};

export interface UnifiedBookCardProps {
  book: any;
  onClick?: () => void;
  /** 'catalog' = grid item (width from parent), 'related' = fixed 207px wide */
  variant?: 'catalog' | 'related';
  isDistributorMode?: boolean;
  onDownload?: (e: React.MouseEvent, book: any) => void;
}

export function UnifiedBookCard({
  book,
  onClick,
  variant = 'catalog',
  isDistributorMode = false,
  onDownload,
}: UnifiedBookCardProps) {
  const [isLandscape, setIsLandscape] = React.useState(false);

  const note = getNote(book);
  // Dostupnostní bobánek (měsíc) → vedle ceny; ostatní → na obrázku
  const isAvailabilityNote = /dost|dub|kv[eě]t|[cč]erv|srp|z[aá][rř]|[rř][íi]j|list|pros|led|[uú]n|b[rř]ez/i.test(note);
  const showNote = note && !isAvailabilityNote;
  const availNote = note && isAvailabilityNote ? note : null;
  const price = formatPrice(book);
  const { subject, rest: titleRest } = extractSubject(book.name || '');
  const categoryKnownSubject =
    Object.keys(CATEGORY_COLORS).find((k) => (book.category || '').startsWith(k)) ?? null;
  /** Text bobánku: z názvu nebo z kategorie (např. „Pracovní sešit…“ + Matematika). */
  const badgeSubject = subject ?? categoryKnownSubject;
  // Hledáme shodu podle plného názvu předmětu (subject z titulu, nebo celá kategorie)
  const catLookupKey = subject
    ?? categoryKnownSubject
    ?? book.category?.split(' ')[0]
    ?? '';
  const catColor = CATEGORY_COLORS[catLookupKey] ?? '#001161';
  const catBg    = CATEGORY_BG[catLookupKey]    ?? '#F0F2FA';

  const isRelated = variant === 'related';
  const isDigitalTile = book.type === 'online' || book.type === 'license';

  return (
    <motion.div
      className={`flex flex-col cursor-pointer group ${isRelated ? 'flex-shrink-0 w-[207px] max-[1200px]:w-[186px] max-[1050px]:w-[149px]' : 'w-full'}`}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onClick}
    >
      {/* ── image area (tiskoviny: nižší poměr = méně „prázdna“ nad obálkou; digitály ponecháme 3/4) ── */}
      <div
        className={`relative w-full mb-2 flex items-end overflow-visible ${isDigitalTile ? 'aspect-[3/4]' : 'aspect-[5/6]'}`}
      >
        {/* Coloured background only for digital / license tiles — starts lower */}
        {isDigitalTile && (
          <div
            className="absolute inset-x-0 bottom-0 rounded-[20px] pointer-events-none"
            style={{ top: '28%', background: catBg }}
          />
        )}
        {book.image ? (
          book.type === 'online' || book.type === 'license' ? (
            <ImageWithFallback
              src={book.image}
              alt={book.name}
              className="w-[95%] h-[95%] mx-auto object-contain object-bottom transition-all duration-500 group-hover:-rotate-[13deg] group-hover:scale-[1.12] origin-bottom max-md:drop-shadow-[0_4px_12px_rgba(0,0,0,0.1)] md:drop-shadow-[0_12px_24px_rgba(0,0,0,0.13)]"
            />
          ) : (
            <>
              <BookCoverFloorShadow className="pointer-events-none absolute bottom-[1%] left-1/2 z-0 h-[10%] min-h-[28px] max-h-[40px] w-[42%] max-w-[130px] -translate-x-1/2 translate-y-[20%] select-none sm:bottom-[1.5%] sm:h-[9%] sm:max-h-[36px] sm:w-[40%] sm:max-w-[118px]" />
              {/* Tiskoviny — obalový obrázek zmenšen o 40%, oproti původní velikosti dlaždice ještě −15 % (digitální licence beze změny) */}
              <img
                src={book.image}
                alt={book.name}
                className={`relative z-10 ${isLandscape ? 'w-[71.4%]' : 'w-[51%]'} mx-auto object-contain object-bottom transition-all duration-500 group-hover:-rotate-[13deg] group-hover:scale-[1.12] origin-bottom drop-shadow-[0_10px_22px_rgba(0,17,97,0.28)] max-md:drop-shadow-[0_8px_18px_rgba(0,17,97,0.22)]`}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setIsLandscape(img.naturalWidth >= img.naturalHeight);
                }}
              />
            </>
          )
        ) : (
          <div className="w-full h-full rounded-2xl bg-[#eef2fb] flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-[#001161]/20" />
          </div>
        )}


      </div>

      {/* ── text below ── */}
      <div className="flex flex-col px-0.5 relative z-10">
        {/* Bobánek jen předmětu — ročník filtrujte na stránce předmětu (Dostupné tituly). */}
        {badgeSubject && (
          <span
            className="self-start px-3 py-1 rounded-xl font-['Fenomen_Sans',sans-serif] text-[14px] font-normal leading-[1.2] mb-1.5 whitespace-nowrap"
            style={{ background: catBg, color: catColor }}
          >
            {badgeSubject}
          </span>
        )}

        <p className="font-['Fenomen_Sans',sans-serif] text-[#001161] text-[14px] font-normal leading-[1.2] mb-0.5 line-clamp-3">
          {formatTypography(subject ? titleRest : book.name)}
        </p>

        {isDistributorMode ? (
          <>
            {book.specialText && (
              <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/40 text-[11px] uppercase tracking-wider font-normal mb-1">
                {book.specialText}
              </p>
            )}
            {book.type === 'workbook' && onDownload && (
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(e, book); }}
                className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 bg-[#001161] text-white rounded-xl font-bold text-[12px] hover:bg-[#6b58ff] transition-all shadow-sm cursor-pointer"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {'St\u00e1hnout podklady'}
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 flex-wrap mt-0">
            <p
              className="font-['Fenomen_Sans',sans-serif] text-[14px] font-normal"
              style={{ color: catColor }}
            >
              {price &&
                (isDigitalTile
                  ? price
                  : price.includes('K\u010d') || price.includes('Cena')
                    ? price
                    : `${price}\u00a0K\u010d`)}
            </p>
            {availNote && (
              <span className="inline-flex items-center px-2.5 py-[3px] rounded-xl bg-[#FFF3E0] text-[#E06800] font-['Fenomen_Sans',sans-serif] text-[10px] font-normal uppercase tracking-wide whitespace-nowrap border border-[#FF9900]/25">
                {availNote}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}