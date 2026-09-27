/**
 * Klasifikace identifikovaného webového zobrazení.
 * Jen hrubé eventy (ne GA clone). Admin / mailing se neukládá.
 */

export const IDENTITY_WEB_EVENT_KINDS = ['subject', 'product', 'webinar', 'trial', 'other'] as const
export type IdentifiedWebKind = (typeof IDENTITY_WEB_EVENT_KINDS)[number]

const SKIP_PREFIXES = [
  '/admin',
  '/mailing',
  '/marketing',
  '/hub',
  '/assistant',
  '/asistent',
]

export type ClassifiedIdentifiedWebPath = {
  kind: IdentifiedWebKind
  path: string
  entity_id: string | null
}

export function classifyIdentifiedWebPath(raw: unknown): ClassifiedIdentifiedWebPath | null {
  let path = String(raw ?? '').trim().split('?')[0].split('#')[0]
  if (!path) return null
  if (!path.startsWith('/')) path = `/${path}`
  path = path.replace(/\/{2,}/g, '/')
  if (path.length > 1) path = path.replace(/\/+$/, '')
  if (path.length > 300) path = path.slice(0, 300)

  const lower = path.toLowerCase()
  if (SKIP_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`))) {
    return null
  }

  const parts = lower.split('/').filter(Boolean)
  const root = parts[0] || ''
  const second = parts[1] || null

  if (root === 'predmet' && second) return { kind: 'subject', path, entity_id: second }
  if ((root === 'produkt' || root === 'balicek') && second) {
    return { kind: 'product', path, entity_id: second }
  }
  if (root === 'webinar' || root === 'webinare') {
    return { kind: 'webinar', path, entity_id: second }
  }
  if (root === 'vyzkousejte') return { kind: 'trial', path, entity_id: null }
  return { kind: 'other', path, entity_id: second || root || null }
}

/**
 * Jemnější téma návštěvy pro export do registru / CRM (payload.topic). Do DB e-shopu se neukládá –
 * počítá se z cesty až při exportu, takže není potřeba měnit CHECK na identity_web_events.kind.
 *  - app_entry  … jen cesta do aplikace (titulka, /app-uvod, /otevrit, /aplikace) – pro obchod šum
 *  - order_form … otevřený objednávkový formulář školy (/objednat)
 *  - checkout   … košík / platba (/pokladna, /platit)
 *  - catalog, campaign, webinar_page, trial_page
 */
export type IdentifiedWebTopic =
  | 'app_entry' | 'order_form' | 'checkout' | 'catalog' | 'campaign' | 'webinar_page' | 'trial_page' | 'subject' | 'product'

export function identifiedWebPathTopic(raw: unknown): IdentifiedWebTopic | null {
  const c = classifyIdentifiedWebPath(raw)
  if (!c) return null
  const parts = c.path.toLowerCase().split('/').filter(Boolean)
  // jazykový prefix (/cs/otevrit-ucebnice) téma nemění
  if (parts.length > 1 && /^[a-z]{2}$/.test(parts[0])) parts.shift()
  const root = parts[0] || ''
  if (!root || root === 'app-uvod' || root === 'otevrit' || root === 'otevrit-ucebnice' || root === 'aplikace') return 'app_entry'
  if (root === 'objednat') return 'order_form'
  if (root === 'pokladna' || root === 'platit') return 'checkout'
  if (root === 'katalog') return 'catalog'
  if (root === 'kampane') return 'campaign'
  if (c.kind === 'webinar' || root === 'dvpp-webinare') return 'webinar_page'
  if (c.kind === 'trial' || root === 'vyzkousejte-kabinet') return 'trial_page'
  if (c.kind === 'subject') return 'subject'
  if (c.kind === 'product') return 'product'
  return null
}
