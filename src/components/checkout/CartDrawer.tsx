import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingCart, Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import { getCartLineKey, useCart } from '../../contexts/CartContext';
import { useProducts } from '../../contexts/ProductsContext';
import { getProductUnitPriceInHaler } from '../cartUpsellUtils';
import { BookCoverThumb } from './BookCoverThumb';

function formatPrice(amountInHaler: number): string {
  return `${(amountInHaler / 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center gap-5">
      <div
        className="w-24 h-24 rounded-full bg-[#f1f3f8] flex items-center justify-center"
        style={{ transform: 'rotate(-12deg)' }}
      >
        <ShoppingCart className="w-10 h-10 text-[#001161]/25" />
      </div>
      <div>
        <p className="font-['Cooper_Light',serif] text-[#001161] text-[22px] leading-tight mb-2">
          {'Košík je prázdný'}
        </p>
        <p className="font-['Fenomen_Sans',sans-serif] text-[14px] text-[#001161]/50 leading-relaxed">
          {'Přidejte produkty do nového košíku a vraťte se sem.'}
        </p>
      </div>
      <button
        onClick={onClose}
        className="mt-2 px-6 py-3 bg-[#001161] hover:bg-[#000a3d] text-white rounded-[14px] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      >
        {'Procházet katalog'}
      </button>
    </div>
  );
}

function CartRow({
  productId,
  productName,
  variantId,
  variantName,
  quantity,
  unitPrice,
  imageUrl,
  bundleTitle,
  bundleInstanceId,
}: ReturnType<typeof useCart>['items'][number]) {
  const { updateQuantity, removeItem } = useCart();

  return (
    <div className="flex items-start gap-2.5 py-3 border-b border-[#001161]/6 last:border-none">
      <BookCoverThumb imageUrl={imageUrl} alt={productName} size="sm" />

      <div className="flex-1 min-w-0 flex flex-col justify-between pt-0.5">
        <div>
          <p className="font-['Fenomen_Sans',sans-serif] text-[12px] font-bold text-[#001161] leading-snug line-clamp-2">
            {productName}
          </p>
          {bundleTitle && bundleInstanceId && (
            <p className="font-['Fenomen_Sans',sans-serif] text-[9px] text-[#001161]/35 mt-0.5 uppercase tracking-wide">
              {`Balíček · ${bundleTitle}`}
            </p>
          )}
          {variantName && (
            <p className="font-['Fenomen_Sans',sans-serif] text-[10px] text-[#001161]/45 mt-0.5">
              {variantName}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-1.5 gap-2">
          <div className="flex items-center gap-0.5 bg-[#f1f3f8] rounded-[10px] p-0.5">
            <button
              onClick={() => updateQuantity(productId, variantId, quantity - 1, bundleInstanceId)}
              className="w-6 h-6 flex items-center justify-center rounded-[8px] hover:bg-white transition-colors text-[#001161] cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-['Fenomen_Sans',sans-serif] text-[12px] font-bold text-[#001161] w-5 text-center select-none">
              {quantity}
            </span>
            <button
              onClick={() => updateQuantity(productId, variantId, quantity + 1, bundleInstanceId)}
              className="w-6 h-6 flex items-center justify-center rounded-[8px] hover:bg-white transition-colors text-[#001161] cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-['Fenomen_Sans',sans-serif] text-[12px] font-bold text-[#001161]">
              {formatPrice(unitPrice * quantity)}
            </span>
            <button
              onClick={() => removeItem(productId, variantId, bundleInstanceId)}
              className="w-6 h-6 flex items-center justify-center rounded-[8px] text-[#001161]/30 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
              aria-label="Odebrat"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CartDrawer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { products } = useProducts();
  const { items, itemCount, subtotal, isCartOpen, closeCart, replaceUnitPrice } = useCart();

  /** Overlay košíku (z-[90]) by jinak mohla zůstat přes celou pokladnu při zvláštním toku navigace. */
  useEffect(() => {
    if ((location.pathname === '/pokladna' || location.pathname === '/platit') && isCartOpen) closeCart();
  }, [location.pathname, isCartOpen, closeCart]);

  useEffect(() => {
    if (products.length === 0) return;
    items.forEach((item) => {
      if (item.unitPrice > 0) return;
      if (item.bundleInstanceId) return;
      const product = products.find((p) => String(p.id) === String(item.productId));
      if (!product) return;
      const nextUnitPrice = getProductUnitPriceInHaler(product);
      if (nextUnitPrice > 0) {
        replaceUnitPrice(item.productId, item.variantId, nextUnitPrice, item.bundleInstanceId);
      }
    });
  }, [items, products, replaceUnitPrice]);

  const handleCheckout = () => {
    closeCart();
    navigate('/pokladna');
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] bg-black/35 max-md:bg-black/40 md:backdrop-blur-[2px]"
            onClick={closeCart}
          />

          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 bottom-0 z-[91] w-full max-w-[400px] bg-white shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#001161]/6">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-4.5 h-4.5 text-[#001161]" />
                <h2 className="font-['Cooper_Light',serif] text-[#001161] text-[20px]">
                  {'Nový košík'}
                </h2>
                {itemCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full bg-[#001161] text-white font-['Fenomen_Sans',sans-serif] text-[10px] font-bold">
                    {itemCount}
                  </span>
                )}
              </div>

              <button
                onClick={closeCart}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-[#001161]/40 hover:text-[#001161] hover:bg-[#f1f3f8] transition-all cursor-pointer ml-2"
                aria-label="Zavřít košík"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {items.length === 0 ? (
              <EmptyCart onClose={closeCart} />
            ) : (
              <>
                <div className="flex-1 overflow-y-auto">
                  <div className="px-5 py-1.5">
                    {items.map((item) => (
                      <CartRow
                        key={getCartLineKey(item.productId, item.variantId, item.bundleInstanceId)}
                        {...item}
                      />
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#001161]/6 px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/55">
                      {'Mezisoučet'}
                    </span>
                    <span className="font-['Fenomen_Sans',sans-serif] text-[15px] font-bold text-[#001161]">
                      {formatPrice(subtotal)}
                    </span>
                  </div>

                  <p className="font-['Fenomen_Sans',sans-serif] text-[10px] text-[#001161]/35 text-center leading-snug">
                    {'Dopravu a zp\u016fsob platby vyberete v pokladn\u011b.'}
                  </p>

                  <button
                    onClick={handleCheckout}
                    className="flex items-center justify-center gap-2 w-full py-3.5 px-5 bg-[#001161] hover:bg-[#000a3d] text-white rounded-[16px] font-['Fenomen_Sans',sans-serif] text-[14px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[0_8px_24px_rgba(0,17,97,0.25)]"
                    style={{ transform: 'rotate(-0.5deg)' }}
                  >
                    {'Přejít k pokladně'}
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>

                  <button
                    onClick={closeCart}
                    className="w-full py-1.5 text-center font-['Fenomen_Sans',sans-serif] text-[12px] text-[#001161]/40 hover:text-[#001161] transition-colors cursor-pointer"
                  >
                    {'Pokračovat v nákupu'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
