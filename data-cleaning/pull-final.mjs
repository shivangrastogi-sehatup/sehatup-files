// Pull online review work (edits + exclusions) from Firestore and merge it into the
// base training data → clean, fine-tune-ready jsonl in ../training-data-final/.
//   - excluded examples are dropped
//   - edited examples get their corrected turns (systemInstruction preserved)
//   - phone edits are metadata only, they do NOT change the fine-tune output
// Run from data-cleaning/:  node pull-final.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, REVIEWS_COLLECTION, docIdForFile } from './lib/firebase.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'training-data');
const OUT = join(HERE, '..', 'training-data-final');
mkdirSync(OUT, { recursive: true });

function excludedSet(data) {
  if (Array.isArray(data.excluded)) return new Set(data.excluded.map(Number));
  if (data.excluded && typeof data.excluded === 'object')
    return new Set(Object.entries(data.excluded).filter(([, v]) => v).map(([k]) => Number(k)));
  return new Set();
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.jsonl'));
const summary = [];

for (const name of files) {
  const lines = readFileSync(join(SRC, name), 'utf8').split('\n').filter((l) => l.trim());
  const snap = await db.collection(REVIEWS_COLLECTION).doc(docIdForFile(name)).get();
  const data = snap.exists ? snap.data() : {};
  const edits = data.edits || {};
  const excluded = excludedSet(data);

  const out = [];
  let nEdited = 0, nExcluded = 0;
  lines.forEach((line, i) => {
    if (excluded.has(i)) { nExcluded++; return; }
    const ex = JSON.parse(line);
    if (edits[i] && Array.isArray(edits[i].turns)) {
      ex.contents = edits[i].turns.map((t) => ({
        role: t.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(t.text) }],
      }));
      nEdited++;
    }
    out.push(JSON.stringify(ex));
  });

  writeFileSync(join(OUT, name), out.join('\n') + '\n');
  summary.push({ file: name, kept: out.length, edited: nEdited, excluded: nExcluded, original: lines.length });
  console.log(`${name}: ${out.length} kept  (edited ${nEdited}, dropped ${nExcluded} of ${lines.length})`);
}

writeFileSync(join(OUT, '_summary.json'), JSON.stringify(summary, null, 2));
const tot = summary.reduce((a, s) => ({ kept: a.kept + s.kept, edited: a.edited + s.edited, excluded: a.excluded + s.excluded }), { kept: 0, edited: 0, excluded: 0 });
console.log(`\nDONE → training-data-final/  | kept ${tot.kept}, edited ${tot.edited}, dropped ${tot.excluded}`);
process.exit(0);
