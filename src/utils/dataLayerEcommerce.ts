import type { CartItem } from '../contexts/CartContext';

const CURRENCY = 'CZK';

export type EcommerceDataLayerItem = {
  item_id: string;
  item_name: string;
  currency: string;
  item_group: string;
  price: number;
  quantity?: number;
  item_variant?: string;
};

type ProductLike = {
  id?: string | number;
  productId?: string | number;
  name?: string;
  title?: string;
  category?: string;
  type?: string;
  priceAmount?: number;
  shopifyVariantId?: string;
  variantId?: string;
  shoptetId?: string;
  shoptetProductId?: string;
  merchCategory?: string;
  bundleId?: string;
  bundleTitle?: string;
};

type DataLayerEvent = {
  event: string;
  ecommerce?: Record<string, unknown>;
  checkout_step?: number;
  checkout_step_name?: string;
  checkout_option?: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

function priceFromHaler(amount: number | undefined): number {
  if (!Number.isFinite(amount ?? NaN)) return 0;
  return Number(((amount ?? 0) / 100).toFixed(2));
}

function itemGroupFromProduct(product: ProductLike): string {
  return String(product.category || product.merchCategory || product.type || product.bundleTitle || 'product').trim();
}

function itemGroupFromCartItem(item: CartItem): string {
  return String(item.itemGroup || item.bundleTitle || (item.bundleId ? 'bundle' : 'product')).trim();
}

function ensureDataLayer(): unknown[] | null {
  if (typeof window === 'undefined') return null;
  window.dataLayer = window.dataLayer ?? [];
  return window.dataLayer;
}

export function pushDataLayerEvent(payload: DataLayerEvent): void {
  const dataLayer = ensureDataLayer();
  if (!dataLayer) return;
  dataLayer.push(payload);
}

export function dataLayerItemFromProduct(
  product: ProductLike,
  options: {
    itemId?: string;
    itemName?: string;
    itemGroup?: string;
    priceHaler?: number;
    quantity?: number;
    variantName?: string;
  } = {},
): EcommerceDataLayerItem {
  const itemId = String(
    options.itemId ||
    product.shopifyVariantId ||
    product.variantId ||
    product.shoptetId ||
    product.shoptetProductId ||
    product.id ||
    product.productId ||
    '',
  );
  const priceHaler =
    typeof options.priceHaler === 'number'
      ? options.priceHaler
      : typeof product.priceAmount === 'number'
        ? Math.round(product.priceAmount * 100)
        : 0;
  return {
    item_id: itemId || 'unknown',
    item_name: String(options.itemName || product.name || product.title || 'Produkt'),
    currency: CURRENCY,
    item_group: String(options.itemGroup || itemGroupFromProduct(product) || 'product'),
    price: priceFromHaler(priceHaler),
    ...(options.quantity ? { quantity: options.quantity } : {}),
    ...(options.variantName ? { item_variant: options.variantName } : {}),
  };
}

export function dataLayerItemFromCartItem(item: CartItem): EcommerceDataLayerItem {
  return {
    item_id: item.variantId || item.productId || 'unknown',
    item_name: item.productName,
    currency: CURRENCY,
    item_group: itemGroupFromCartItem(item) || 'product',
    price: priceFromHaler(item.unitPrice),
    quantity: item.quantity,
    ...(item.variantName ? { item_variant: item.variantName } : {}),
  };
}

export function pushViewContent(item: EcommerceDataLayerItem): void {
  pushDataLayerEvent({
    event: 'view_content',
    ecommerce: {
      currency: CURRENCY,
      value: item.price,
      items: [item],
    },
  });
}

export function pushAddToCart(item: CartItem): void {
  const dlItem = dataLayerItemFromCartItem(item);
  pushDataLayerEvent({
    event: 'add_to_cart',
    ecommerce: {
      currency: CURRENCY,
      value: Number((dlItem.price * (dlItem.quantity ?? 1)).toFixed(2)),
      items: [dlItem],
    },
  });
}

function checkoutEventName(step: number): string {
  if (step === 1) return 'begin_checkout';
  if (step === 3) return 'add_shipping_info';
  if (step === 4) return 'add_payment_info';
  return `checkout_step${step}`;
}

export function pushCheckoutStep(
  step: number,
  stepName: string,
  items: CartItem[],
  valueHaler: number,
  checkoutOption?: string,
): void {
  pushDataLayerEvent({
    event: checkoutEventName(step),
    checkout_step: step,
    checkout_step_name: stepName,
    ...(checkoutOption ? { checkout_option: checkoutOption } : {}),
    ecommerce: {
      currency: CURRENCY,
      value: priceFromHaler(valueHaler),
      items: items.map(dataLayerItemFromCartItem),
    },
  });
}

function schoolOrderEventName(step: number): string {
  if (step === 1) return 'school_order_start';
  if (step === 4) return 'add_shipping_info';
  if (step === 5) return 'add_payment_info';
  return `school_order_step${step}`;
}

export function pushSchoolOrderStep(params: {
  step: number;
  stepName: string;
  items: CartItem[];
  valueHaler: number;
  checkoutOption?: string;
}): void {
  pushDataLayerEvent({
    event: schoolOrderEventName(params.step),
    checkout_step: params.step,
    checkout_step_name: params.stepName,
    ...(params.checkoutOption ? { checkout_option: params.checkoutOption } : {}),
    ecommerce: {
      currency: CURRENCY,
      value: priceFromHaler(params.valueHaler),
      items: params.items.map(dataLayerItemFromCartItem),
    },
  });
}

export function pushPurchase(params: {
  transactionId: string;
  valueHaler: number;
  shippingHaler?: number;
  items: EcommerceDataLayerItem[];
}): void {
  pushDataLayerEvent({
    event: 'purchase',
    ecommerce: {
      transaction_id: params.transactionId,
      transaction_ID: params.transactionId,
      currency: CURRENCY,
      value: priceFromHaler(params.valueHaler),
      shipping: priceFromHaler(params.shippingHaler ?? 0),
      items: params.items,
    },
  });
}
