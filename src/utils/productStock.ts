import { projectId, publicAnonKey } from './supabase/info';

const PRODUCT_STOCK_STATUS_BASE = `https://${projectId}.supabase.co/functions/v1/product-stock-status`;
const HEADERS = {
  Authorization: `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

export interface ProductStockStatus {
  code: 'in_stock' | 'low' | 'waiting' | 'unknown';
  label: string;
}

export interface ProductStockItem {
  id: string;
  name: string;
  type?: string | null;
  category?: string | null;
  image?: string | null;
  price?: string | null;
  isbn?: string | null;
  ean?: string | null;
  shoptetId?: string | null;
  basecomProductId?: string | null;
  basecomSku?: string | null;
  quantity?: number | null;
  stockStatus: ProductStockStatus;
  matched: boolean;
  matchType?: string | null;
  matchedProductId?: string | null;
  matchedSku?: string | null;
  inventoryId?: string | null;
  inventoryName?: string | null;
  warehouseId?: string | null;
}

export interface ProductStockInventoryMeta {
  inventoryId?: string | null;
  inventoryName?: string | null;
  warehouseId?: string | null;
}

export async function fetchProductStockItem(productId: string) {
  const url = new URL(PRODUCT_STOCK_STATUS_BASE);
  url.searchParams.set('productId', productId);

  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch product stock failed: ${err}`);
  }

  return res.json() as Promise<{
    item: ProductStockItem;
  }>;
}

export async function fetchAllProductStocks(params?: { physicalOnly?: boolean }) {
  const url = new URL(PRODUCT_STOCK_STATUS_BASE);
  if (params?.physicalOnly === false) {
    url.searchParams.set('physicalOnly', 'false');
  }

  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch product stock list failed: ${err}`);
  }

  return res.json() as Promise<{
    inventory: ProductStockInventoryMeta;
    items: ProductStockItem[];
  }>;
}
