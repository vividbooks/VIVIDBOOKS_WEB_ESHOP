import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, ShoppingCart, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useProducts } from '../contexts/ProductsContext';
import { useCart } from '../contexts/CartContext';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SEOHead } from './SEOHead';
import { PRINT_BOOK_COVER_DROP_SHADOW } from '../utils/printBookCoverShadow';
import { getProductFlipbookUrl } from '../utils/flipbookPreview';
import { FlipbookPreviewPane } from './FlipbookPreviewPane';
import { startSchoolOrder } from '../utils/startSchoolOrder';
import logoPaths from '../imports/svg-fupfguvmdt';

const FF = "'Fenomen Sans', sans-serif";
const SERIF = "'Cooper Light', serif";
const VIVIDBOOKS_LOGO_VIEWBOX = '0 0 1786.62 869.93';

function VividbooksLogo({ width = 110 }: { width?: number }) {
  return (
    <svg viewBox={VIVIDBOOKS_LOGO_VIEWBOX} fill="none" style={{ width: `${width}px`, height: 'auto', display: 'block' }} aria-label="Vividbooks">
      <path d={logoPaths.p299c6b00} fill="#001161" />
      <path d={logoPaths.p3cc4870} fill="#001161" />
      <path d={logoPaths.p98d9300} fill="#001161" />
      <path d={logoPaths.pf524b00} fill="#001161" />
      <path d={logoPaths.p26e2d80} fill="#001161" />
      <path d={logoPaths.p15998cf0} fill="#001161" />
      <path d={logoPaths.p1bd3b900} fill="#001161" />
      <path d={logoPaths.p19a24c00} fill="#001161" />
      <path d={logoPaths.p34d64300} fill="#001161" />
      <path d={logoPaths.p396dedf0} fill="#001161" />
    </svg>
  );
}

type CatalogMode = 'subject' | 'grade';

type CatalogNavItem = {
  id: string;
  label: string;
  subject: string;
  gradeBand: '1' | '2';
};

const SUBJECT_ITEMS: CatalogNavItem[] = [
  { id: 'matematika-1', label: 'Matematika', subject: 'Matematika 1. stupeň', gradeBand: '1' },
  { id: 'cesky-jazyk', label: 'Český jazyk', subject: 'Český jazyk', gradeBand: '1' },
  { id: 'prvouka', label: 'Prvouka', subject: 'Prvouka', gradeBand: '1' },
  { id: 'zakovske-knizky', label: 'Žákovské knížky', subject: 'Žákovské knížky', gradeBand: '1' },
  { id: 'matematika-2', label: 'Matematika', subject: 'Matematika 2. stupeň', gradeBand: '2' },
  { id: 'fyzika', label: 'Fyzika', subject: 'Fyzika', gradeBand: '2' },
  { id: 'prirodopis', label: 'Přírodopis', subject: 'Přírodopis', gradeBand: '2' },
  { id: 'chemie', label: 'Chemie', subject: 'Chemie', gradeBand: '2' },
];

const GRADE_ITEMS = [
  { id: 'grade-1', label: '1. ročník', grade: 1 },
  { id: 'grade-2', label: '2. ročník', grade: 2 },
  { id: 'grade-6', label: '6. ročník', grade: 6 },
  { id: 'grade-7', label: '7. ročník', grade: 7 },
  { id: 'grade-8', label: '8. ročník', grade: 8 },
  { id: 'grade-9', label: '9. ročník', grade: 9 },
];

const SUBJECT_ORDER = ['Matematika 1. stupeň', 'Český jazyk', 'Prvouka', 'Žákovské knížky', 'Matematika 2. stupeň', 'Fyzika', 'Přírodopis', 'Chemie'];

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalizeText(value: unknown): string {
  return stripDiacritics(String(value || '').trim());
}

function productText(product: any): string {
  return [
    product?.name,
    product?.title,
    product?.category,
    product?.description,
    product?.metadata?.subject,
    product?.metadata?.category,
  ].filter(Boolean).join(' ');
}

