// ╔══════════════════════════════════════════════════════════════╗
// ║  Shopify Headless Commerce — Konfigurace                     ║
// ║                                                              ║
// ║  Jak získat přihlašovací údaje:                              ║
// ║  1. Shopify Admin → Settings → Apps and sales channels       ║
// ║  2. Develop apps → Create an app → Configure Storefront API  ║
// ║  3. Povolte: unauthenticated_read_product_listings,          ║
// ║              unauthenticated_write_checkouts,                ║
// ║              unauthenticated_read_checkouts                  ║
// ║  4. Install app → zkopírujte "Storefront API access token"   ║
// ╚══════════════════════════════════════════════════════════════╝

// Vaše Shopify doména (bez https://)
// Příklad: 'vividbooks.myshopify.com'
export const SHOPIFY_DOMAIN = 'vividbooks.myshopify.com';

// Veřejný Storefront API token (bezpečné mít ve frontendu)
export const SHOPIFY_STOREFRONT_TOKEN = '6e90612d0f2f4a5eaa062133f7af09a9';

// Verze API — ponechte aktuální
export const SHOPIFY_API_VERSION = '2026-01';

// Pomocný flag — true pokud je Shopify nakonfigurován
export const isShopifyConfigured =
  Boolean(SHOPIFY_DOMAIN && SHOPIFY_STOREFRONT_TOKEN);