import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { ShoppingCart } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { getProductImage, isPrintProduct } from './cartUpsellUtils';
import {
  buildBundleCartLines,
  bundleCatalogListSumHaler,
  bundleSlotTotalCount,
  getNxPlusSubjectSlotCounts,
  productMatchesBundleSubjectLabels,
  productsEligibleForSubjectBundle,
  bundleIsNxPlusOneSubject,
  type ProductBundleRecord,
} from '../utils/bundlePricing';

const BUNDLE_FAN_COVER_W = 64;
const BUNDLE_FAN_COVER_H = 92;

function bundleFanRotationDeg(index: number, total: number): number {
  if (total <= 1) return 0;
  if (total === 2) return index === 0 ? -12 : 12;
  if (total === 3) return index === 0 ? -14 : index === 1 ? 0 : 14;
  return ([-16, -6, 6, 16] as const)[Math.min(index, 3)] ?? 0;
}

function BundleFanCoverThumb({
  book,
  onClick,
  index,
  total,
  className = '',
}: {
  book: any;
  onClick: () => void;
  index: number;
  total: number;
  className?: string;
}) {
  const src = getProductImage(book);
  const rotation = bundleFanRotationDeg(index, total);
  const zIndex = index + 1;
  const wrapStyle: CSSProperties =
    rotation !== 0
      ? {
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'bottom center',
          zIndex,
        }
      : { zIndex };

  return (
    <div className={`shrink-0 ${className}`} style={wrapStyle}>
      <button
        type="button"
        onClick={onClick}
        title={book?.name || 'Zobrazit produkt'}
        className="block rounded-none overflow-hidden bg-white shadow-md border border-[#92400e]/22 hover:border-[#b45309]/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff8e8] transition-colors cursor-pointer p-0"
        style={{ width: BUNDLE_FAN_COVER_W, height: BUNDLE_FAN_COVER_H }}
      >
        {src ? (
          <ImageWithFallback
            src={src}
            alt={book?.name || ''}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-[9px] font-bold text-[#92400e]/35 text-center px-1 font-['Fenomen_Sans',sans-serif] leading-tight"
            style={{ background: 'linear-gradient(145deg, #fffbeb, #fef3c7)' }}
          >
            Sešit
          </div>
        )}
      </button>
    </div>
  );
}

function titulSkloneni(n: number): string {
  if (n === 1) return 'titul';
  if (n >= 2 && n <= 4) return 'tituly';
  return 'titulů';
}

function pickUpToFourSeeded<T>(items: T[], seed: string): T[] {
  if (items.length <= 4) return items;
  const copy = [...items];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.abs(h + i * 7919) % (i + 1);
    const t = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = t;
  }
  return copy.slice(0, 4);
}

function computeBundleFanCovers(
  bundle: ProductBundleRecord,
  products: any[],
  anchorProduct: any | undefined,
): any[] {
  if (bundleIsNxPlusOneSubject(bundle)) {
    const eligible = productsEligibleForSubjectBundle(bundle, products);
    if (anchorProduct && productMatchesBundleSubjectLabels(anchorProduct, bundle.bundleSubjectLabels)) {
      const others = eligible.filter((p) => String(p.id) !== String(anchorProduct.id));
      const withImg = others.filter((p) => isPrintProduct(p) && getProductImage(p));
      const pick = withImg.length > 0 ? withImg : (getProductImage(anchorProduct) ? [anchorProduct] : []);
      return pickUpToFourSeeded(pick, `${bundle.id}:${anchorProduct.id}`);
    }
    const coverCandidates = eligible.filter((p) => isPrintProduct(p) && getProductImage(p));
    return pickUpToFourSeeded(coverCandidates, `${bundle.id}:subject-listing`);
  }

  const ids = bundle.productIds || [];
  if (ids.length === 0) return [];

  if (anchorProduct) {
    let coverCandidates: any[] = ids
      .filter((id) => String(id) !== String(anchorProduct.id))
      .map((id) => products.find((p) => String(p.id) === String(id)))
      .filter((p): p is any => !!p && isPrintProduct(p) && !!getProductImage(p));
    if (coverCandidates.length === 0 && getProductImage(anchorProduct)) {
      coverCandidates = [anchorProduct];
    }
    return pickUpToFourSeeded(coverCandidates, `${bundle.id}:${anchorProduct.id}`);
  }

  const coverCandidates = ids
    .map((id) => products.find((p) => String(p.id) === String(id)))
    .filter((p): p is any => !!p && isPrintProduct(p) && !!getProductImage(p));
  return pickUpToFourSeeded(coverCandidates, `${bundle.id}:listing`);
}