function subjectForProduct(product: any): string {
  const category = String(product?.category || '').trim();
  if (SUBJECT_ORDER.includes(category)) return category;

  const text = normalizeText(productText(product));
  const normalizedCategory = normalizeText(category);

  if (normalizedCategory.includes('zakovske knizky') || text.includes('zakovska knizka')) return 'Žákovské knížky';
  if (text.includes('cesky jazyk') || text.includes('cestina') || normalizedCategory.includes('cesky jazyk')) return 'Český jazyk';
  if (text.includes('prvouka') || normalizedCategory.includes('prvouka')) return 'Prvouka';
  if (text.includes('fyzika') || normalizedCategory.includes('fyzika')) return 'Fyzika';
  if (text.includes('prirodopis') || normalizedCategory.includes('prirodopis')) return 'Přírodopis';
  if (text.includes('chemie') || normalizedCategory.includes('chemie')) return 'Chemie';
  if (text.includes('matematika') || normalizedCategory.includes('matematika')) {
    if (
      text.includes('2. stup')
      || normalizedCategory.includes('2. stup')
      || category.includes('2. stupeň')
      || /\b[6-9]\.\s*rocnik/.test(text)
    ) return 'Matematika 2. stupeň';
    return 'Matematika 1. stupeň';
  }
  return category || 'Ostatní';
}

function czechGradeForProduct(product: any): number | null {
  const name = normalizeText(product?.name || '');

  // Písanky: 1.–3. díl je rozdělení v rámci 1. ročníku, ne samostatný ročník.
  if (name.includes('pisanka')) return 1;

  const proGrade = name.match(/pro\s+([1-5])\.\s*rocnik/);
  if (proGrade) return Number(proGrade[1]);

  if (name.includes('predskolak') || name.includes('carymary') || name.includes('caranka')) {
    return 1;
  }

  return 1;
}

function gradeForProduct(product: any): number | null {
  const category = String(product?.category || '').trim();
  const normalizedCategory = normalizeText(category);

  if (category === 'Český jazyk' || normalizedCategory.includes('cesky jazyk')) {
    return czechGradeForProduct(product);
  }

  const rocnik = String(product?.rocnik || '').trim();
  const rocnikMatch = rocnik.match(/([1-9])/);
  if (rocnikMatch) return Number(rocnikMatch[1]);

  const text = normalizeText(productText(product));

  if (normalizedCategory.includes('zakovske knizky') || text.includes('zakovska knizka')) {
    const gradeMatch = text.match(/([1-5])\.\s*rocnik/);
    return gradeMatch ? Number(gradeMatch[1]) : 1;
  }

  const explicit = text.match(/([1-9])\.\s*rocnik/);
  if (explicit) return Number(explicit[1]);

  const afterSubject = text.match(/(?:matematika|fyzika|chemie|prirodopis|prvouka|jazyk)\s+([1-9])\b/);
  if (afterSubject) return Number(afterSubject[1]);

  if (category === 'Chemie') {
    const name = normalizeText(product?.name);
    if (name.includes('1. dil')) return 8;
    if (name.includes('2. dil')) return 9;
  }

  if (category) {
    const gradeMatch = String(product?.name || '').match(/(\d+)/);
    if (gradeMatch) return Number(gradeMatch[1]);
  }

  return null;
}

function partForProduct(product: any): number {
  const text = normalizeText(product?.name);
  const match = text.match(/([1-9])\.\s*dil/);
  return match ? Number(match[1]) : 0;
}

function productSort(a: any, b: any): number {
  const ga = gradeForProduct(a) ?? 99;
  const gb = gradeForProduct(b) ?? 99;
  if (ga !== gb) return ga - gb;
  const pa = partForProduct(a);
  const pb = partForProduct(b);
  if (pa !== pb) return pa - pb;
  return String(a.name || '').localeCompare(String(b.name || ''), 'cs');
}

function displaySubject(subject: string): string {
  return subject;
}

function displayTitle(product: any): string {
  return String(product?.name || product?.title || 'Produkt').replace(/\s+/g, ' ').trim();
}

function displayPrice(product: any): string {
  const raw = String(product?.price || '').trim();
  if (!raw) return '';
  if (/kč/i.test(raw)) return raw;
  return `${raw.replace(/,\s*[–-]\s*$/, '').replace(/\s*Kc$/i, '')} Kč,-`;
}

function productNote(product: any): string {
  return String(product?.note || product?.poznamka || product?.metadata?.poznamka || product?.metadata?.note || '').trim();
}

function isAvailabilityNote(note: string): boolean {
  return /dost|dub|kv[eě]t|[cč]erv|srp|z[aá][rř]|[rř][íi]j|list|pros|led|[uú]n|b[rř]ez/i.test(note);
}

