#!/usr/bin/env node
// Zkopíruje MCP servery z .cursor/mcp.json do globálního ~/.cursor/mcp.json.
// Workspace konfigurace se v Cursoru někdy nenačte (okno Agents, multi-root workspace),
// globální platí vždy — proto se ${workspaceFolder} nahradí absolutní cestou k repu.
//
// Použití z kořene repa:
//   npm run mcp:install            # zapíše do ~/.cursor/mcp.json (původní soubor zálohuje)
//   npm run mcp:install -- --dry-run   # jen ukáže, co by se zapsalo
//   npm run mcp:install -- --links     # vypíše deeplinky pro instalaci kliknutím

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function interpolateWorkspaceFolder(value, workspaceFolder) {
  if (typeof value === 'string') {
    return value.replaceAll('${workspaceFolder}', workspaceFolder);
  }
  if (Array.isArray(value)) return value.map((item) => interpolateWorkspaceFolder(item, workspaceFolder));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, interpolateWorkspaceFolder(nested, workspaceFolder)]),
    );
  }
  return value;
}

export function mergeMcpServers(globalConfig, repoServers) {
  const existing = globalConfig?.mcpServers ?? {};
  const added = [];
  const updated = [];
  const unchanged = [];

  for (const [name, server] of Object.entries(repoServers)) {
    const before = existing[name];
    if (!before) added.push(name);
    else if (JSON.stringify(before) === JSON.stringify(server)) unchanged.push(name);
    else updated.push(name);
  }

  return {
    config: { ...globalConfig, mcpServers: { ...existing, ...repoServers } },
    added,
    updated,
    unchanged,
  };
}

export function buildInstallLink(name, serverConfig) {
  const encoded = Buffer.from(JSON.stringify(serverConfig)).toString('base64');
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${encodeURIComponent(encoded)}`;
}

export function readJsonFile(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Soubor ${path} není validní JSON: ${error instanceof Error ? error.message : error}`);
  }
}

export function installGlobalMcp({
  repoRoot = REPO_ROOT,
  globalConfigPath = resolve(homedir(), '.cursor', 'mcp.json'),
  dryRun = false,
} = {}) {
  const repoConfigPath = resolve(repoRoot, '.cursor', 'mcp.json');
  const repoConfig = readJsonFile(repoConfigPath);
  const repoServers = interpolateWorkspaceFolder(repoConfig.mcpServers ?? {}, repoRoot);
  if (Object.keys(repoServers).length === 0) {
    throw new Error(`V ${repoConfigPath} nejsou žádné mcpServers.`);
  }

  const globalConfig = readJsonFile(globalConfigPath);
  const merged = mergeMcpServers(globalConfig, repoServers);
  let backupPath = null;

  if (!dryRun) {
    mkdirSync(dirname(globalConfigPath), { recursive: true });
    if (existsSync(globalConfigPath)) {
      backupPath = `${globalConfigPath}.bak`;
      copyFileSync(globalConfigPath, backupPath);
    }
    writeFileSync(globalConfigPath, `${JSON.stringify(merged.config, null, 2)}\n`, 'utf8');
  }

  return { ...merged, repoServers, globalConfigPath, backupPath, dryRun };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const linksOnly = args.has('--links');

  if (linksOnly) {
    const repoConfig = readJsonFile(resolve(REPO_ROOT, '.cursor', 'mcp.json'));
    for (const [name, server] of Object.entries(
      interpolateWorkspaceFolder(repoConfig.mcpServers ?? {}, REPO_ROOT),
    )) {
      console.log(`${name}:\n  ${buildInstallLink(name, server)}\n`);
    }
    return;
  }

  const result = installGlobalMcp({ dryRun });

  console.log(`${dryRun ? 'Náhled (nic se nezapsalo)' : 'Zapsáno'}: ${result.globalConfigPath}`);
  if (result.backupPath) console.log(`Záloha původního souboru: ${result.backupPath}`);
  if (result.added.length) console.log(`Přidáno: ${result.added.join(', ')}`);
  if (result.updated.length) console.log(`Přepsáno: ${result.updated.join(', ')}`);
  if (result.unchanged.length) console.log(`Beze změny: ${result.unchanged.join(', ')}`);
  console.log('\nDalší krok: v Cursoru spusť „Developer: Reload Window“ a v Customize → MCPs se přihlas u serveru „pipedrive“.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
