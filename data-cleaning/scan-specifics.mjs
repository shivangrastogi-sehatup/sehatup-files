// Scan UN-reviewed examples for Ananya (model) responses that mention specific
// values we don't want in the data: phone numbers, prices, links, or [PLACEHOLDERS].
// Report counts + samples so we can scope the cleanup. Read-only.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, REVIEWS_COLLECTION, docIdForFile } from './lib/firebase.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'training-data');

const PATTERNS = {
  placeholder: /\[[A-Z][A-Z_]+\]/,
  phone: /(?:\+?91[\s-]?)?\b\d{5}[\s-]?\d{5}\b|\b\d{10}\b/,
  price: /(₹|\brs\.?\b|\brupees\b|\brupaye\b|\binr\b)\s?\d|\d+\s?(?:rupaye|rupees|\brs\b)/i,
  link: /https?:\/\/|www\.|\.com|\.in\b|bit\.ly|shiprocket|tracking\s*(?:link|http)/i,
};

const files = readdirSync(SRC).filter((f) => f.endsWith('.jsonl'));
const totals = { placeholder: 0, phone: 0, price: 0, link: 0 };
let unreviewed = 0, flaggedExamples = 0, totalExamples = 0;
const samples = { placeholder: [], phone: [], price: [], link: [] };

for (const name of files) {
  const lines = readFileSync(join(SRC, name), 'utf8').split('\n').filter((l) => l.trim());
  const snap = await db.collection(REVIEWS_COLLECTION).doc(docIdForFile(name)).get();
  const reviewed = new Set(Object.keys((snap.exists ? snap.data().reviews : {}) || {}).map(Number));

  lines.forEach((line, i) => {
    totalExamples++;
    if (reviewed.has(i)) return;   // skip already-reviewed
    unreviewed++;
    const ex = JSON.parse(line);
    const modelText = ex.contents.filter((c) => c.role === 'model').map((c) => c.parts[0].text).join('\n');
    let flagged = false;
    for (const [cat, re] of Object.entries(PATTERNS)) {
      const m = modelText.match(re);
      if (m) {
        totals[cat]++; flagged = true;
        if (samples[cat].length < 3) samples[cat].push(`[${name} #${i}] …${modelText.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\n/g, ' ')}…`);
      }
    }
    if (flagged) flaggedExamples++;
  });
}

console.log(`Total examples: ${totalExamples} | un-reviewed: ${unreviewed}`);
console.log(`Un-reviewed examples whose Ananya reply mentions a specific: ${flaggedExamples}\n`);
console.log('By category (un-reviewed only):');
for (const k of Object.keys(totals)) console.log(`  ${k.padEnd(12)} ${totals[k]}`);
console.log('\nSamples:');
for (const k of Object.keys(samples)) { console.log(` ${k}:`); samples[k].forEach((s) => console.log('   ' + s)); }
process.exit(0);
