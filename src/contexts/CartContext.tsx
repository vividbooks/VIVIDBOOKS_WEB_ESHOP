import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface CartItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
  /** ID definice balíčku (KV). */
  bundleId?: string;
  bundleTitle?: string;
  /** Jedna instance přidání balíčku — odděluje řádky od běžného nákupu stejného produktu. */
  bundleInstanceId?: string;
  /** Plakáty / merch „na objednávku“ — objednávka jen z těchto řádků nejde do Base.com. */
  posterMerch?: boolean;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId?: string, bundleInstanceId?: string) => void;
  updateQuantity: (productId: string, variantId: string | undefined, quantity: number, bundleInstanceId?: string) => void;
  replaceUnitPrice: (productId: string, variantId: string | undefined, unitPrice: number, bundleInstanceId?: string) => void;
  removeBundleInstance: (bundleInstanceId: string) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  cartKey: string;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CART_STORAGE_KEY = 'vividbooks_cart_v1';

const CartContext = createContext<CartContextValue | null>(null);

function bundleKeyPart(bundleInstanceId?: string) {
  return bundleInstanceId && bundleInstanceId.length > 0 ? bundleInstanceId : '';
}

export function getCartLineKey(productId: string, variantId?: string, bundleInstanceId?: string) {
  return `${productId}::${variantId ?? ''}::${bundleKeyPart(bundleInstanceId)}`;
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.productId === 'string' &&
    typeof item.productName === 'string' &&
    typeof item.quantity === 'number' &&
    typeof item.unitPrice === 'number'
  );
}

function loadStoredCart(): CartItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isCartItem).map((item) => ({
      ...item,
      quantity: Math.max(1, Math.floor(item.quantity)),
      unitPrice: Math.max(0, Math.round(item.unitPrice)),
    }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadStoredCart);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const nextQuantity = Math.max(1, Math.floor(item.quantity || 1));
      const itemKey = getCartLineKey(item.productId, item.variantId, item.bundleInstanceId);
      const existingIndex = prev.findIndex(
        (existing) => getCartLineKey(existing.productId, existing.variantId, existing.bundleInstanceId) === itemKey,
      );

      if (existingIndex === -1) {
        return [
          ...prev,
          {
            ...item,
            quantity: nextQuantity,
            unitPrice: Math.max(0, Math.round(item.unitPrice)),
          },
        ];
      }

      return prev.map((existing, index) => (
        index === existingIndex
          ? {
              ...existing,
              quantity: existing.quantity + nextQuantity,
              unitPrice:
                existing.unitPrice > 0
                  ? existing.unitPrice
                  : Math.max(0, Math.round(item.unitPrice)),
            }
          : existing
      ));
    });
  }, []);

  const removeItem = useCallback((productId: string, variantId?: string, bundleInstanceId?: string) => {
    const key = getCartLineKey(productId, variantId, bundleInstanceId);
    setItems((prev) => prev.filter(
      (item) => getCartLineKey(item.productId, item.variantId, item.bundleInstanceId) !== key,
    ));
  }, []);

  const updateQuantity = useCallback((
    productId: string,
    variantId: string | undefined,
    quantity: number,
    bundleInstanceId?: string,
  ) => {
    const nextQuantity = Math.max(0, Math.floor(quantity));
    const key = getCartLineKey(productId, variantId, bundleInstanceId);

    if (nextQuantity === 0) {
      setItems((prev) => prev.filter(
        (item) => getCartLineKey(item.productId, item.variantId, item.bundleInstanceId) !== key,
      ));
      return;
    }

    setItems((prev) => prev.map((item) => (
      getCartLineKey(item.productId, item.variantId, item.bundleInstanceId) === key
        ? { ...item, quantity: nextQuantity }
        : item
    )));
  }, []);

  const replaceUnitPrice = useCallback((
    productId: string,
    variantId: string | undefined,
    unitPrice: number,
    bundleInstanceId?: string,
  ) => {
    const nextUnitPrice = Math.max(0, Math.round(unitPrice));
    const key = getCartLineKey(productId, variantId, bundleInstanceId);
    setItems((prev) => prev.map((item) => (
      getCartLineKey(item.productId, item.variantId, item.bundleInstanceId) === key
        ? { ...item, unitPrice: nextUnitPrice }
        : item
    )));
  }, []);

  const removeBundleInstance = useCallback((bundleInstanceId: string) => {
    if (!bundleInstanceId) return;
    setItems((prev) => prev.filter((item) => item.bundleInstanceId !== bundleInstanceId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(() => ({
    items,
    addItem,
    removeItem,
    updateQuantity,
    replaceUnitPrice,
    removeBundleInstance,
    clearCart,
    itemCount,
    subtotal,
    cartKey: CART_STORAGE_KEY,
    isCartOpen,
    openCart,
    closeCart,
    toggleCart,
  }), [
    items,
    addItem,
    removeItem,
    updateQuantity,
    replaceUnitPrice,
    removeBundleInstance,
    clearCart,
    itemCount,
    subtotal,
    isCartOpen,
    openCart,
    closeCart,
    toggleCart,
  ]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return context;
}
