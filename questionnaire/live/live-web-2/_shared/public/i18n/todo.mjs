/**
 * Lists what still needs translating, grouped by where it appears, so the most
 * visible strings can be done first.
 *   node _shared/public/i18n/todo.mjs [group]
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const src = fs.readFileSync(path.join(HERE, 'hi.js'), 'utf8');
const m = src.match(/window\.SU_I18N\.hi = (\{[\s\S]*?\n\});/);
const dict = eval('(' + m[1] + ')');

// Rebuild origins so each pending string can be grouped by what it is on screen.
const QUIZZES = [
  ['mens-wellness', 'config-mens-health.js'], ['mens-weight', 'config-mens-weight.js'],
  ['womens-wellness', 'config-womens-health.js'], ['womens-weight', 'config-womens-weight.js'],
];
const origin = new Map();
function walk(n, p, out) {
  if (typeof n === 'string') { out.push([p, n]); return; }
  if (Array.isArray(n)) { n.forEach((v, i) => walk(v, `${p}[${i}]`, out)); return; }
  if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) walk(v, p ? `${p}.${k}` : k, out);
}
for (const [dir, file] of QUIZZES) {
  const s = fs.readFileSync(path.join(ROOT, dir, 'public', file), 'utf8');
  const names = [...new Set([...s.matchAll(/^\s*(?:const|let|var)\s+(\w+)\s*=/gm)].map((x) => x[1]))];
  const expr = '({' + names.map((n) => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '})';
  const all = vm.runInNewContext(s + '\n;' + expr + ';',
    { window: {}, document: { getElementById: () => null }, console: { log() {}, error() {} } }, { timeout: 8000 });
  const leaves = [];
  for (const [name, v] of Object.entries(all)) {
    if (v === undefined || typeof v === 'function') continue;
    walk(v, name === 'questionnaireConfig' ? '' : name, leaves);
  }
  for (const [p, v] of leaves) if (!origin.has(v)) origin.set(v, p);
}

const bucket = (p = '') => {
  if (/\.label$/.test(p)) return '1-step-labels';
  if (/\.question$/.test(p)) return '2-questions';
  if (/options\[\d+]\.text$/.test(p)) return '3-options';
  if (/^causeMapping/.test(p)) return '4-causes';
  if (/^lifestyleTips/.test(p)) return '5-lifestyle-tips';
  if (/futureRisk|detailedFutureRisks/i.test(p)) return '6-future-risks';
  if (/[Tt]imeline/.test(p)) return '7-timeline';
  return '8-other';
};

const pending = Object.keys(dict).filter((k) => dict[k] === k);
const groups = {};
for (const k of pending) {
  const g = bucket(origin.get(k));
  (groups[g] = groups[g] || []).push(k);
}

const want = process.argv[2];
if (!want) {
  console.log(`pending: ${pending.length} of ${Object.keys(dict).length}\n`);
  Object.keys(groups).sort().forEach((g) => console.log(`  ${g.padEnd(18)} ${groups[g].length}`));
  console.log('\nrun with a group name to print its strings');
} else {
  const list = groups[Object.keys(groups).find((g) => g.includes(want))] || [];
  console.log(JSON.stringify(list, null, 1));
}
