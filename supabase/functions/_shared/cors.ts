const ALLOWED_ORIGINS = new Set([
  'https://new.vividbooks.com',
  'https://project-e4jce.vercel.app',
  'https://www.vividbooks.com',
  'https://vividbooks.com',
  'http://localhost:3000',
  'https://localhost:3000',
  'http://127.0.0.1:3000',
  'https://127.0.0.1:3000',
  'http://localhost:5173',
  'https://localhost:5173',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'http://localhost',
  'https://localhost',
  'http://127.0.0.1',
  'https://127.0.0.1',
]);

function normalizeOrigin(origin: string | null | undefined): string {
  return (origin || '').trim().replace(/\/+$/, '');
}

export function resolveAllowedOrigin(origin: string | null | undefined): string {
  const normalized = normalizeOrigin(origin);
  if (ALLOWED_ORIGINS.has(normalized)) return normalized;
  return 'https://new.vividbooks.com';
}
