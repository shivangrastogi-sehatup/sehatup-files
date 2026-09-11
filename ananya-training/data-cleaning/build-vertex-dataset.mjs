// Package the reviewed examples into Vertex AI (Gemini) supervised-tuning JSONL,
// ready to upload to a GCS bucket.
//   input : ../reviewed/*.jsonl   (every chunk export, incl. orphans whose raw chunk was re-cut)
//   output: ../vertex/train.jsonl, ../vertex/validation.jsonl, ../vertex/_report.json
// Run from data-cleaning/:  node build-vertex-dataset.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'reviewed');
const OUT = join(HERE, '..', 'vertex');
const VAL_FRACTION = 0.15, VAL_MIN = 10, VAL_MAX = 50;
const MAX_CHARS = 120_000; // ~32k tokens, Vertex drops longer examples

const problems = [];
const repaired = [];
let honorificsStripped = 0;
// Agents wrote "sir"/"ma'am" everywhere in the source chats. Ananya does not use
// gendered honorifics, so strip them from MODEL turns only. Customer turns stay
// verbatim, they are the input the model has to handle as it really arrives.
const HONORIFIC = /[,\s]*\b(sir\s*ji|sirji|mam\s*ji|mamji|ma'?am|sir|mam|maam|madam)\b[,\s]*/gi;
function deHonorific(text) {
  // keep the sentence break the honorific was carrying: "Good morning ma'am, mai..."
  // must become "Good morning, mai...", not "Good morning mai..."
  let out = text.replace(HONORIFIC, (m, _g, off, s) => {
    if (off === 0 || off + m.length >= s.length) return '';
    if (/\n/.test(m)) return '\n';
    return m.includes(',') ? ', ' : ' ';
  });
  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([,.!?]){2,}/g, '$1')
    .replace(/^[\s,.]+/gm, '')
    .trim();
}
// Vertex wants strict user/model alternation, first=user, last=model.
// Reviewed chats often have two customer messages in a row, or trail off on a
// customer turn. Merge the runs and trim the ends instead of dropping the example.
function repair(ex) {
  const src = (ex.contents || []).filter((t) => typeof t.parts?.[0]?.text === 'string' && t.parts[0].text.trim());
  const merged = [];
  for (const t of src) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) last.parts[0].text += '\n' + t.parts[0].text.trim();
    else merged.push({ role: t.role, parts: [{ text: t.parts[0].text.trim() }] });
  }
  for (const t of merged) {
    if (t.role !== 'model') continue;
    const clean = deHonorific(t.parts[0].text);
    if (clean && clean !== t.parts[0].text) { t.parts[0].text = clean; honorificsStripped++; }
  }
  while (merged.length && merged[0].role !== 'user') merged.shift();
  while (merged.length && merged[merged.length - 1].role !== 'model') merged.pop();
  const changed = JSON.stringify(merged) !== JSON.stringify(ex.contents);
  return { ex: { ...ex, contents: merged }, changed };
}

function check(ex, where) {
  const c = ex.contents;
  if (!Array.isArray(c) || !c.length) return 'no contents';
  if (c[0].role !== 'user') return 'does not start with user';
  if (c[c.length - 1].role !== 'model') return 'does not end with model';
  for (let i = 0; i < c.length; i++) {
    const want = i % 2 ? 'model' : 'user';
    if (c[i].role !== want) return `role out of order at turn ${i}`;
    const t = c[i].parts?.[0]?.text;
    if (typeof t !== 'string' || !t.trim()) return `empty text at turn ${i}`;
  }
  const si = ex.systemInstruction?.parts?.[0]?.text;
  if (!si || !si.trim()) return 'missing systemInstruction';
  if (JSON.stringify(ex).length > MAX_CHARS) return 'too long';
  return null;
}

// collect ----------------------------------------------------------------
const files = readdirSync(SRC).filter((f) => f.endsWith('.jsonl') && !f.startsWith('_')
  && f !== 'train.jsonl' && f !== 'val.jsonl').sort();
const seen = new Map();       // content hash -> source file (first win)
const kept = [];
const perFile = {};

