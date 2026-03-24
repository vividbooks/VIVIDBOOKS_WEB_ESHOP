import { SHOPIFY_DOMAIN, SHOPIFY_STOREFRONT_TOKEN, SHOPIFY_API_VERSION } from './config';

/**
 * Obecný GraphQL klient pro Shopify Storefront API.
 * Storefront token je veřejný — Shopify ho záměrně vystavuje v JS.
 */
export async function shopifyFetch<T = any>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const url = `https://${SHOPIFY_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Shopify] HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();

  if (json.errors?.length) {
    const msgs = json.errors.map((e: any) => e.message).join('; ');
    throw new Error(`[Shopify] GraphQL: ${msgs}`);
  }

  return json.data as T;
}
