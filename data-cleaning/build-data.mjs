// Prep script: copies training-data chunk files into public/training-data/
// and generates index.json (the manifest the viewer loads).
// Run from data-cleaning/:  node build-data.mjs
import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'training-data');
const OUT = join(HERE, 'public', 'training-data');
mkdirSync(OUT, { recursive: true });

const RE = /^chunk-(\d+)_(.+?)(?:_(.+))?\.jsonl$/;
const files = readdirSync(SRC).filter((f) => f.endsWith('.jsonl'));
const manifest = [];

for (const name of files) {
  const m = RE.exec(name);
  if (!m) continue;
  const chunk = parseInt(m[1], 10);
  const from = m[2];
  const to = m[3] || m[2]; // synthetic chunk has a single label
  const text = readFileSync(join(SRC, name), 'utf8');
  const count = text.split('\n').filter((l) => l.trim()).length;

  copyFileSync(join(SRC, name), join(OUT, name));
  const metaName = name.replace(/\.jsonl$/, '.meta.json');
  try {
    copyFileSync(join(SRC, metaName), join(OUT, metaName));
  } catch { /* no meta sidecar for this chunk */ }

  manifest.push({ file: name, chunk, from, to, count });
}

manifest.sort((a, b) => a.chunk - b.chunk);
writeFileSync(join(OUT, 'index.json'), JSON.stringify(manifest, null, 0));
console.log(`Wrote manifest with ${manifest.length} chunks -> public/training-data/index.json`);
