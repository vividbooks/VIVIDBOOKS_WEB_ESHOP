/**
 * Kanonický obsah pro hash idempotence pokladny — sdílený create-payment-intent + submit-transfer-order.
 */
import { normalizeEmail } from './email-validation.ts';

export function sortKeysDeep(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj as object).sort()) {
    sorted[k] = sortKeysDeep((obj as Record<string, unknown>)[k]);
  }
  return sorted;
}

export async function sha256HexOfString(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type IdempotencyItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  variant?: string;
  bundleId?: string;
  bundleTitle?: string;
  posterMerch?: boolean;
};

export type IdempotencyShipping = {
  method: string;
  price: number;
  pickupPointId?: string;
  pickupPointName?: string;
  differentAddress?: boolean;
  deliveryAddress?: {
    recipientName?: string;
    street?: string;
    city?: string;
    zip?: string;
  };
};

export type IdempotencyCustomer = {
  email: string;
  name: string;
  phone: string;
  schoolName?: string;
  ico?: string;
  street: string;
  city: string;
  zip: string;
};

/** Stejný kanonický tvar jako dříve v create-payment-intent — aby hash košíku seděl napříč platbou kartou i převodem. */
export function buildPaymentIntentIdempotencyPayload(
  items: IdempotencyItem[],
  shipping: IdempotencyShipping,
  customer: IdempotencyCustomer,
  checkoutPaymentMethod: string,
  schoolInquiryJson: string | null,
) {
  const sortedItems = [...items]
    .map((it) => ({
      productId: String(it.productId).trim(),
      productName: String(it.productName).trim(),
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      ...(typeof it.variant === 'string' && it.variant.trim() ? { variant: it.variant.trim() } : {}),
      ...(typeof it.bundleId === 'string' && it.bundleId.trim() ? { bundleId: it.bundleId.trim() } : {}),
      ...(typeof it.bundleTitle === 'string' && it.bundleTitle.trim()
        ? { bundleTitle: it.bundleTitle.trim() }
        : {}),
      ...(it.posterMerch === true ? { posterMerch: true } : {}),
    }))
    .sort((a, b) => {
      const c = a.productId.localeCompare(b.productId);
      if (c !== 0) return c;
      return JSON.stringify(a).localeCompare(JSON.stringify(b));
    });

  const ship: Record<string, unknown> = {
    method: String(shipping.method).trim(),
    price: shipping.price,
  };
  if (typeof shipping.pickupPointId === 'string' && shipping.pickupPointId.trim()) {
    ship.pickupPointId = shipping.pickupPointId.trim();
  }
  if (typeof shipping.pickupPointName === 'string' && shipping.pickupPointName.trim()) {
    ship.pickupPointName = shipping.pickupPointName.trim();
  }
  if (shipping.differentAddress) {
    ship.differentAddress = true;
    const da = shipping.deliveryAddress;
    ship.deliveryAddress = da && typeof da === 'object'
      ? {
        recipientName: typeof da.recipientName === 'string' ? da.recipientName.trim() : '',
        street: typeof da.street === 'string' ? da.street.trim() : '',
        city: typeof da.city === 'string' ? da.city.trim() : '',
        zip: typeof da.zip === 'string' ? da.zip.trim() : '',
      }
      : {};
  } else {
    ship.differentAddress = false;
  }

  const cust = {
    email: normalizeEmail(String(customer.email).trim()),
    name: String(customer.name).trim(),
    phone: String(customer.phone).trim(),
    schoolName: typeof customer.schoolName === 'string' ? customer.schoolName.trim() : '',
    ico: String(customer.ico ?? '').trim().replace(/\s/g, ''),
    street: String(customer.street).trim(),
    city: String(customer.city).trim(),
    zip: String(customer.zip).trim(),
  };

  let schoolInquiry: unknown = null;
  if (schoolInquiryJson) {
    try {
      schoolInquiry = sortKeysDeep(JSON.parse(schoolInquiryJson));
    } catch {
      schoolInquiry = schoolInquiryJson;
    }
  }

  return {
    v: 1,
    checkoutPaymentMethod,
    items: sortedItems,
    shipping: ship,
    customer: cust,
    schoolInquiry,
  };
}
