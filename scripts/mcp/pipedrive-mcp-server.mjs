#!/usr/bin/env node
// Read-only MCP server nad Pipedrive REST API — doplněk k oficiálnímu remote serveru
// (https://mcp.pipedrive.ai/mcp), který nedává přístup k hash klíčům vlastních polí.
// Spouští ho Cursor podle .cursor/mcp.json; token bere z PIPEDRIVE_API_TOKEN nebo z .env v kořeni repa.
//
// Ruční ověření (bez Cursoru):
//   PIPEDRIVE_API_TOKEN=... node scripts/mcp/pipedrive-mcp-server.mjs
//   {"jsonrpc":"2.0","id":1,"method":"tools/list"}

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const SERVER_NAME = 'pipedrive-api';
const SERVER_VERSION = '1.0.0';
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOL_VERSIONS = new Set(['2024-11-05', '2025-03-26', '2025-06-18']);
const DEFAULT_API_BASE_URL = 'https://api.pipedrive.com';
const ALLOWED_PATH_PREFIXES = ['/v1/', '/api/v1/', '/api/v2/'];
const MAX_RESPONSE_CHARS = 40_000;

const FIELD_ENTITY_PATHS = {
  deal: '/v1/dealFields',
  person: '/v1/personFields',
  organization: '/v1/organizationFields',
  product: '/v1/productFields',
  activity: '/v1/activityFields',
};

const SEARCH_ENTITY_PATHS = {
  deals: '/api/v2/deals/search',
  persons: '/api/v2/persons/search',
  organizations: '/api/v2/organizations/search',
  leads: '/api/v2/leads/search',
  products: '/api/v2/products/search',
};

export function parseEnvFile(text) {
  const values = {};
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const withoutExport = line.startsWith('export ') ? line.slice('export '.length) : line;
    const separator = withoutExport.indexOf('=');
    if (separator <= 0) continue;
    const key = withoutExport.slice(0, separator).trim();
    let value = withoutExport.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (key) values[key] = value;
  }
  return values;
}

export function resolveApiPath(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('Chybí parametr "path" (např. /api/v2/deals/123).');
  if (/^https?:\/\//i.test(raw)) {
    throw new Error('Zadej jen cestu API, ne celou URL (např. /v1/dealFields).');
  }
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  if (path.includes('..')) throw new Error(`Nepovolená cesta: ${raw}`);
  const [pathname, search] = path.split('?');
  if (!ALLOWED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    throw new Error(`Cesta musí začínat na ${ALLOWED_PATH_PREFIXES.join(', ')} — dostal jsem "${raw}".`);
  }
  return { pathname, search: search ?? '' };
}

