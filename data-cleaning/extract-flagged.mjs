// Extract un-reviewed examples whose Ananya (model) replies mention specifics,
// with their full turns + which turn indices are flagged. Writes a working JSON
// to the scratchpad for batch rewriting. Read-only w.r.t. Firestore/data.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, REVIEWS_COLLECTION, docIdForFile } from './lib/firebase.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'training-data');
const OUT = process.argv[2] || join(HERE, 'flagged.json');

const PATTERNS = {
  placeholder: /\[[A-Z][A-Z_]+\]/,
  phone: /(?:\+?91[\s-]?)?\b\d{5}[\s-]?\d{5}\b|\b\d{10}\b/,
  price: /(₹|\brs\.?\b|\brupees\b|\brupaye\b|\brupey\b|\binr\b)\s?\d|\d+\s?(?:rupaye|rupees|rupey|\brs\b)|\b\d{3,5}\s*(?:ki|ka|me|mein)\b/i,
  link: /https?:\/\/|www\.|\.com|\.in\b|bit\.ly|shiprocket|sehatup\.com|cart\//i,
};
function flags(text) {
  return Object.entries(PATTERNS).filter(([, re]) => re.test(text)).map(([k]) => k);
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.jsonl')).sort();
const out = [];
const perChunk = {};

for (const name of files) {
  const lines = readFileSync(join(SRC, name), 'utf8').split('\n').filter((l) => l.trim());
  const snap = await db.collection(REVIEWS_COLLECTION).doc(docIdForFile(name)).get();
  const reviewed = new Set(Object.keys((snap.exists ? snap.data().reviews : {}) || {}).map(Number));

  lines.forEach((line, i) => {
    if (reviewed.has(i)) return;
    const ex = JSON.parse(line);
    const turns = ex.contents.map((c) => ({ role: c.role, text: c.parts[0].text }));
    const flagged = [];
    turns.forEach((t, ti) => { if (t.role === 'model' && flags(t.text).length) flagged.push(ti); });
    if (flagged.length) {
      out.push({ file: name, idx: i, turns, flagged });
      perChunk[name] = (perChunk[name] || 0) + 1;
    }
  });
}

writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('Flagged examples:', out.length, '→', OUT);
console.log('Per chunk:');
Object.entries(perChunk).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));
process.exit(0);
