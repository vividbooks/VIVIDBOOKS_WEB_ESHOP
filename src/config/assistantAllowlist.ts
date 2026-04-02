/**
 * Kdo smí používat asistenta (Google přihlášení).
 * Porovnání e-mailu je bez rozlišení velikosti písmen.
 *
 * Doplňte adresy do pole níže, nebo nastavte env:
 *   VITE_ASSISTANT_ALLOWED_EMAILS="a@firma.cz,b@firma.cz"
 *
 * Lokální vývoj bez seznamu: VITE_ASSISTANT_ALLOWLIST_OFF=true (v .env.local)
 *
 * Pozn.: jde o kontrolu na klientovi; pro API použijte v Supabase sekci
 * ASSISTANT_ALLOWED_EMAILS u edge funkce make-server (viz index.ts).
 */
const ASSISTANT_ALLOWED_EMAILS: string[] = [
  'iveta@vividbooks.com',
  'vitek@vividbooks.com',
  'dan@vividbooks.com',
  'jiri@vividbooks.com',
  'eva.b@vividbooks.com',
  'gabriela@vividbooks.com',
];

function allowlistBypassEnabled(): boolean {
  const v = import.meta.env.VITE_ASSISTANT_ALLOWLIST_OFF as string | undefined;
  return v === 'true' || v === '1' || v === 'yes';
}

function parseEnvList(): string[] {
  const raw = import.meta.env.VITE_ASSISTANT_ALLOWED_EMAILS as string | undefined;
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

let cached: Set<string> | null = null;

export function getAssistantAllowedEmails(): Set<string> {
  if (cached) return cached;
  const fromCode = ASSISTANT_ALLOWED_EMAILS.map((e) => e.trim().toLowerCase()).filter(Boolean);
  cached = new Set([...fromCode, ...parseEnvList()]);
  return cached;
}

export function isAssistantEmailAllowed(email: string | null | undefined): boolean {
  if (allowlistBypassEnabled()) return true;
  if (!email?.trim()) return false;
  return getAssistantAllowedEmails().has(email.trim().toLowerCase());
}
