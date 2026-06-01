import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { BookOpen, ChevronDown, ChevronUp, Plus, Sparkles, X } from 'lucide-react';
import { useProducts } from '../../contexts/ProductsContext';
import { CartItem, useCart } from '../../contexts/CartContext';
import {
  getCartUpsellRecommendations,
  getProductImage,
  getProductUnitPriceInHaler,
  getProductVariantId,
  isAddable,
  isDigitalProduct,
  parseSubject,
  SUBJECT_COLORS,
} from '../cartUpsellUtils';
import { BOOK_COVER_DROP_SHADOW } from './BookCoverThumb';
import { productDetailPath } from '../../utils/slugify';

function formatProductPrice(product: any): string {
  const amount = getProductUnitPriceInHaler(product);
  if (amount <= 0) return '';

  return `${(amount / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

function MiniBookCard({
  product,
  onAdd,
  onNavigate,
  addingId,
}: {
  product: any;
  onAdd: (product: any) => void;
  onNavigate: (product: any) => void;
  addingId: string | null;
}) {
  const [isLandscape, setIsLandscape] = useState(false);
  const isAdding = addingId === (product.id || product._id);
  const subject = parseSubject(product.name || product.title || '');
  const colors = SUBJECT_COLORS[subject || ''] ?? SUBJECT_COLORS.default;
  const image = getProductImage(product);
  const price = formatProductPrice(product);
  /**
   * Digitální produkty (online přístup / licence) nelze koupit jednorázově přes košík –
   * jdou jen jako Stripe předplatné nebo přes „Poptávka pro školu". Tlačítko proto
   * vede na detail produktu, ne na addItem.
   */
  const isDigital = isDigitalProduct(product);

  return (
    <div
      onClick={() => onNavigate(product)}
      className="flex-shrink-0 w-[148px] rounded-[14px] border cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform flex flex-col"
      style={{ borderColor: `${colors.accent}22`, background: colors.bg }}
    >
      <div className="flex justify-center items-start px-2 pt-3 pb-2 min-h-[108px]">
        {image ? (
          <img
            src={image}
            alt={product.name || product.title || ''}
            className={`max-h-[112px] w-auto ${isLandscape ? 'max-w-[92%]' : 'max-w-[72%]'} object-contain`}
            style={{ filter: BOOK_COVER_DROP_SHADOW }}
            onLoad={(e) => {
              const img = e.currentTarget;
              setIsLandscape(img.naturalWidth >= img.naturalHeight);
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[88px] opacity-30">
            <BookOpen className="w-6 h-6" style={{ color: colors.text }} />
          </div>
        )}
      </div>
      <div className="px-2.5 pt-1 pb-2.5 flex flex-col flex-1">
        <p
          className="text-[12px] font-bold leading-[1.25] line-clamp-3 mb-1.5"
          style={{ fontFamily: "'Fenomen Sans', sans-serif", color: colors.text }}
        >
          {product.name || product.title}
        </p>
        {price && (
          <p
            className="text-[11px] font-bold mb-1.5 opacity-60"
            style={{ fontFamily: "'Fenomen Sans', sans-serif", color: colors.text }}
          >
            {price}
          </p>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (isDigital) {
              onNavigate(product);
              return;
            }
            onAdd(product);
          }}
          disabled={isAdding || (!isDigital && !isAddable(product))}
          className="w-full flex items-center justify-center gap-1 py-2 rounded-[8px] text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer"
          style={{ fontFamily: "'Fenomen Sans', sans-serif", background: colors.text, color: '#fff' }}
        >
          {isAdding ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isDigital ? (
            <>
              <Sparkles className="w-3 h-3 shrink-0" />
              {'Zobrazit detail'}
            </>
          ) : (
            <>
              <Plus className="w-3 h-3 shrink-0" />
              {'Do košíku'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function UpsellChip({
  icon,
  label,
  accentColor,
  defaultOpen = false,
  onDismiss,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  accentColor: string;
  defaultOpen?: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-[12px] overflow-hidden border transition-all"
      style={{ borderColor: `${accentColor}22`, background: '#fff' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div
          className="w-7 h-7 rounded-[9px] flex items-center justify-center flex-shrink-0 text-[15px]"
          style={{ background: `${accentColor}14` }}
        >
          {icon}
        </div>
        <span
          className="flex-1 text-[13px] md:text-[14px] font-bold leading-snug text-[#001161]"
          style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
        >
          {label}
        </span>
        <div className="flex items-center gap-1">
          <div className="text-[#001161]/30">
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDismiss();
            }}
            className="w-4.5 h-4.5 flex items-center justify-center rounded-full text-[#001161]/25 hover:text-[#001161]/60 hover:bg-[#001161]/6 transition-all cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={defaultOpen ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="mx-2.5 mb-2.5 rounded-[10px] px-2.5 pt-2 pb-2.5"
              style={{ background: `${accentColor}08` }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function InternalCartUpsellSection({
  cartItems,
  openCartAfterAdd = true,
}: {
  cartItems: CartItem[];
  /** V checkoutu neotvírat drawer po „Do košíku“ */
  openCartAfterAdd?: boolean;
}) {
  const { products } = useProducts();
  const { addItem, openCart } = useCart();
  const navigate = useNavigate();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    const keys = new Set<string>();

    try {
      ['cross', 'digital', 'series'].forEach((key) => {
        if (sessionStorage.getItem(`ub_internal_${key}`) === '1') keys.add(key);
      });
    } catch {
      // Session persistence is only a UX enhancement.
    }

    return keys;
  });

  const dismiss = (key: string) => {
    try {
      sessionStorage.setItem(`ub_internal_${key}`, '1');
    } catch {
      // Ignore storage failures.
    }

    setDismissed((prev) => new Set([...prev, key]));
  };

  const { crossCard, seriesCard, digitalCard } = useMemo(() => (
    getCartUpsellRecommendations(
      cartItems.map((item) => ({
        productTitle: item.productName,
        variantId: item.variantId,
      })),
      products,
    )
  ), [cartItems, products]);

  const handleAdd = (product: any) => {
    /**
     * Digitální produkty (online přístup / licence) se z upsell sekce nepřidávají do košíku
     * – pro ně existuje Stripe předplatné nebo poptávka pro školu. Proklik vede na detail.
     */
    if (isDigitalProduct(product)) {
      navigate(productDetailPath(product, products));
      return;
    }

    const variantId = getProductVariantId(product);
    if (!variantId) return;

    setAddingId(product.id || product._id);
    addItem({
      productId: String(product.id || product.productId || variantId),
      productName: product.name || product.title || 'Produkt',
      variantId,
      quantity: 1,
      unitPrice: getProductUnitPriceInHaler(product),
      imageUrl: getProductImage(product),
      itemGroup: product.category || product.merchCategory || product.type || undefined,
    });
    if (openCartAfterAdd) openCart();
    setAddingId(null);
  };

  const handleNavigate = (product: any) => {
    navigate(productDetailPath(product, products));
  };

  const seriesGenitiv: Record<string, string> = {
    Fyzika: 'Fyziky',
    Chemie: 'Chemie',
    Přírodopis: 'Přírodopisu',
    Matematika: 'Matematiky',
    'Anglický jazyk': 'Anglického jazyka',
    'Český jazyk': 'Českého jazyka',
    Prvouka: 'Prvouky',
  };

  type ChipData = { key: string; node: React.ReactNode };
  const chips: ChipData[] = [];

  const mergeSeriesIntoCross =
    !!crossCard &&
    !dismissed.has('cross') &&
    !!seriesCard &&
    !dismissed.has('series');

  if (crossCard && !dismissed.has('cross')) {
    chips.push({
      key: 'cross',
      node: (
        <UpsellChip
          key="cross"
          icon="🎒"
          label={`Doplňte si ${crossCard.grade}. ročník — další předměty`}
          accentColor="#7C3AED"
          defaultOpen
          onDismiss={() => {
            dismiss('cross');
            if (mergeSeriesIntoCross) dismiss('series');
          }}
        >
          <p
            className="text-[12px] text-[#001161]/50 mb-2 font-semibold"
            style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
          >
            {'Učebnice jiných předmětů pro stejný ročník'}
          </p>
          <div className="flex gap-2 overflow-x-auto pt-0.5 pb-1" style={{ scrollbarWidth: 'none' }}>
            {crossCard.items.map((product) => (
              <MiniBookCard
                key={product.id}
                product={product}
                onAdd={handleAdd}
                onNavigate={handleNavigate}
                addingId={addingId}
              />
            ))}
          </div>
          {mergeSeriesIntoCross && seriesCard && (
            <>
              <div className="my-3 h-px bg-[#001161]/10" />
              <p
                className="text-[12px] text-[#001161]/50 mb-2 font-semibold"
                style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
              >
                {`Další díly ${seriesGenitiv[seriesCard.subject] ?? seriesCard.subject}`}
              </p>
              <p className="text-[11px] text-[#001161]/40 mb-2" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                {'Stejný ročník — další tituly a díly'}
              </p>
              <div className="flex gap-2 overflow-x-auto pt-0.5 pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {seriesCard.items.map((product) => (
                  <MiniBookCard
                    key={product.id}
                    product={product}
                    onAdd={handleAdd}
                    onNavigate={handleNavigate}
                    addingId={addingId}
                  />
                ))}
              </div>
            </>
          )}
        </UpsellChip>
      ),
    });
  }

  if (digitalCard && !dismissed.has('digital') && chips.length < 3) {
    const hasConcreteItems = digitalCard.items.length > 0;

    chips.push({
      key: 'digital',
      node: (
        <UpsellChip
          key="digital"
          icon={<Sparkles className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />}
          label="Oživte učebnici — digitální přístup"
          accentColor="#7C3AED"
          onDismiss={() => dismiss('digital')}
        >
          <div className="space-y-2.5 pt-0.5">
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { icon: '🎬', label: 'Animované lekce' },
                { icon: '✏️', label: 'Interaktivní cvičení' },
                { icon: '📝', label: 'Testy a písemky' },
                { icon: '🔷', label: '3D modely a simulace' },
              ].map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-1.5 rounded-[8px] px-2 py-1.5"
                  style={{ background: 'rgba(124,58,237,0.06)' }}
                >
                  <span className="text-[12px]">{feature.icon}</span>
                  <span
                    className="text-[10px] font-bold text-[#001161]"
                    style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
                  >
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>

            {hasConcreteItems && (
              <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {digitalCard.items.map((product) => (
                  <MiniBookCard
                    key={product.id}
                    product={product}
                    onAdd={handleAdd}
                    onNavigate={handleNavigate}
                    addingId={addingId}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#001161]/35 flex-1" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
                {'14 dní zdarma na vyzkoušení'}
              </span>
              <button
                type="button"
                onClick={() => navigate('/vyzkousejte')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[999px] text-[11px] font-black text-white cursor-pointer transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ fontFamily: "'Fenomen Sans', sans-serif", background: '#7C3AED' }}
              >
                <Sparkles className="w-3 h-3" />
                {'Vyzkoušet zdarma'}
              </button>
            </div>
          </div>
        </UpsellChip>
      ),
    });
  }

  if (
    seriesCard &&
    !dismissed.has('series') &&
    chips.length < 3 &&
    !mergeSeriesIntoCross
  ) {
    chips.push({
      key: 'series',
      node: (
        <UpsellChip
          key="series"
          icon="📖"
          label={`Další díly ${seriesGenitiv[seriesCard.subject] ?? seriesCard.subject}`}
          accentColor={seriesCard.colors.accent}
          onDismiss={() => dismiss('series')}
        >
          <p className="text-[12px] text-[#001161]/50 mb-2 font-semibold" style={{ fontFamily: "'Fenomen Sans', sans-serif" }}>
            {'Stejný ročník — další tituly a díly'}
          </p>
          <div className="flex gap-2 overflow-x-auto pt-0.5 pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {seriesCard.items.map((product) => (
              <MiniBookCard
                key={product.id}
                product={product}
                onAdd={handleAdd}
                onNavigate={handleNavigate}
                addingId={addingId}
              />
            ))}
          </div>
        </UpsellChip>
      ),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="px-5 py-2.5 bg-[#f8f9fd] border-t border-[#001161]/6">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-2.5 h-2.5 text-[#7C3AED]" />
        <p
          className="text-[11px] font-black uppercase tracking-widest text-[#001161]/40"
          style={{ fontFamily: "'Fenomen Sans', sans-serif" }}
        >
          {'Mohlo by se vám také hodit'}
        </p>
      </div>

      <AnimatePresence mode="popLayout">
        <div className="flex flex-col gap-1.5">
          {chips.map((chip) => (
            <motion.div
              key={chip.key}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
            >
              {chip.node}
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
