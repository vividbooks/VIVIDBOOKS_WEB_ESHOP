/**
 * Kdo smí do administrace (/admin, /marketing) po Google přihlášení.
 * Asistent používá zvlášť assistantAllowlist.ts.
 *
 * Env:
 *   VITE_ADMIN_ALLOWED_EMAILS="a@x.cz,b@y.cz" — nahradí výchozí seznam (prázdné = jen kód níže)
 *   VITE_ADMIN_ALLOWLIST_OFF=true — lokálně povolit kohokoli (stejně jako u asistenta)
 */

const ADMIN_ALLOWED_EMAILS: string[] = ['vitek@vividbooks.com', 'dan@vividbooks.com'];

function allowlistBypassEnabled(): boolean {
  const v = import.meta.env.VITE_ADMIN_ALLOWLIST_OFF as string | undefined;
  return v === 'true' || v === '1' || v === 'yes';
}

function parseEnvList(): string[] {
  const raw = import.meta.env.VITE_ADMIN_ALLOWED_EMAILS as string | undefined;
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

let cached: Set<string> | null = null;

export function getAdminAllowedEmails(): Set<string> {
  if (cached) return cached;
  const fromEnv = parseEnvList();
  const fromCode = ADMIN_ALLOWED_EMAILS.map((e) => e.trim().toLowerCase()).filter(Boolean);
  cached = new Set(fromEnv.length > 0 ? fromEnv : fromCode);
  return cached;
}

export function isAdminEmailAllowed(email: string | null | undefined): boolean {
  if (allowlistBypassEnabled()) return true;
  if (!email?.trim()) return false;
  return getAdminAllowedEmails().has(email.trim().toLowerCase());
}
