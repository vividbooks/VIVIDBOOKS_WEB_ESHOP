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
