/**
 * Stejné hlavičky jako IdokladSdk `BaseClient.CreateRequestAsync` — konzistence GET/POST na api.idoklad.cz.
 * Volitelně: IDOKLAD_APP_NAME / IDOKLAD_APP_VERSION (stejné jako u OAuth aplikace v iDokladu).
 */
export function idokladSdkHeaders(accessToken: string): Record<string, string> {
  const appName = (Deno.env.get('IDOKLAD_APP_NAME') || '').trim() || 'WebVividbooks';
  const appVersion = (Deno.env.get('IDOKLAD_APP_VERSION') || '').trim() || '1.0';
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'X-App': appName,
    'X-App-Version': appVersion,
    'X-Api-Version': 'v3',
    'X-Sdk-Version': 'edge/1.0',
  };
}

/** POST/PUT s JSON tělem (IssuedInvoices, Contacts, …). */
export function idokladSdkPostJsonHeaders(accessToken: string): Record<string, string> {
  return {
    ...idokladSdkHeaders(accessToken),
    'Content-Type': 'application/json',
  };
}
