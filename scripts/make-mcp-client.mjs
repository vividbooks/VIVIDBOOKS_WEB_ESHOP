/**
 * Minimalistický klient Make MCP serveru (Streamable HTTP / SSE) bez závislostí.
 * Používá `scripts/check-make-mcp.mjs`; čisté funkce pokrývají unit testy.
 *
 * Dokumentace transportů a URL: https://developers.make.com/mcp-server/make-mcp-server
 */

export const MCP_PROTOCOL_VERSION = '2025-06-18';
export const MAKE_OAUTH_URL = 'https://mcp.make.com';
export const DEFAULT_TIMEOUT_MS = 30_000;
/** Jen POST transporty. `/sse` má jiný handshake (GET stream + zvláštní message endpoint). */
export const TRANSPORTS = ['stateless', 'stream'];

/** Přípona endpointu podle transportu; `stateless` je u Make výchozí. */
export function transportSuffix(transport) {
  if (!TRANSPORTS.includes(transport)) {
    throw new Error(`Neznámý transport "${transport}" (povolené: ${TRANSPORTS.join(', ')}).`);
  }
  return `/${transport}`;
}

/**
 * Vybere endpoint a token podle priority: explicitní --url → MAKE_MCP_URL →
 * MAKE_ZONE + token → URL z .cursor/mcp.json → OAuth URL.
 */
export function resolveMakeMcpTarget({ args = {}, env = {}, configuredUrl = null } = {}) {
  const transport = args.transport || 'stateless';
  const suffix = transportSuffix(transport);
  const token = env.MAKE_MCP_TOKEN || env.MCP_TOKEN || '';
  const zone = String(env.MAKE_ZONE || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');

  if (args.url) return { url: args.url, token, source: '--url' };
  if (env.MAKE_MCP_URL) return { url: env.MAKE_MCP_URL, token, source: 'MAKE_MCP_URL' };
  if (zone && token) return { url: `https://${zone}/mcp${suffix}`, token, source: 'MAKE_ZONE + MAKE_MCP_TOKEN' };

  const base = (configuredUrl || MAKE_OAUTH_URL).replace(/\/(stateless|stream|sse)\/*$/, '').replace(/\/+$/, '');
  return {
    url: transport === 'stateless' ? base : `${base}${suffix}`,
    token,
    source: configuredUrl ? '.cursor/mcp.json' : 'default (OAuth)',
  };
}

/** Skryje MCP token, když je součástí cesty (`/mcp/u/<token>/…`). */
export function maskMcpUrl(url) {
  return String(url).replace(/\/u\/[^/]+/, '/u/***');
}

export function buildMcpHeaders({ token = '', sessionId = null } = {}) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': MCP_PROTOCOL_VERSION,
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (sessionId) headers['mcp-session-id'] = sessionId;
  return headers;
}

/** Najde JSON-RPC odpověď s daným id v JSON i SSE (`data:` rámce) těle. */
export function findJsonRpcMessage(buffer, id, isEventStream) {
  const payloads = isEventStream
    ? String(buffer)
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .filter(Boolean)
    : [String(buffer).trim()].filter(Boolean);

  for (const payload of payloads) {
    let message;
    try {
      message = JSON.parse(payload);
    } catch {
      continue;
    }
    if (message && message.id === id) return message;
  }
  return null;
}

/**
 * Jedno JSON-RPC volání. Odpověď čte inkrementálně, takže u SSE nečeká na
 * zavření streamu — skončí, jakmile dorazí rámec s odpovídajícím id.
 */
export async function mcpRequest({
  url,
  token = '',
  sessionId = null,
  body,
  expectResponse = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: buildMcpHeaders({ token, sessionId }),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const contentType = res.headers.get('content-type') || '';
  const isEventStream = contentType.includes('text/event-stream');
  const result = {
    status: res.status,
    sessionId: res.headers.get('mcp-session-id') || sessionId || null,
    wwwAuthenticate: res.headers.get('www-authenticate') || null,
    message: null,
    raw: '',
  };

  if (!res.ok || !expectResponse || !res.body) {
    result.raw = typeof res.text === 'function' ? (await res.text()).slice(0, 600) : '';
    return result;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const message = findJsonRpcMessage(buffer, body.id, isEventStream);
      if (message) {
        result.message = message;
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  result.raw = buffer.slice(0, 600);
  result.message = result.message || findJsonRpcMessage(buffer, body.id, isEventStream);
  return result;
}

/**
 * Handshake + výpis nástrojů. Vrací `outcome`:
 * `ok` | `unauthorized` | `error` — CLI z toho dělá exit kód.
 */
export async function probeMakeMcp({ url, token = '', timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const init = await mcpRequest({
    url,
    token,
    timeoutMs,
    fetchImpl,
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'vividbooks-make-mcp-check', version: '1.0.0' },
      },
    },
  });

  if (init.status === 401 || init.status === 403) {
    return { outcome: 'unauthorized', status: init.status, wwwAuthenticate: init.wwwAuthenticate };
  }
  if (init.status >= 400 || !init.message) {
    return { outcome: 'error', status: init.status, detail: init.raw || `HTTP ${init.status} bez JSON-RPC odpovědi` };
  }
  if (init.message.error) {
    return {
      outcome: 'error',
      status: init.status,
      detail: init.message.error.message || JSON.stringify(init.message.error),
    };
  }

  const serverInfo = init.message.result?.serverInfo || {};
  const protocolVersion = init.message.result?.protocolVersion || null;

  await mcpRequest({
    url,
    token,
    sessionId: init.sessionId,
    timeoutMs,
    fetchImpl,
    body: { jsonrpc: '2.0', method: 'notifications/initialized' },
    expectResponse: false,
  }).catch(() => {});

  const listed = await mcpRequest({
    url,
    token,
    sessionId: init.sessionId,
    timeoutMs,
    fetchImpl,
    body: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  });

  const tools = listed.message?.result?.tools;
  if (!Array.isArray(tools)) {
    return {
      outcome: 'error',
      status: listed.status,
      serverInfo,
      protocolVersion,
      detail:
        listed.message?.error?.message ||
        listed.raw ||
        `tools/list nevrátil seznam (HTTP ${listed.status})`,
    };
  }

  return { outcome: 'ok', status: listed.status, serverInfo, protocolVersion, tools };
}