for (const f of files) {
  perFile[f] = { kept: 0, dupes: 0, bad: 0 };
  for (const [i, line] of readFileSync(join(SRC, f), 'utf8').split('\n').entries()) {
    if (!line.trim()) continue;
    let ex;
    try { ex = JSON.parse(line); } catch { perFile[f].bad++; problems.push(`${f}:${i + 1} unparseable`); continue; }
    const fix = repair(ex);
    if (fix.changed) repaired.push(`${f}:${i + 1}`);
    ex = fix.ex;
    const why = check(ex, `${f}:${i + 1}`);
    if (why) { perFile[f].bad++; problems.push(`${f}:${i + 1} ${why}`); continue; }
    const h = createHash('sha1').update(JSON.stringify(ex.contents)).digest('hex');
    if (seen.has(h)) { perFile[f].dupes++; continue; }
    seen.set(h, f);
    // normalise: exactly the two keys Vertex reads, in a stable order (_src is stripped on write)
    kept.push({ systemInstruction: ex.systemInstruction, contents: ex.contents, _src: f });
    perFile[f].kept++;
  }
}

// Stratified split: every source chunk contributes the same share to validation,
// so the held-out set covers the whole date range instead of whichever month
// happened to hash first. Hash ordering keeps re-runs identical.
const hash = (x) => createHash('sha1').update(JSON.stringify(x)).digest('hex');
const nVal = Math.min(VAL_MAX, Math.max(VAL_MIN, Math.round(kept.length * VAL_FRACTION)));

const groups = new Map();
for (const ex of kept) {
  if (!groups.has(ex._src)) groups.set(ex._src, []);
  groups.get(ex._src).push(ex);
}
const validation = [];
// largest groups first, each gives its proportional share (at least 1 if it can spare one)
for (const [, rows] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  rows.sort((a, b) => hash(a).localeCompare(hash(b)));
  const take = Math.min(rows.length - 1, Math.max(1, Math.round(rows.length * (nVal / kept.length))));
  for (let i = 0; i < take; i++) validation.push(rows[i]);
}
const inVal = new Set(validation.map(hash));
const train = kept.filter((ex) => !inVal.has(hash(ex)));
validation.sort((a, b) => hash(a).localeCompare(hash(b)));
train.sort((a, b) => hash(a).localeCompare(hash(b)));

mkdirSync(OUT, { recursive: true });
const write = (name, rows) => writeFileSync(join(OUT, name),
  rows.map(({ systemInstruction, contents }) => JSON.stringify({ systemInstruction, contents })).join('\n') + '\n');
write('train.jsonl', train);
write('validation.jsonl', validation);

// re-read what we wrote and assert it is still valid ---------------------
for (const name of ['train.jsonl', 'validation.jsonl']) {
  const rows = readFileSync(join(OUT, name), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  const bad = rows.map((r, i) => check(r, `${name}:${i}`)).filter(Boolean);
  if (bad.length) throw new Error(`${name} failed self-check: ${bad.slice(0, 3).join('; ')}`);
  const stray = rows.find((r) => Object.keys(r).join() !== 'systemInstruction,contents');
  if (stray) throw new Error(`${name} has unexpected keys: ${Object.keys(stray)}`);
}
// train and validation must not overlap
{
  const t = new Set(train.map((r) => hash(r.contents)));
  const leak = validation.filter((r) => t.has(hash(r.contents)));
  if (leak.length) throw new Error(`${leak.length} validation examples also appear in train`);
}

const turns = kept.map((e) => e.contents.length);
const report = {
  builtAt: new Date().toISOString(),
  train: train.length,
  validation: validation.length,
  total: kept.length,
  duplicatesDropped: Object.values(perFile).reduce((a, v) => a + v.dupes, 0),
  invalidDropped: problems.length,
  repaired: repaired.length,
  honorificsStripped,
  turnsPerExample: { min: Math.min(...turns), max: Math.max(...turns), avg: +(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1) },
  splitBySource: Object.fromEntries([...groups].map(([f, rows]) => [f, {
    train: rows.filter((r) => !inVal.has(hash(r))).length,
    validation: rows.filter((r) => inVal.has(hash(r))).length,
  }])),
  perFile,
  problems: problems.slice(0, 50),
};
writeFileSync(join(OUT, '_report.json'), JSON.stringify(report, null, 2));

console.log(`honorifics stripped from ${honorificsStripped} model turns`);
console.log(`repaired ${repaired.length} examples (merged same-role runs, trimmed dangling turns)`);
console.log(`train ${train.length} · validation ${validation.length} · dropped ${report.duplicatesDropped} dupes, ${report.invalidDropped} invalid`);
console.log(`turns/example: min ${report.turnsPerExample.min}, avg ${report.turnsPerExample.avg}, max ${report.turnsPerExample.max}`);
if (problems.length) console.log(`first problems:\n  ${problems.slice(0, 5).join('\n  ')}`);
console.log(`\nDONE → ananya-training/vertex/`);
