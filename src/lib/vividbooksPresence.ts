import { useEffect, useState } from 'react';

/**
 * Přihlášení v aplikaci učebnic (nove.vividbooks.com) zapisuje cookie na `.vividbooks.com`,
 * takže web i e-shop poznají, kdo přišel, a můžou pozdravit jménem a předvyplnit formuláře.
 *
 * Cookie nese POUZE zobrazovací údaje — žádné tokeny, žádná oprávnění. Nesmí se používat
 * k ničemu, na čem závisí peníze nebo přístup (licence, slevy, „už máte předplatné“);
 * na to je potřeba podepsaný handoff z aplikace.
 *
 * Formát zapisuje `frontend/src/app/services/cross-site-presence.ts` v repozitáři
 * vividbooks-ultra — obě strany musí zůstat v souladu.
 */

export const PRESENCE_COOKIE_NAME = 'vb_id';
const SUPPORTED_VERSION = 1;
/** Po měsíci nečinnosti raději nepředstíráme, že uživatele známe. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface VividbooksPresence {
  name: string;
  email?: string;
  avatar?: string;
  school?: string;
  /** Kdy aplikace záznam naposledy obnovila. */
  at: number;
}

function decodeBase64Url(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function parsePresenceValue(raw: string): VividbooksPresence | null {
  const json = decodeBase64Url(String(raw || '').trim());
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (parsed.v !== SUPPORTED_VERSION) return null;

    const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    if (!name) return null;

    const at = typeof parsed.at === 'number' && Number.isFinite(parsed.at) ? parsed.at : 0;
    if (!at || Date.now() - at > MAX_AGE_MS) return null;

    const optional = (key: string): string | undefined => {
      const value = parsed[key];
      return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    };

    return {
      name,
      email: optional('email'),
      avatar: optional('avatar'),
      school: optional('school'),
      at,
    };
  } catch {
    return null;
  }
}

export function readVividbooksPresence(): VividbooksPresence | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${PRESENCE_COOKIE_NAME}=([^;]*)`));
  if (!match?.[1]) return null;

  return parsePresenceValue(match[1]);
}

/** Křestní jméno pro oslovení v CTA — celé jméno se do tlačítka nevejde. */
export function presenceFirstName(presence: VividbooksPresence | null): string {
  if (!presence) return '';
  return presence.name.split(' ')[0] || presence.name;
}

/**
 * Cookie se mění na jiné doméně, takže není `storage` událost, kterou bychom poslouchali.
 * Překontrolujeme ji při návratu na záložku — to pokryje „přihlásím se v aplikaci
 * a přepnu zpátky na web“.
 */
export function useVividbooksPresence(): VividbooksPresence | null {
  const [presence, setPresence] = useState<VividbooksPresence | null>(() =>
    readVividbooksPresence(),
  );

  useEffect(() => {
    const refresh = () => setPresence(readVividbooksPresence());

    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return presence;
}
