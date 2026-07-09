// Apply reviewed rewrites to Firestore as edit-overlays.
// Input JSON (arg): [{ file, idx, rewrites: { "<turnIndex>": "new text", ... } }, ...]
// For each example: load base turns from the jsonl, replace the given model-turn texts,
// and save edits[idx] = {turns, phone, editedBy} so it shows in the Correction Desk and
// is picked up by pull-final.mjs. Run:  node apply-rewrites.mjs <rewrites.json>
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, FieldValue, REVIEWS_COLLECTION, docIdForFile } from './lib/firebase.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'training-data');
const EDITED_BY = 'Claude (auto-clean)';
const input = process.argv[2];
if (!input) { console.error('usage: node apply-rewrites.mjs <rewrites.json>'); process.exit(1); }
const rewrites = JSON.parse(readFileSync(input, 'utf8'));

// cache base lines + meta per file
const cache = {};
function load(file) {
  if (cache[file]) return cache[file];
  const lines = readFileSync(join(SRC, file), 'utf8').split('\n').filter((l) => l.trim());
  const metaPath = join(SRC, file.replace(/\.jsonl$/, '.meta.json'));
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : [];
  return (cache[file] = { lines, meta });
}

let ok = 0;
for (const r of rewrites) {
  const { lines, meta } = load(r.file);
  const ex = JSON.parse(lines[r.idx]);
  const turns = ex.contents.map((c) => ({ role: c.role, text: c.parts[0].text }));
  let changed = 0;
  for (const [ti, text] of Object.entries(r.rewrites)) {
    const t = turns[Number(ti)];
    if (!t) { console.warn(`  ! ${r.file} #${r.idx} turn ${ti} out of range`); continue; }
    if (t.role !== 'model') console.warn(`  ! ${r.file} #${r.idx} turn ${ti} is not a model turn`);
    t.text = text; changed++;
  }
  const phone = (meta[r.idx] && meta[r.idx].phone) || '';
  await db.collection(REVIEWS_COLLECTION).doc(docIdForFile(r.file)).set(
    { file: r.file, edits: { [String(r.idx)]: { turns, phone, editedBy: EDITED_BY, editedAt: FieldValue.serverTimestamp() } },
      updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  ok++;
  console.log(`✓ ${r.file} #${r.idx} (${changed} turn${changed !== 1 ? 's' : ''})`);
}
console.log(`\nApplied ${ok}/${rewrites.length} rewrites to Firestore.`);
process.exit(0);
