import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('build',{recursive:true});
await build({
  entryPoints:['scripts/test-distributor-catalog.tsx'],
  bundle:true, platform:'node', format:'cjs', jsx:'automatic',
  outfile:'build/distributor-test.cjs',
  external:['jsdom','react','react-dom/*','react-router'],
  define:{'import.meta.env.DEV':'false','import.meta.env.VITE_EDGE_SAME_ORIGIN':'"0"'},
});
const result=spawnSync(process.execPath,['build/distributor-test.cjs'],{stdio:'inherit'});
if(result.error) throw result.error;
process.exitCode=result.status ?? 1;
