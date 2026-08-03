import { appUrl, legacyAppUrl } from '../config/publicUrls';

/**
 * Po spuštění nové aplikace běží obě verze souběžně, takže odkazy z webu vedou na
 * rozcestník `/otevrit`. Volbu si pamatujeme, ať se učitele, který zůstává na původní
 * aplikaci, neptáme při každém kliknutí znovu.
 */

export type AppEntryChoice = 'nova' | 'puvodni';

const STORAGE_KEY = 'vividbooks:app-entry-choice';
/** `/otevrit?zmenit=1` zapamatovanou volbu obejde a znovu ukáže rozcestník. */
export const APP_ENTRY_RESET_PARAM = 'zmenit';

export function parseAppEntryChoice(raw: unknown): AppEntryChoice | null {
  return raw === 'nova' || raw === 'puvodni' ? raw : null;
}

export function appEntryTargetUrl(choice: AppEntryChoice): string {
  return choice === 'puvodni' ? legacyAppUrl() : appUrl();
}

export function readAppEntryChoice(): AppEntryChoice | null {
  try {
    return parseAppEntryChoice(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Zablokované úložiště znamená jen to, že se zeptáme znovu.
    return null;
  }
}

export function rememberAppEntryChoice(choice: AppEntryChoice): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Nevadí — uživatel se prokliká rozcestníkem i příště.
  }
}

export function forgetAppEntryChoice(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Není co mazat.
  }
}
