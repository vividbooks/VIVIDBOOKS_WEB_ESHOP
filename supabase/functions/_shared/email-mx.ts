/**
 * DNS kontrola e-mailových domén pro Edge (Deno.resolveDns).
 *
 * Pro formuláře používejte `domainAcceptsMailForForms` — vyžaduje MX a při nejistotě vrací false.
 */

const LEGACY_RELAXED_TIMEOUT_MS = 2800;
const FORM_MX_TIMEOUT_MS = 5500;

export async function domainAcceptsMail(domain: string): Promise<boolean> {
  const d = domain.trim().toLowerCase();
  if (!d || !d.includes('.')) return false;
  try {
    const mx = await Deno.resolveDns(d, 'MX');
    if (Array.isArray(mx) && mx.length > 0) return true;
  } catch {
    /* zkusit A */
  }
  try {
    const a = await Deno.resolveDns(d, 'A');
    if (Array.isArray(a) && a.length > 0) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * @deprecated Nevhodné pro blokování neplatných domén — při timeoutu / výjimce vrací true.
 * Ponecháno kvůli zpětné kompatibilitě; nový kód používejte `domainAcceptsMailForForms`.
 */
export async function domainAcceptsMailRelaxed(domain: string): Promise<boolean> {
  const d = domain.trim().toLowerCase();
  if (!d || !d.includes('.')) return false;
  try {
    return await Promise.race([
      domainAcceptsMail(d),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), LEGACY_RELAXED_TIMEOUT_MS)),
    ]);
  } catch {
    return true;
  }
}

/** True pouze pokud doména má alespoň jeden MX záznam. */
export async function domainHasMxRecord(domain: string): Promise<boolean> {
  const d = domain.trim().toLowerCase();
  if (!d || !d.includes('.')) return false;
  try {
    const mx = await Deno.resolveDns(d, 'MX');
    return Array.isArray(mx) && mx.length > 0;
  } catch {
    return false;
  }
}

/**
 * Pokladna, objednávky, validate-email: vyžaduje MX (skutečný mailhostitel).
 * Bez MX / při timeoutu / chybě DNS → false (nepustí náhodné nebo parkované domény jen s A záznamem).
 */
export async function domainAcceptsMailForForms(domain: string): Promise<boolean> {
  const d = domain.trim().toLowerCase();
  if (!d || !d.includes('.')) return false;
  try {
    return await Promise.race([
      domainHasMxRecord(d),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), FORM_MX_TIMEOUT_MS)),
    ]);
  } catch {
    return false;
  }
}