function subjectSectionId(subject: string): string {
  return `catalog-subject-${stripDiacritics(subject).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function gradeSectionId(grade: number): string {
  return `catalog-grade-${grade}`;
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function productDescription(product: any): string {
  const raw = String(product?.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (raw) return raw;
  return 'Pracovní učebnice vede žáky k pochopení látky jako smysluplné, užitečné a hodnotné činnosti. Podporuje samostatné uvažování, práci s chybou a propojení se světem kolem nich.';
}

function productMeta(product: any): Array<{ label: string; value: string }> {
  const rows = [
    { label: 'Autoři', value: product?.autori },
    { label: 'Počet stran', value: product?.pocetStranek },
    { label: 'Formát', value: product?.format },
    { label: 'ISBN', value: product?.isbn || product?.metadata?.isbn },
    { label: 'Cena', value: displayPrice(product) },
    { label: 'Doložka MŠMT', value: product?.dolozka ? 'Ano' : '' },
  ];
  return rows
    .map((row) => ({ label: row.label, value: String(row.value || '').trim() }))
    .filter((row) => row.value);
}

function isCatalogProduct(product: any): boolean {
  if (product?.type === 'workbook') return true;
  const category = normalizeText(product?.category);
  return product?.type === 'merch' && category.includes('zakovske knizky');
}

function groupProducts(products: any[]) {
  const map = new Map<string, any[]>();
  for (const product of products.filter(isCatalogProduct).sort(productSort)) {
    const subject = subjectForProduct(product);
    if (!map.has(subject)) map.set(subject, []);
    map.get(subject)!.push(product);
  }
  return SUBJECT_ORDER
    .filter((subject) => (map.get(subject)?.length || 0) > 0)
    .map((subject) => ({ subject, products: map.get(subject)! }));
}

function productsForGrade(products: any[], grade: number): any[] {
  return products
    .filter(isCatalogProduct)
    .filter((product) => gradeForProduct(product) === grade)
    .sort((a, b) => {
      const sa = SUBJECT_ORDER.indexOf(subjectForProduct(a));
      const sb = SUBJECT_ORDER.indexOf(subjectForProduct(b));
      if (sa !== sb) return (sa === -1 ? 99 : sa) - (sb === -1 ? 99 : sb);
      return productSort(a, b);
    });
}

function CatalogHero() {
  return (
    <section className="rounded-[34px] bg-[#ffae8a] px-5 py-10 text-center text-[#001161] shadow-[0_18px_48px_rgba(255,174,138,0.22)] md:px-10 md:py-12">
      <div className="mb-4 flex justify-center">
        <VividbooksLogo width={96} />
      </div>
      <h1 className="text-[58px] font-normal leading-[0.92] md:text-[82px]" style={{ fontFamily: SERIF }}>
        {'Katalog'}
      </h1>
      <p className="mt-3 text-[15px] font-normal text-[#001161]/75 md:text-[17px]" style={{ fontFamily: FF }}>
        {'Pracovních sešitů a učebnic pro školní rok 2026/2027'}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Badge>{'Doložky MŠMT'}</Badge>
        <Badge>{'Podle RVP'}</Badge>
      </div>
      <p className="mt-7 text-[22px] font-normal md:text-[24px]" style={{ fontFamily: FF }}>
        {'Děkujeme že s námi učíte!'}
      </p>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-[#001161] px-3 py-2 text-[13px] font-normal text-[#001161]" style={{ fontFamily: FF }}>
      <span className="flex size-4 items-center justify-center rounded-full bg-[#001161] text-white">
        <Check className="size-3" strokeWidth={3} />
      </span>
      {children}
    </span>
  );
}

function BookTile({
  product,
  promotionBadges,
  onClick,
}: {
  product: any;
  promotionBadges: string[];
  onClick: () => void;
}) {
  const note = productNote(product);
  const availNote = note && isAvailabilityNote(note) ? note : null;
  const coverNote = note && !isAvailabilityNote(note) ? note : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-[138px] flex-col items-center text-center outline-none"
    >
      <div className="relative flex h-[210px] w-full items-end justify-center md:h-[235px]">
        {promotionBadges.length > 0 ? (
          <div className="pointer-events-none absolute left-0 top-[34%] z-10 flex max-w-[calc(100%-0.5rem)] flex-col items-start gap-1">
            {promotionBadges.map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="max-w-full truncate rounded-full bg-[#ff2e43] px-2 py-0.5 text-[9px] font-normal uppercase tracking-wide text-white shadow-md ring-1 ring-white/50"
                style={{ fontFamily: FF }}
                title={label}
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
        {coverNote ? (
          <span
            className="pointer-events-none absolute right-0 top-2 z-10 max-w-[92%] truncate rounded-full bg-[#001161] px-2 py-0.5 text-[9px] font-normal uppercase tracking-wide text-white shadow-md"
            style={{ fontFamily: FF }}
            title={coverNote}
          >
            {coverNote}
          </span>
        ) : null}
        {product.image ? (
          <ImageWithFallback
            src={product.image}
            alt={displayTitle(product)}
            className="h-[92%] w-auto max-w-full object-contain object-bottom transition-transform duration-300 group-hover:-translate-y-2 group-hover:-rotate-3 group-hover:scale-[1.04]"
            style={{ filter: PRINT_BOOK_COVER_DROP_SHADOW }}
          />
        ) : (
          <span className="h-[82%] w-[118px] rounded-xl bg-[#f2f0da] shadow-md" />
        )}
      </div>
      <span className="mt-3 line-clamp-2 text-[13px] font-normal leading-tight text-[#001161]" style={{ fontFamily: FF }}>
        {displayTitle(product)}
      </span>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
        {displayPrice(product) ? (
          <span className="text-[12px] font-normal text-[#001161]/55" style={{ fontFamily: FF }}>
            {displayPrice(product)}
          </span>
        ) : null}
        {availNote ? (
          <span
            className="inline-flex items-center rounded-xl border border-[#FF9900]/25 bg-[#FFF3E0] px-2 py-[2px] text-[9px] font-normal uppercase tracking-wide text-[#E06800]"
            style={{ fontFamily: FF }}
          >
            {availNote}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function CatalogSidebar({
  mode,
  setMode,
  selectedSubject,
  onSelectSubject,
  selectedGrade,
  onSelectGrade,
  onSchoolOrder,
  schoolOrderCount,
}: {
  mode: CatalogMode;
  setMode: (mode: CatalogMode) => void;
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
  selectedGrade: number;
  onSelectGrade: (grade: number) => void;
  onSchoolOrder: () => void;
  schoolOrderCount: number;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[214px] shrink-0 flex-col overflow-y-auto bg-[#f7f7f8] px-5 py-8 lg:flex">
      <p className="mb-3 text-[10px] font-normal uppercase tracking-[0.18em] text-[#001161]/35" style={{ fontFamily: FF }}>
        {'Řazení'}
      </p>
      <div className="space-y-2">
        <SidebarButton active={mode === 'subject'} onClick={() => setMode('subject')}>
          {'Podle předmětů'}
        </SidebarButton>
        <SidebarButton active={mode === 'grade'} onClick={() => setMode('grade')}>
          {'Podle ročníků'}
        </SidebarButton>
      </div>

      {mode === 'subject' ? (
        <div className="mt-10 space-y-8">
          <SubjectSection
            title="1. stupeň"
            items={SUBJECT_ITEMS.filter((item) => item.gradeBand === '1')}
            selectedSubject={selectedSubject}
            onSelectSubject={onSelectSubject}
          />
          <SubjectSection
            title="2. stupeň"
            items={SUBJECT_ITEMS.filter((item) => item.gradeBand === '2')}
            selectedSubject={selectedSubject}
            onSelectSubject={onSelectSubject}
          />
        </div>
      ) : (
        <div className="mt-10">
          <p className="mb-4 text-[10px] font-normal uppercase tracking-[0.18em] text-[#001161]/35" style={{ fontFamily: FF }}>
            {'Ročníky'}
          </p>
          <div className="space-y-2">
            {GRADE_ITEMS.map((item) => (
              <FilterButton key={item.id} active={selectedGrade === item.grade} onClick={() => onSelectGrade(item.grade)}>
                {item.label}
              </FilterButton>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={onSchoolOrder}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3d3d3d] px-4 py-3 text-[14px] font-normal text-white transition-colors hover:bg-[#555]"
          style={{ fontFamily: FF }}
        >
          <ShoppingCart className="size-4 shrink-0" />
          <span>{'Objednat pro školu'}</span>
          {schoolOrderCount > 0 ? (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-normal text-[#001161]">
              {schoolOrderCount}
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  );
}

function SidebarButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-4 py-3 text-left text-[14px] font-normal transition-colors ${
        active ? 'bg-[#001161] text-white shadow-[0_8px_18px_rgba(0,17,97,0.16)]' : 'text-[#001161] hover:bg-white'
      }`}
      style={{ fontFamily: FF }}
    >
      {children}
    </button>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-4 py-2.5 text-left text-[14px] font-normal transition-colors ${
        active ? 'bg-[#c8d7f7] text-[#001161]' : 'text-[#001161] hover:bg-white'
      }`}
      style={{ fontFamily: FF }}
    >
      {children}
    </button>
  );
}

function SubjectSection({
  title,
  items,
  selectedSubject,
  onSelectSubject,
}: {
  title: string;
  items: CatalogNavItem[];
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
}) {
  return (
    <div>
      <p className="mb-4 text-[10px] font-normal uppercase tracking-[0.18em] text-[#001161]/35" style={{ fontFamily: FF }}>
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <FilterButton
            key={item.id}
            active={selectedSubject === item.subject}
            onClick={() => onSelectSubject(item.subject)}
          >
            {item.label}
          </FilterButton>
        ))}
      </div>
    </div>
  );
}

function MobileFilters({
  mode,
  setMode,
  selectedSubject,
  onSelectSubject,
  selectedGrade,
  onSelectGrade,
}: {
  mode: CatalogMode;
  setMode: (mode: CatalogMode) => void;
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
  selectedGrade: number;
  onSelectGrade: (grade: number) => void;
}) {
  const pillBase = 'rounded-full px-3 py-2 text-[12px] font-normal leading-tight sm:px-4 sm:text-[13px]';

  return (
    <div className="mb-8 mt-8 lg:hidden">
      <div className="mb-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setMode('subject')}
          className={`${pillBase} ${mode === 'subject' ? 'bg-[#001161] text-white' : 'bg-[#eef2fb] text-[#001161]'}`}
          style={{ fontFamily: FF }}
        >
          {'Podle předmětů'}
        </button>
        <button
          type="button"
          onClick={() => setMode('grade')}
          className={`${pillBase} ${mode === 'grade' ? 'bg-[#001161] text-white' : 'bg-[#eef2fb] text-[#001161]'}`}
          style={{ fontFamily: FF }}
        >
          {'Podle ročníků'}
        </button>
      </div>

      {mode === 'subject' ? (
        <div className="space-y-6">
          {(['1', '2'] as const).map((band) => {
            const items = SUBJECT_ITEMS.filter((item) => item.gradeBand === band);
            if (items.length === 0) return null;
            return (
              <div key={band}>
                <p
                  className="mb-3 text-[10px] font-normal uppercase tracking-[0.16em] text-[#001161]/35"
                  style={{ fontFamily: FF }}
                >
                  {band === '1' ? '1. stupeň' : '2. stupeň'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => onSelectSubject(item.subject)}
                      className={`${pillBase} ${
                        selectedSubject === item.subject
                          ? 'bg-[#c8d7f7] text-[#001161]'
                          : 'border border-[#001161]/8 bg-white text-[#001161]'
                      }`}
                      style={{ fontFamily: FF }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {GRADE_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onSelectGrade(item.grade)}
              className={`${pillBase} ${
                selectedGrade === item.grade
                  ? 'bg-[#c8d7f7] text-[#001161]'
                  : 'border border-[#001161]/8 bg-white text-[#001161]'
              }`}
              style={{ fontFamily: FF }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductModal({
  product,
  onClose,
  onPrev,
  onNext,
  onSchoolOrder,
}: {
  product: any;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSchoolOrder: (product: any) => void;
}) {
  const meta = productMeta(product);
  const flipbookUrl = getProductFlipbookUrl(product);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (flipbookUrl) return;
      if (event.key === 'ArrowLeft') onPrev();
      if (event.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipbookUrl, onClose, onNext, onPrev]);

  return (
    <div className="fixed inset-0 z-[120] bg-black/72 px-3 py-6 backdrop-blur-sm md:px-8" onClick={onClose}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onPrev();
        }}
        className="fixed left-3 top-1/2 z-[130] hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#001161] shadow-xl md:flex"
        aria-label="Předchozí produkt"
      >
        <ChevronLeft className="size-7" />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onNext();
        }}
        className="fixed right-3 top-1/2 z-[130] hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#001161] shadow-xl md:flex"
        aria-label="Další produkt"
      >
        <ChevronRight className="size-7" />
      </button>

      <div
        className="mx-auto grid h-[min(calc(100dvh-48px),840px)] w-full max-w-[1380px] overflow-hidden rounded-[34px] bg-white shadow-2xl md:grid-cols-[1.15fr_0.85fr]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-h-0 bg-[#f3f3f0]">
          {flipbookUrl ? (
            <FlipbookPreviewPane
              flipbookUrl={flipbookUrl}
              title={displayTitle(product)}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-8 py-10">
              {product.image ? (
                <ImageWithFallback
                  src={product.image}
                  alt={displayTitle(product)}
                  className="max-h-[72%] w-auto max-w-[58%] object-contain"
                  style={{ filter: 'drop-shadow(-6px 12px 24px rgba(0,17,97,0.2))' }}
                  priority
                />
              ) : (
                <div className="h-[420px] w-[290px] rounded-2xl bg-[#f2f0da] shadow-xl" />
              )}
            </div>
          )}
        </div>

        <article className="relative min-h-0 overflow-y-auto px-8 py-10 text-[#001161] md:px-14 md:py-14">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex size-11 items-center justify-center rounded-full bg-[#f3f4fb] text-[#001161] transition-colors hover:bg-[#e6e9f7]"
            aria-label="Zavřít detail"
          >
            <X className="size-5" />
          </button>

          <p className="mb-3 text-[12px] font-normal uppercase tracking-[0.14em] text-[#001161]/36" style={{ fontFamily: FF }}>
            {displaySubject(subjectForProduct(product))}
          </p>
          <h2 className="max-w-[560px] border-b border-[#001161]/8 pb-8 text-[34px] font-normal leading-[1.04] md:text-[44px]" style={{ fontFamily: SERIF }}>
            {displayTitle(product)}
          </h2>

          {meta.length > 0 ? (
            <dl className="mt-9 grid grid-cols-2 gap-x-14 gap-y-8">
              {meta.map((row) => (
                <div key={row.label} className={row.label === 'Autoři' ? 'col-span-2' : ''}>
                  <dt className="mb-2 text-[10px] font-normal uppercase tracking-[0.18em] text-[#001161]/30" style={{ fontFamily: FF }}>
                    {row.label}
                  </dt>
                  <dd className="text-[15px] font-normal leading-snug text-[#001161]" style={{ fontFamily: FF }}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="my-9 border-t border-[#001161]/8" />
          <p className="text-[17px] leading-[1.65] text-[#001161]/78" style={{ fontFamily: FF }}>
            {productDescription(product)}
          </p>
          <button
            type="button"
            onClick={() => onSchoolOrder(product)}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#001161] px-4 py-3.5 text-[15px] font-normal text-white transition-colors hover:bg-[#000a3d]"
            style={{ fontFamily: FF }}
          >
            <ShoppingCart className="size-4 shrink-0" />
            {'Objednat pro školu'}
          </button>
        </article>
      </div>
    </div>
  );
}

function ProductGrid({
  products,
  getProductPromotionCardBadges,
  onOpenProduct,
}: {
  products: any[];
  getProductPromotionCardBadges: (product: any) => string[];
  onOpenProduct: (productId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <BookTile
          key={product.id}
          product={product}
          promotionBadges={getProductPromotionCardBadges(product)}
          onClick={() => onOpenProduct(String(product.id))}
        />
      ))}
    </div>
  );
}

export function CatalogCleanPage() {
  const navigate = useNavigate();
  const { products, isLoading, getProductPromotionCardBadges } = useProducts();
  const { addItem, items } = useCart();
  const [mode, setMode] = useState<CatalogMode>('subject');
  const [selectedSubject, setSelectedSubject] = useState('Matematika 1. stupeň');
  const [selectedGrade, setSelectedGrade] = useState(1);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  const handleSchoolOrder = (product?: any) => {
    startSchoolOrder(navigate, { addItem, items }, product);
  };

  const groups = useMemo(() => groupProducts(products), [products]);
  const gradeSections = useMemo(
    () => GRADE_ITEMS
      .map((item) => ({ ...item, products: productsForGrade(products, item.grade) }))
      .filter((section) => section.products.length > 0),
    [products],
  );
  const visibleProducts = useMemo(
    () => (mode === 'subject'
      ? groups.flatMap((group) => group.products)
      : gradeSections.flatMap((section) => section.products)),
    [gradeSections, groups, mode],
  );

  const navigateToSubject = (subject: string) => {
    setSelectedSubject(subject);
    scrollToSection(subjectSectionId(subject));
  };

  const navigateToGrade = (grade: number) => {
    setSelectedGrade(grade);
    scrollToSection(gradeSectionId(grade));
  };

  const activeIndex = activeProductId ? visibleProducts.findIndex((product) => String(product.id) === activeProductId) : -1;
  const activeProduct = activeIndex >= 0 ? visibleProducts[activeIndex] : null;
  const moveModal = (direction: -1 | 1) => {
    if (visibleProducts.length === 0) return;
    const nextIndex = activeIndex >= 0
      ? (activeIndex + direction + visibleProducts.length) % visibleProducts.length
      : 0;
    setActiveProductId(String(visibleProducts[nextIndex].id));
  };

  return (
    <>
      <SEOHead
        title="Katalog"
        path="/katalog"
        description="Čistý katalog pracovních sešitů a učebnic Vividbooks pro školní rok 2026/2027."
      />
      <main className="min-h-dvh bg-white text-[#001161]">
        <div className="flex">
          <CatalogSidebar
            mode={mode}
            setMode={setMode}
            selectedSubject={selectedSubject}
            onSelectSubject={navigateToSubject}
            selectedGrade={selectedGrade}
            onSelectGrade={navigateToGrade}
            onSchoolOrder={() => handleSchoolOrder()}
            schoolOrderCount={items.length}
          />
          <div className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:px-9">
            <CatalogHero />
            <MobileFilters
              mode={mode}
              setMode={setMode}
              selectedSubject={selectedSubject}
              onSelectSubject={navigateToSubject}
              selectedGrade={selectedGrade}
              onSelectGrade={navigateToGrade}
            />

            <section className="mx-auto max-w-[1120px] py-14 md:py-20">
              {isLoading ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div key={index} className="h-[270px] rounded-3xl bg-[#f5f6fa] motion-safe:animate-pulse" />
                  ))}
                </div>
              ) : mode === 'subject' ? (
                groups.length > 0 ? (
                  <div className="space-y-20 md:space-y-24">
                    {groups.map((group) => (
                      <div
                        key={group.subject}
                        id={subjectSectionId(group.subject)}
                        className="scroll-mt-6"
                      >
                        <h2
                          className="mb-10 text-center text-[34px] font-normal leading-tight md:mb-12 md:text-[46px]"
                          style={{ fontFamily: SERIF }}
                        >
                          {displaySubject(group.subject)}
                        </h2>
                        <ProductGrid
                          products={group.products}
                          getProductPromotionCardBadges={getProductPromotionCardBadges}
                          onOpenProduct={setActiveProductId}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[28px] bg-[#f7f8fc] px-6 py-14 text-center">
                    <p className="text-[17px] font-normal text-[#001161]/70" style={{ fontFamily: FF }}>
                      {'V katalogu zatím nejsou žádné produkty.'}
                    </p>
                  </div>
                )
              ) : gradeSections.length > 0 ? (
                <div className="space-y-20 md:space-y-24">
                  {gradeSections.map((section) => (
                    <div
                      key={section.id}
                      id={gradeSectionId(section.grade)}
                      className="scroll-mt-6"
                    >
                      <h2
                        className="mb-10 text-center text-[34px] font-normal leading-tight md:mb-12 md:text-[46px]"
                        style={{ fontFamily: SERIF }}
                      >
                        {section.label}
                      </h2>
                      <ProductGrid
                        products={section.products}
                        getProductPromotionCardBadges={getProductPromotionCardBadges}
                        onOpenProduct={setActiveProductId}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[28px] bg-[#f7f8fc] px-6 py-14 text-center">
                  <p className="text-[17px] font-normal text-[#001161]/70" style={{ fontFamily: FF }}>
                    {'V katalogu zatím nejsou žádné produkty.'}
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {activeProduct ? (
        <ProductModal
          product={activeProduct}
          onClose={() => setActiveProductId(null)}
          onPrev={() => moveModal(-1)}
          onNext={() => moveModal(1)}
          onSchoolOrder={handleSchoolOrder}
        />
      ) : null}
    </>
  );
}
