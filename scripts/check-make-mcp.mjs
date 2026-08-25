#!/usr/bin/env node
/**
 * Kontrola připojení na Make MCP server (docs/MAKE_MCP.md).
 *
 * Použití:
 *   npm run mcp:make:check
 *   MAKE_ZONE=eu2.make.com MAKE_MCP_TOKEN=… npm run mcp:make:check
 *   node scripts/check-make-mcp.mjs --url https://eu2.make.com/mcp/stateless
 *   node scripts/check-make-mcp.mjs --transport stream
 *
 * Exit kódy: 0 = spojení i nástroje OK, 2 = server žije, ale chybí autorizace, 1 = jiná chyba.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { TRANSPORTS, maskMcpUrl, probeMakeMcp, resolveMakeMcpTarget } from './make-mcp-client.mjs';

const USAGE = [
  'Kontrola Make MCP serveru (Streamable HTTP; SSE endpoint se takto testovat nedá).',
  '',
  '  node scripts/check-make-mcp.mjs [--url <url>] [--transport stateless|stream] [--tools <n>]',
  '',
  'Proměnné prostředí: MAKE_MCP_URL, MAKE_ZONE, MAKE_MCP_TOKEN (alias MCP_TOKEN).',
  'Postup nastavení: docs/MAKE_MCP.md',
].join('\n');

function parseArgs(argv) {
  const args = { transport: 'stateless', toolLimit: 25 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url') args.url = argv[++i];
    else if (arg === '--transport') args.transport = argv[++i];
    else if (arg === '--tools') args.toolLimit = Number(argv[++i]) || 25;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Neznámý parametr: ${arg}`);
  }
  if (!TRANSPORTS.includes(args.transport)) {
    throw new Error(`--transport musí být ${TRANSPORTS.join(' | ')}, dostal jsem "${args.transport}".`);
  }
  return args;
}

async function readConfiguredUrl() {
  try {
    const raw = await readFile(path.join(process.cwd(), '.cursor', 'mcp.json'), 'utf8');
    const url = JSON.parse(raw)?.mcpServers?.make?.url;
    return typeof url === 'string' ? url : null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const target = resolveMakeMcpTarget({ args, env: process.env, configuredUrl: await readConfiguredUrl() });
  console.log(`Endpoint: ${maskMcpUrl(target.url)}  (zdroj: ${target.source})`);
  console.log(
    `Autorizace: ${target.token ? 'MCP token v Authorization hlavičce' : 'bez tokenu — očekává se OAuth v MCP klientovi'}`,
  );
  console.log('');

  const probe = await probeMakeMcp({ url: target.url, token: target.token });

  if (probe.outcome === 'unauthorized') {
    console.log(`Server odpovídá (HTTP ${probe.status}) a vyžaduje autorizaci — spojení a transport tedy fungují.`);
    if (probe.wwwAuthenticate) console.log(`www-authenticate: ${probe.wwwAuthenticate}`);
    console.log('');
    console.log(
      target.token
        ? 'Token byl odmítnut: zkontroluj MAKE_MCP_TOKEN, zónu (MAKE_ZONE) a scopes tokenu — docs/MAKE_MCP.md.'
        : 'Bez tokenu je 401 očekávané. Přihlášení proběhne v Cursoru (Settings → Tools & Integrations → make → Needs login), nebo nastav MAKE_ZONE + MAKE_MCP_TOKEN a spusť znovu.',
    );
    return 2;
  }

  if (probe.outcome === 'error') {
    console.error(`Spojení selhalo (HTTP ${probe.status}): ${probe.detail}`);
    return 1;
  }

  const { serverInfo = {}, tools = [] } = probe;
  console.log(`initialize OK — server "${serverInfo.name || 'neznámý'}" ${serverInfo.version || ''}`.trim());
  console.log(`Protokol: ${probe.protocolVersion || 'neuveden'}`);
  console.log(`Nástroje: ${tools.length}`);
  for (const tool of tools.slice(0, args.toolLimit)) console.log(`  - ${tool.name}`);
  if (tools.length > args.toolLimit) console.log(`  … a další ${tools.length - args.toolLimit}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error?.name === 'AbortError' ? 'Timeout při volání MCP serveru.' : `Chyba: ${error?.message || error}`);
    process.exit(1);
  });
