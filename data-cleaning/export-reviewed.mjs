// Export ONLY the reviewed (signed-off) examples as fine-tune-ready training data.
//   - keeps an example only if >=1 reviewer signed it off in Firestore
//   - drops anything marked excluded (even if it was also reviewed)
//   - applies the corrected turns from edits (systemInstruction preserved)
//   - phone edits are metadata only — they never change the training output
// Output → ../training-data-reviewed/
//   - one <chunk>.jsonl per chunk that has reviewed examples
//   - _all-reviewed.jsonl  (everything concatenated — feed this to fine-tuning)
//   - _summary.json        (per-chunk + per-reviewer counts)
// Run from data-cleaning/:  node export-reviewed.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, REVIEWS_COLLECTION, docIdForFile } from './lib/firebase.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'training-data');
const OUT = join(HERE, '..', 'training-data-reviewed');
mkdirSync(OUT, { recursive: true });

function excludedSet(data) {
  if (Array.isArray(data.excluded)) return new Set(data.excluded.map(Number));
  if (data.excluded && typeof data.excluded === 'object')
    return new Set(Object.entries(data.excluded).filter(([, v]) => v).map(([k]) => Number(k)));
  return new Set();
}
// reviews[idx] is a map { name: color }; reviewed = at least one signer
function signersOf(reviews, i) {
  const r = reviews[String(i)];
  if (!r || typeof r !== 'object') return [];
  return Object.keys(r);
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.jsonl')).sort();
const summary = [];
const byReviewer = {};   // name -> examples exported that they signed
const combined = [];

for (const name of files) {
  const lines = readFileSync(join(SRC, name), 'utf8').split('\n').filter((l) => l.trim());
  const snap = await db.collection(REVIEWS_COLLECTION).doc(docIdForFile(name)).get();
  const data = snap.exists ? snap.data() : {};
  const reviews = data.reviews || {};
  const edits = data.edits || {};
  const excluded = excludedSet(data);

  const out = [];
  let nEdited = 0;
  lines.forEach((line, i) => {
    const signers = signersOf(reviews, i);
    if (!signers.length) return;        // not reviewed → skip
    if (excluded.has(i)) return;        // reviewed but excluded → skip

    const ex = JSON.parse(line);
    if (edits[i] && Array.isArray(edits[i].turns)) {
      ex.contents = edits[i].turns.map((t) => ({
        role: t.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(t.text) }],
      }));
      nEdited++;
    }
    const jsonl = JSON.stringify(ex);
    out.push(jsonl);
    combined.push(jsonl);
    signers.forEach((s) => { byReviewer[s] = (byReviewer[s] || 0) + 1; });
  });

  if (out.length) writeFileSync(join(OUT, name), out.join('\n') + '\n');
  summary.push({ file: name, reviewedKept: out.length, edited: nEdited, original: lines.length });
  if (out.length) console.log(`${name}: ${out.length} reviewed kept  (edited ${nEdited} of ${lines.length})`);
}

writeFileSync(join(OUT, '_all-reviewed.jsonl'), combined.join('\n') + (combined.length ? '\n' : ''));
writeFileSync(join(OUT, '_summary.json'), JSON.stringify({
  total: combined.length,
  byReviewer,
  chunks: summary.filter((s) => s.reviewedKept > 0),
}, null, 2));

const perRev = Object.entries(byReviewer).sort((a, b) => b[1] - a[1])
  .map(([n, c]) => `${n} ${c}`).join(' · ') || '(none)';
console.log(`\nDONE → training-data-reviewed/`);
console.log(`  _all-reviewed.jsonl : ${combined.length} examples`);
console.log(`  signed off by       : ${perRev}`);
process.exit(0);
