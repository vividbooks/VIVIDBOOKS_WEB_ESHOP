import React from 'react';
import { motion } from 'motion/react';
import { BookOpen } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { PRINT_BOOK_COVER_DROP_SHADOW } from '../utils/printBookCoverShadow';

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

/** Cena pro rodiče na dlaždici digitální licence (preferuje `priceMonthly` z CMS). */
const formatDigitalTileParentMonthly = (book: any): string => {
  const raw = book.priceMonthly != null ? String(book.priceMonthly).trim() : '';
  const m = raw.match(/(\d[\d\u00a0\s]*)/);
  const num = m ? m[1].replace(/[\s\u00a0]/g, '') : '';
  const amount = num || '290';
  return `od\u00a0${amount}\u00a0K\u010d/m\u011bs\u00ed\u010dn\u011b`;
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
  hideSubjectBadgeOnMobile?: boolean;
}

export function UnifiedBookCard({
  book,
  onClick,
  variant = 'catalog',
  isDistributorMode = false,
  onDownload,
  hideSubjectBadgeOnMobile = false,
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
  const rawTitle = String(subject ? titleRest : (book.name || ''));
  const titleText = formatTypography(rawTitle);
  const titleClass =
    rawTitle.length > 44
      ? 'text-[13px] sm:text-[13px]'
      : rawTitle.length > 32
        ? 'text-[14px] sm:text-[14px]'
        : 'text-[15px] sm:text-[14px]';

  return (
    <motion.div
      className={`flex h-full min-h-0 flex-col cursor-pointer group overflow-visible ${isRelated ? 'flex-shrink-0 w-[207px] max-[1200px]:w-[186px] max-[1050px]:w-[149px]' : 'w-full'}`}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onClick}
    >
      {/*
        Pevná výška pásu obrázku (aspect 3/4 u všech) → bobánek a název začínají ve stejné
        výšce bez ohledu na počet řádků pod nimi. flex-1 jen dole vyplní buňku mřížky.
      */}
      <div className="relative mb-1 aspect-[3/4] w-full shrink-0 overflow-visible">
        {book.image ? (
          isDigitalTile ? (
            <div className="relative flex h-full w-full items-end justify-center">
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 rounded-[20px]"
                style={{ top: '28%', background: catBg }}
              />
              <ImageWithFallback
                src={book.image}
                alt={book.name}
                className="mx-auto h-[95%] w-[95%] max-h-full object-contain object-bottom transition-all duration-500 group-hover:-rotate-[13deg] group-hover:scale-[1.12] origin-bottom max-md:drop-shadow-[0_3px_8px_rgba(0,0,0,0.08)] md:drop-shadow-[0_7px_16px_rgba(0,0,0,0.1)]"
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-end justify-center">
              <div className={`relative z-10 ${isLandscape ? 'w-[71.4%]' : 'w-[51%]'}`}>
                <ImageWithFallback
                  src={book.image}
                  alt={book.name}
                  className="block h-auto w-full object-contain transition-all duration-500 group-hover:-rotate-[13deg] group-hover:scale-[1.12] origin-bottom"
                  style={{ filter: PRINT_BOOK_COVER_DROP_SHADOW }}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setIsLandscape(img.naturalWidth >= img.naturalHeight);
                  }}
                />
              </div>
            </div>
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#eef2fb]">
            <BookOpen className="h-10 w-10 text-[#001161]/20" />
          </div>
        )}
      </div>

      <div className="relative z-10 flex shrink-0 flex-col px-0.5">
        {/* Bobánek jen předmětu — ročník filtrujte na stránce předmětu (Dostupné tituly). */}
        {badgeSubject && (
          <span
            className={`self-start px-3 py-1 rounded-xl font-['Fenomen_Sans',sans-serif] text-[15px] sm:text-[14px] font-normal leading-[1.2] mb-1 whitespace-nowrap ${hideSubjectBadgeOnMobile ? 'hidden sm:inline-flex' : ''}`}
            style={{ background: catBg, color: catColor }}
          >
            {badgeSubject}
          </span>
        )}

        <p className={`font-['Fenomen_Sans',sans-serif] text-[#001161] ${titleClass} font-normal leading-[1.2] mb-0.5 line-clamp-3`}>
          {titleText}
        </p>

        {isDistributorMode ? (
          <>
            {book.specialText && (
              <p className="font-['Fenomen_Sans',sans-serif] text-[#001161]/40 text-[12px] sm:text-[11px] uppercase tracking-wider font-normal mb-1">
                {book.specialText}
              </p>
            )}
            {book.type === 'workbook' && onDownload && (
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(e, book); }}
                className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 bg-[#001161] text-white rounded-xl font-bold text-[13px] sm:text-[12px] hover:bg-[#6b58ff] transition-all shadow-sm cursor-pointer"
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
              className="font-['Fenomen_Sans',sans-serif] text-[15px] sm:text-[14px] font-normal"
              style={{ color: catColor }}
            >
              {isDigitalTile
                ? formatDigitalTileParentMonthly(book)
                : price &&
                  (price.includes('K\u010d') || price.includes('Cena')
                    ? price
                    : `${price}\u00a0K\u010d`)}
            </p>
            {availNote && (
              <span className="inline-flex items-center px-2.5 py-[3px] rounded-xl bg-[#FFF3E0] text-[#E06800] font-['Fenomen_Sans',sans-serif] text-[11px] sm:text-[10px] font-normal uppercase tracking-wide whitespace-nowrap border border-[#FF9900]/25">
                {availNote}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1" aria-hidden />
    </motion.div>
  );
}