export function buildRequestUrl(baseUrl, path, query) {
  const { pathname, search } = resolveApiPath(path);
  const url = new URL(pathname, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (search) {
    for (const [key, value] of new URLSearchParams(search)) url.searchParams.append(key, value);
  }
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    // api_token v URL je deprecated a zbytečně by tekl do logů — token posíláme hlavičkou.
    if (key === 'api_token') continue;
    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return url;
}

export function summarizeField(field) {
  return {
    id: field?.id,
    key: field?.key,
    name: field?.name,
    field_type: field?.field_type ?? field?.type ?? null,
    edit_flag: field?.edit_flag ?? null,
    options: Array.isArray(field?.options)
      ? field.options.map((option) => ({ id: option?.id, label: option?.label }))
      : undefined,
  };
}

export function matchesFieldQuery(field, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return true;
  const haystacks = [field?.key, field?.name, field?.id, field?.field_type, field?.type];
  if (haystacks.some((value) => value !== undefined && value !== null && String(value).toLowerCase().includes(needle))) {
    return true;
  }
  return Array.isArray(field?.options)
    ? field.options.some((option) => String(option?.label ?? '').toLowerCase().includes(needle))
    : false;
}

export function truncateForResponse(text, maxChars = MAX_RESPONSE_CHARS) {
  const value = String(text ?? '');
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n… odpověď zkrácena (${value.length} znaků). Zužte dotaz parametrem "query" (limit, fields, …).`;
}

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function readApiToken(env = process.env, envFilePath = resolve(repoRoot(), '.env')) {
  const fromEnv = String(env.PIPEDRIVE_API_TOKEN ?? '').trim();
  if (fromEnv) return fromEnv;
  try {
    const fromFile = parseEnvFile(readFileSync(envFilePath, 'utf8')).PIPEDRIVE_API_TOKEN;
    return String(fromFile ?? '').trim();
  } catch {
    return '';
  }
}

function jsonText(value) {
  return truncateForResponse(JSON.stringify(value, null, 2));
}

export function createTools({ apiBaseUrl, apiToken, fetchImpl = fetch }) {
  async function apiGet(path, query) {
    if (!apiToken) {
      throw new Error(
        'Chybí PIPEDRIVE_API_TOKEN. Přidej ho do .env v kořeni repa (nebo do prostředí) a restartuj MCP server v Cursoru.',
      );
    }
    const url = buildRequestUrl(apiBaseUrl, path, query);
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'application/json', 'x-api-token': apiToken },
    });
    const body = await response.text();
    let parsed;
    try {
      parsed = body ? JSON.parse(body) : null;
    } catch {
      parsed = body;
    }
    if (!response.ok) {
      throw new Error(`Pipedrive ${response.status} ${url.pathname}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
    }
    return parsed;
  }

  return {
    pipedrive_get: {
      description:
        'Read-only GET na Pipedrive REST API (v1 i api/v2). Např. path="/api/v2/deals/123", path="/v1/dealFields" s query={"limit":500}.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Cesta API začínající /v1/, /api/v1/ nebo /api/v2/.' },
          query: { type: 'object', description: 'Query parametry (limit, cursor, term, …).', additionalProperties: true },
        },
        required: ['path'],
        additionalProperties: false,
      },
      async run({ path, query }) {
        return jsonText(await apiGet(path, query));
      },
    },

    pipedrive_find_field: {
      description:
        'Najde vlastní pole (hash klíč, ID, typ, volby) podle názvu, klíče nebo ID. Použij, když potřebuješ PIPEDRIVE_*_FIELD_KEY nebo ID volby štítku.',
      inputSchema: {
        type: 'object',
        properties: {
          entity: {
            type: 'string',
            enum: Object.keys(FIELD_ENTITY_PATHS),
            description: 'Entita, jejíž pole se prohledávají (default deal).',
          },
          query: { type: 'string', description: 'Hledaný text — název pole, hash klíč, ID pole nebo název volby.' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      async run({ entity = 'deal', query }) {
        const path = FIELD_ENTITY_PATHS[entity];
        if (!path) throw new Error(`Neznámá entita "${entity}". Povolené: ${Object.keys(FIELD_ENTITY_PATHS).join(', ')}.`);
        const payload = await apiGet(path, { limit: 500 });
        const fields = Array.isArray(payload?.data) ? payload.data : [];
        const matches = fields.filter((field) => matchesFieldQuery(field, query)).map(summarizeField);
        return jsonText({ entity, query, total_fields: fields.length, matches });
      },
    },

    pipedrive_search: {
      description: 'Fulltextové vyhledání dealů, osob, organizací, leadů nebo produktů (read-only /search endpointy v2).',
      inputSchema: {
        type: 'object',
        properties: {
          entity: { type: 'string', enum: Object.keys(SEARCH_ENTITY_PATHS), description: 'Co hledat (default deals).' },
          term: { type: 'string', description: 'Hledaný výraz — min. 2 znaky (1 znak při exact_match).' },
          fields: { type: 'string', description: 'Volitelně seznam polí, ve kterých se hledá (např. "code,name").' },
          exact_match: { type: 'boolean', description: 'Přesná shoda celé hodnoty.' },
          limit: { type: 'number', description: 'Počet výsledků (default 20).' },
        },
        required: ['term'],
        additionalProperties: false,
      },
      async run({ entity = 'deals', term, fields, exact_match: exactMatch, limit = 20 }) {
        const path = SEARCH_ENTITY_PATHS[entity];
        if (!path) throw new Error(`Neznámá entita "${entity}". Povolené: ${Object.keys(SEARCH_ENTITY_PATHS).join(', ')}.`);
        const payload = await apiGet(path, {
          term,
          limit,
          ...(fields ? { fields } : {}),
          ...(exactMatch === undefined ? {} : { exact_match: exactMatch }),
        });
        return jsonText(payload);
      },
    },
  };
}

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export function createRequestHandler(tools) {
  return async function handleRequest(message) {
    const { id, method, params } = message ?? {};

    if (method === 'initialize') {
      const requested = params?.protocolVersion;
      return jsonRpcResult(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.has(requested) ? requested : DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });
    }

    if (method === 'ping') return jsonRpcResult(id, {});

    if (method === 'tools/list') {
      return jsonRpcResult(id, {
        tools: Object.entries(tools).map(([name, tool]) => ({
          name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });
    }

    if (method === 'tools/call') {
      const tool = tools[params?.name];
      if (!tool) return jsonRpcError(id, -32602, `Neznámý nástroj: ${params?.name}`);
      try {
        const text = await tool.run(params?.arguments ?? {});
        return jsonRpcResult(id, { content: [{ type: 'text', text }] });
      } catch (error) {
        return jsonRpcResult(id, {
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        });
      }
    }

    return jsonRpcError(id, -32601, `Nepodporovaná metoda: ${method}`);
  };
}

function startStdioServer() {
  const apiBaseUrl = String(process.env.PIPEDRIVE_API_BASE_URL ?? '').trim() || DEFAULT_API_BASE_URL;
  const tools = createTools({ apiBaseUrl, apiToken: readApiToken() });
  const handleRequest = createRequestHandler(tools);
  const rl = createInterface({ input: process.stdin });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      process.stderr.write(`[${SERVER_NAME}] nevalidní JSON na vstupu\n`);
      return;
    }
    // Notifikace (bez id) se nepotvrzují.
    if (message.id === undefined || message.id === null) return;
    handleRequest(message)
      .then((response) => process.stdout.write(`${JSON.stringify(response)}\n`))
      .catch((error) => {
        process.stdout.write(
          `${JSON.stringify(jsonRpcError(message.id, -32603, error instanceof Error ? error.message : String(error)))}\n`,
        );
      });
  });

  rl.on('close', () => process.exit(0));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startStdioServer();
}
