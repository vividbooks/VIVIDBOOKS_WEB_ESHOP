export function getProductFlipbookUrl(product: unknown): string | null {
  const record = product as { previewLink?: unknown; flipbookLink?: unknown } | null;
  const raw = String(record?.flipbookLink || record?.previewLink || '').trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  return raw;
}

