export type NewsletterSubscribeProfile = {
  source: string;
  firstName?: string;
  lastName?: string;
  schoolName?: string;
  positionLabel?: string;
  contactType?: 'teacher';
  consentVersion?: string;
  consentedAt?: string;
};

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value
    .normalize('NFKC')
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, maxLength).trim() || undefined : undefined;
}

function splitName(value: unknown): Pick<NewsletterSubscribeProfile, 'firstName' | 'lastName'> {
  const name = optionalText(value, 200);
  if (!name) return {};
  const separator = name.indexOf(' ');
  if (separator === -1) return { firstName: name.slice(0, 100) };
  return {
    firstName: name.slice(0, separator).slice(0, 100),
    lastName: name.slice(separator + 1).slice(0, 100).trim() || undefined,
  };
}

function optionalIsoDate(value: unknown): string | undefined {
  const text = optionalText(value, 64);
  if (!text) return undefined;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

/**
 * Accept only the optional profile fields supported by the public newsletter endpoint.
 * Unknown values and unsupported contact types are deliberately ignored.
 */
export function parseNewsletterSubscribeProfile(body: unknown): NewsletterSubscribeProfile {
  const input = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const name = splitName(input.name);

  return {
    source: optionalText(input.source, 120) || 'unknown',
    ...name,
    schoolName: optionalText(input.schoolName, 160),
    positionLabel: optionalText(input.positionLabel, 120),
    contactType: input.contactType === 'teacher' ? 'teacher' : undefined,
    consentVersion: optionalText(input.consentVersion, 64),
    consentedAt: optionalIsoDate(input.consentedAt),
  };
}
