#!/usr/bin/env node
/* Single source of truth for the context-pack engine lives in THIS directory
   (assets/components/context-pack/). The authoring sandbox and the Adapt plugin
   each need their own copy (the tool is served standalone; the Adapt component
   bundles the file through webpack), so this script copies the engine into them
   and can verify they have not drifted.

   Usage:
     node assets/components/context-pack/sync-engine.cjs           # copy source -> consumers
     node assets/components/context-pack/sync-engine.cjs --check   # verify only; exit 1 if any differ

   Edit the engine HERE, then run this (or `--check` in CI / a pre-commit hook). */

const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const ROOT = path.resolve(__dirname, '../../../');

// [ source file in SRC, destination relative to ROOT ]
const MAP = [
  ['context-pack.js',  'tools/context-packs/context-pack.js'],
  ['context-pack.css', 'tools/context-packs/context-pack.css'],
  ['context-pack.js',  'adapt-grow-contextpack/js/context-pack.js'],
  ['context-pack.css', 'adapt-grow-contextpack/less/_context-pack.less'],
];

const check = process.argv.includes('--check');
let drifted = 0, copied = 0;

for (const [srcName, destRel] of MAP) {
  const srcPath = path.join(SRC, srcName);
  const destPath = path.join(ROOT, destRel);
  const src = fs.readFileSync(srcPath, 'utf8');
  const dest = fs.existsSync(destPath) ? fs.readFileSync(destPath, 'utf8') : null;
  if (check) {
    if (dest !== src) { drifted++; console.error('DRIFT  ' + destRel + (dest === null ? ' (missing)' : '')); }
    else console.log('ok     ' + destRel);
  } else {
    if (dest === src) { console.log('unchanged ' + destRel); continue; }
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, src);
    copied++;
    console.log('wrote  ' + destRel);
  }
}

if (check) {
  if (drifted) { console.error('\n' + drifted + ' file(s) out of sync — run `node ' + path.relative(ROOT, __filename).replace(/\\/g, '/') + '`'); process.exit(1); }
  console.log('\nall copies in sync with ' + path.relative(ROOT, SRC).replace(/\\/g, '/'));
} else {
  console.log('\nsynced ' + copied + ' file(s) from ' + path.relative(ROOT, SRC).replace(/\\/g, '/'));
}
