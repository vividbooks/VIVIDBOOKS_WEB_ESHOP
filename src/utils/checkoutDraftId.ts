/**
 * Identifikátor jednoho pokusu o checkout — survives reload téhož tabu, ale nepřežívá nové okno.
 * Server podle něj při novém pending_payment řádku zruší starší pending téhož draftu (supersession),
 * aby přepínání dopravy (DPD ↔ Zásilkovna ↔ GLS ↔ PPL) ani přepínání mezi Stripe a převodem
 * nevyrábělo duplicity v adminu.
 */

const STORAGE_KEY = 'vb-checkout-draft-id';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through to manual */
    }
  }
  // Fallback bez crypto.randomUUID (starší Safari) — RFC 4122 v4.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

export function getOrCreateCheckoutDraftId(): string {
  if (typeof window === 'undefined') return generateUuid();
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = generateUuid();
    window.sessionStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return generateUuid();
  }
}

export function clearCheckoutDraftId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