export type ProductBundlePromoTileProps = {
  bundle: ProductBundleRecord;
  products: any[];
  /** PDP: aktuální produkt (obálky bez něj, jinak jen on). Akce: neužívat. */
  anchorProduct?: any;
  /** Nadpis nad krémovým boxem (stránka Akce). */
  heading?: string;
  /** Úzká vysoká karta (dvousloupcový grid na Akcích): obálky nahoře, obsah pod sebou. */
  narrowGrid?: boolean;
  onAddToSchoolOrder: (bundle: ProductBundleRecord) => void;
  addingBundleId: string | null;
};

export function ProductBundlePromoTile({
  bundle,
  products,
  anchorProduct,
  heading,
  narrowGrid = false,
  onAddToSchoolOrder,
  addingBundleId,
}: ProductBundlePromoTileProps) {
  const navigate = useNavigate();
  const nTit = bundleSlotTotalCount(bundle);
  const listHaler = bundleCatalogListSumHaler(bundle, products);
  const packHaler = Math.max(0, Math.round(bundle.bundlePriceHaler || 0));
  const isSubjectBundle = bundleIsNxPlusOneSubject(bundle);
  const subjectSlots = getNxPlusSubjectSlotCounts(bundle);
  const showListStrike = !isSubjectBundle && listHaler > 0 && listHaler > packHaler;
  const instanceProbe = anchorProduct ? 'pdp-bundle-probe' : 'akce-bundle-probe';
  const linesOk = !isSubjectBundle
    && buildBundleCartLines(products, bundle, instanceProbe).length === nTit
    && nTit > 0;
  const coverPick = computeBundleFanCovers(bundle, products, anchorProduct);

  const fmtKc = (h: number) =>
    `${(h / 100).toLocaleString('cs-CZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}\u00a0K\u010d`;

  const bundlePath = `/balicek/${encodeURIComponent(bundle.slug || bundle.id)}`;

  const introMainLine = isSubjectBundle && subjectSlots
    ? `Akce ${subjectSlots.paid}+${subjectSlots.free} — nastav\u00edte na str\u00e1nce bal\u00ed\u010dku.`
    : `Zahrnuje ${nTit}\u00a0${titulSkloneni(nTit)}.`;

  const intro = heading ? (
    <div className="min-w-0">
      <p className="font-['Fenomen_Sans',sans-serif] text-[13px] sm:text-[14px] text-[#001161] font-normal leading-snug m-0">
        {introMainLine}
      </p>
    </div>
  ) : (
    <div className="min-w-0">
      <p className="font-['Fenomen_Sans',sans-serif] text-[13px] sm:text-[14px] text-[#001161] font-normal leading-snug m-0">
        {isSubjectBundle && subjectSlots ? (
          <>
            <strong className="font-semibold">{bundle.title}</strong>
            {`: ${introMainLine}`}
          </>
        ) : (
          <>
            {'Tento titul si m\u016f\u017eete po\u0159\u00eddit ve zv\u00fdhodn\u011bn\u00e9m bal\u00ed\u010dku:\u00a0'}
            <strong className="font-semibold">{bundle.title}</strong>
            {`\u00a0: ${nTit}\u00a0${titulSkloneni(nTit)}`}
          </>
        )}
      </p>
    </div>
  );

  const standardPriceBlock = (
    <>
      {showListStrike && (
        <span className="font-['Fenomen_Sans',sans-serif] text-[13px] sm:text-[14px] text-[#78350f]/55 line-through">
          {fmtKc(listHaler)}
        </span>
      )}
      <span className="font-['Fenomen_Sans',sans-serif] text-[17px] sm:text-[19px] font-bold text-[#001161]">
        {fmtKc(packHaler)}
      </span>
      <span className="font-['Fenomen_Sans',sans-serif] text-[10px] sm:text-[11px] uppercase tracking-wide text-[#92400e] font-normal">
        {'cena bal\u00ed\u010dku'}
      </span>
    </>
  );

  const actionsBlockPdp = isSubjectBundle ? (
    <Link
      to={bundlePath}
      className="inline-flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-[12px] font-['Fenomen_Sans',sans-serif] text-[12px] sm:text-[13px] font-bold text-white bg-[#001161] hover:bg-[#000a3d] transition-colors cursor-pointer border-0 min-w-0 text-center"
    >
      <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
      {'Vybrat tituly'}
    </Link>
  ) : (
    <>
      <button
        type="button"
        disabled={!linesOk || addingBundleId === bundle.id}
        onClick={() => onAddToSchoolOrder(bundle)}
        className="inline-flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-[12px] font-['Fenomen_Sans',sans-serif] text-[12px] sm:text-[13px] font-bold text-white bg-[#001161] hover:bg-[#000a3d] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer border-0 min-w-0 text-center"
      >
        <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
        {'P\u0159idat do objedn\u00e1vky'}
      </button>
      <Link
        to={bundlePath}
        className="inline-flex items-center justify-center py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-[12px] font-['Fenomen_Sans',sans-serif] text-[12px] sm:text-[13px] font-normal text-[#92400e] underline underline-offset-2 hover:opacity-90 border border-[#d97706]/35 bg-white/90 whitespace-nowrap"
      >
        {'V\u00edce o akci'}
      </Link>
    </>
  );

  return (
    <div className={`flex flex-col gap-2 ${narrowGrid ? 'h-full min-h-0' : ''}`}>
      {heading && !narrowGrid ? (
        <h2 className="font-['Cooper_Light',serif] text-[#001161] leading-snug m-0 text-[22px] md:text-[26px]">
          {heading}
        </h2>
      ) : null}

      <div
        className={`rounded-[20px] bg-[#fff8e8] border border-[#f5d08c] shadow-[0_1px_0_rgba(180,130,40,0.06)] ${
          narrowGrid
            ? 'flex flex-col flex-1 min-h-0 px-3 py-4 sm:px-4 sm:py-5'
            : 'px-3 py-2.5 sm:px-4 sm:py-3'
        }`}
        role="region"
        aria-label="Zvýhodněný balíček"
      >
        {narrowGrid && heading ? (
          <h2 className="font-['Cooper_Light',serif] text-[#001161] text-center text-[19px] sm:text-[21px] leading-snug m-0 mb-3">
            {heading}
          </h2>
        ) : null}
        <div
          className={
            narrowGrid
              ? 'flex flex-col gap-4 items-stretch flex-1 min-h-0'
              : 'flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5'
          }
        >
          {coverPick.length > 0 && (
            <div
              className={
                narrowGrid
                  ? 'flex items-center justify-center shrink-0 pt-0.5'
                  : 'flex items-center justify-center sm:justify-start shrink-0 mx-auto sm:mx-0 self-center sm:-translate-x-5'
              }
            >
              {coverPick.map((bp, idx) => (
                <BundleFanCoverThumb
                  key={String(bp.id)}
                  book={bp}
                  index={idx}
                  total={coverPick.length}
                  onClick={() => navigate(`/produkt/${encodeURIComponent(String(bp.id))}`)}
                  className={idx > 0 ? (narrowGrid ? '-ml-[30px]' : '-ml-[30px] sm:-ml-[34px]') : ''}
                />
              ))}
            </div>
          )}
          <div
            className={
              narrowGrid
                ? 'flex-1 min-h-0 min-w-0 flex flex-col gap-3 text-center'
                : 'flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2 text-center sm:text-left'
            }
          >
            {narrowGrid ? (
              <>
                <div className="flex-1 flex flex-col gap-3 min-h-0 text-center">
                  {intro}
                  {!isSubjectBundle ? (
                    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 w-full min-w-0">
                      {standardPriceBlock}
                    </div>
                  ) : null}
                </div>
                <div
                  className={
                    isSubjectBundle
                      ? 'flex shrink-0 justify-center pt-2 w-full min-w-0'
                      : 'flex flex-row gap-2 w-full min-w-0 mt-0.5'
                  }
                >
                  {isSubjectBundle ? (
                    <Link
                      to={bundlePath}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-4 sm:px-5 rounded-[12px] font-['Fenomen_Sans',sans-serif] text-[11px] sm:text-[12px] font-bold text-white bg-[#001161] hover:bg-[#000a3d] transition-colors cursor-pointer border-0 text-center leading-tight w-auto max-w-[min(100%,240px)]"
                    >
                      <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                      {'Vybrat tituly'}
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={!linesOk || addingBundleId === bundle.id}
                        onClick={() => onAddToSchoolOrder(bundle)}
                        className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-[12px] font-['Fenomen_Sans',sans-serif] text-[11px] sm:text-[12px] font-bold text-white bg-[#001161] hover:bg-[#000a3d] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer border-0 text-center leading-tight"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                        {'P\u0159idat do objedn\u00e1vky'}
                      </button>
                      <Link
                        to={bundlePath}
                        className="flex-1 min-w-0 inline-flex items-center justify-center py-2 px-2 sm:px-3 rounded-[12px] font-['Fenomen_Sans',sans-serif] text-[11px] sm:text-[12px] font-normal text-[#92400e] underline underline-offset-2 hover:opacity-90 border border-[#d97706]/35 bg-white/90 text-center leading-tight"
                      >
                        {'V\u00edce o akci'}
                      </Link>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                {intro}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 sm:gap-x-2.5 gap-y-1.5 w-full min-w-0">
                  {!isSubjectBundle ? standardPriceBlock : null}
                  {actionsBlockPdp}
                </div>
              </>
            )}
            {!isSubjectBundle && !linesOk && (
              <p className="text-[11px] text-[#9a3412] m-0">
                {'Bal\u00ed\u010dek te\u010d nejde p\u0159idat do ko\u0161\u00edku \u2014 chyb\u00ed produkt v katalogu nebo varianta.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
