/**
 * Jiná doručovací adresa z pokladny (přepínač „Doručit na jinou adresu“).
 *
 * Pokladna posílá `shipping.differentAddress` + `shipping.deliveryAddress`. Tenhle modul ji převede
 * na hodnoty sloupců `orders.delivery_*` — sdílí ho create-payment-intent, submit-transfer-order
 * i stripe-webhook, aby všechny cesty zápisu objednávky ukládaly adresu stejně.
 *
 * Když přepínač není zapnutý (nebo adresa chybí), vrací samé `null` = doručit na fakturační adresu.
 */

export type CheckoutDeliveryAddressInput = {
  differentAddress?: boolean;
  deliveryAddress?: {
    recipientName?: string;
    street?: string;
    city?: string;
    zip?: string;
  } | null;
};

export type OrderDeliveryColumns = {
  delivery_recipient_name: string | null;
  delivery_street: string | null;
  delivery_city: string | null;
  delivery_zip: string | null;
};

export const EMPTY_ORDER_DELIVERY_COLUMNS: OrderDeliveryColumns = {
  delivery_recipient_name: null,
  delivery_street: null,
  delivery_city: null,
  delivery_zip: null,
};

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** `orders.delivery_*` z payloadu pokladny. Bez ulice adresu neukládáme (nebylo by kam doručit). */
export function orderDeliveryColumnsFromShipping(
  shipping: CheckoutDeliveryAddressInput | null | undefined,
): OrderDeliveryColumns {
  if (!shipping || shipping.differentAddress !== true) return { ...EMPTY_ORDER_DELIVERY_COLUMNS };
  const da = shipping.deliveryAddress;
  if (!da || typeof da !== 'object') return { ...EMPTY_ORDER_DELIVERY_COLUMNS };
  const street = cleanText(da.street);
  if (!street) return { ...EMPTY_ORDER_DELIVERY_COLUMNS };
  return {
    delivery_recipient_name: cleanText(da.recipientName),
    delivery_street: street,
    delivery_city: cleanText(da.city),
    delivery_zip: cleanText(da.zip),
  };
}

/** Řádek `orders` (nebo jeho část) → má objednávka jinou doručovací adresu než fakturační? */
export function hasSeparateDeliveryAddress(
  order: Partial<OrderDeliveryColumns> | null | undefined,
): order is OrderDeliveryColumns & { delivery_street: string } {
  return Boolean(order && typeof order.delivery_street === 'string' && order.delivery_street.trim());
}

/** Zpět do tvaru payloadu pokladny (`differentAddress` / `deliveryAddress`) — pro Pipedrive sync apod. */
export function deliveryInfoFromOrderRow(
  order: Partial<OrderDeliveryColumns> | null | undefined,
): CheckoutDeliveryAddressInput {
  if (!hasSeparateDeliveryAddress(order)) return { differentAddress: false };
  return {
    differentAddress: true,
    deliveryAddress: {
      recipientName: order.delivery_recipient_name ?? '',
      street: order.delivery_street,
      city: order.delivery_city ?? '',
      zip: order.delivery_zip ?? '',
    },
  };
}
