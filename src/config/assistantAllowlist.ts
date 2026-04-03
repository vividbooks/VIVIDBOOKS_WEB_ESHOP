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

/**
 * Rozšířené záložky asistenta (Outreach, Scraping) — jen pro vybrané účty.
 * Stejné pravidlo jako u allowlistu: case-insensitive.
 *
 * Doplňte e-maily do pole níže, nebo env:
 *   VITE_ASSISTANT_EXTENDED_UI_EMAILS="admin@firma.cz"
 *
 * Při VITE_ASSISTANT_ALLOWLIST_OFF=true mají rozšířené UI všichni (stejně jako přístup).
 */
const ASSISTANT_EXTENDED_UI_EMAILS: string[] = [];

function parseEnvExtendedList(): string[] {
  const raw = import.meta.env.VITE_ASSISTANT_EXTENDED_UI_EMAILS as string | undefined;
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

let cachedExtended: Set<string> | null = null;

export function getAssistantExtendedUiEmails(): Set<string> {
  if (cachedExtended) return cachedExtended;
  const fromCode = ASSISTANT_EXTENDED_UI_EMAILS.map((e) => e.trim().toLowerCase()).filter(Boolean);
  cachedExtended = new Set([...fromCode, ...parseEnvExtendedList()]);
  return cachedExtended;
}

export function isAssistantExtendedUi(email: string | null | undefined): boolean {
  if (allowlistBypassEnabled()) return true;
  if (!email?.trim()) return false;
  return getAssistantExtendedUiEmails().has(email.trim().toLowerCase());
}

/**
 * Záložka „Web“ v diktování — RAG web operátor (smart-edit s manual_rag_trigger).
 * Env: VITE_ASSISTANT_RAG_WEB_DICTATION_EMAILS="a@x.cz,b@y.cz"
 */
const ASSISTANT_RAG_WEB_DICTATION_EMAILS: string[] = ['vitek@vividbook.com', 'vitek@vividbooks.com'];

function parseEnvRagWebDictationList(): string[] {
  const raw = import.meta.env.VITE_ASSISTANT_RAG_WEB_DICTATION_EMAILS as string | undefined;
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

let cachedRagWebDictation: Set<string> | null = null;

export function getAssistantRagWebDictationEmails(): Set<string> {
  if (cachedRagWebDictation) return cachedRagWebDictation;
  const fromCode = ASSISTANT_RAG_WEB_DICTATION_EMAILS.map((e) => e.trim().toLowerCase()).filter(Boolean);
  cachedRagWebDictation = new Set([...fromCode, ...parseEnvRagWebDictationList()]);
  return cachedRagWebDictation;
}

export function isAssistantRagWebDictation(email: string | null | undefined): boolean {
  if (allowlistBypassEnabled()) return true;
  if (!email?.trim()) return false;
  return getAssistantRagWebDictationEmails().has(email.trim().toLowerCase());
}
