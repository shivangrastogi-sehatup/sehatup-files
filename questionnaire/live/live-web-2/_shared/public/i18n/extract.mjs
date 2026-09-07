/**
 * Pulls every translatable English string out of the four questionnaire configs and
 * writes the Hindi catalogue skeleton.
 *
 * Run from questionnaire/live/live-web-1:   node _shared/public/i18n/extract.mjs
 *
 * WHY IT WORKS THE WAY IT DOES
 *
 * Classification is by PATH, never by content. The same sentence is display text in
 * one place and a lookup key in another - causeMapping is keyed by the English
 * question and answer text - so the only safe signal is where a string sits.
 *
 * The rule is a deny-list, not an allow-list. Walking the config tree only ever
 * yields VALUES; object keys are path segments and never reach the output. That
 * means causeMapping's two key levels are structurally unreachable, and every new
 * data table someone adds is picked up automatically instead of being silently
 * skipped until a person notices. An allow-list had already missed seven tables.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');   // live-web-1

const QUIZZES = [
  ['mens-wellness', 'config-mens-health.js'],
  ['mens-weight', 'config-mens-weight.js'],
  ['womens-wellness', 'config-womens-health.js'],
  ['womens-weight', 'config-womens-weight.js'],
];

// Identifiers, keys and assets. Everything else in the tree is shown to a person.
const NEVER = [
  [/^uiStrings(\.|$)/, 'handled by the uiStrings merge'],
  [/(^|\.)id$/, 'identifier'],
  [/\.(key|type|handle|sku|variantId|url|href|image|img|src|icon|class|className|color|colour|font)$/i, 'identifier or asset'],
  [/^progressSteps\[\d+]\.key$/, 'step key'],
  [/^questionGroups\[\d+]\.key$/, 'group key'],
  [/^productDatabase\.[^.]+\.(name|title)$/, 'product name - stays in Latin, house rule'],
  [/^[^.]*productDatabase[^.]*\[\d+]\.(name|title)$/, 'product name - stays in Latin, house rule'],
];
const denied = (p) => NEVER.some(([re]) => re.test(p));

// Strings that are not prose - scores, codes, single tokens - are not worth a
// translation entry and only add noise for whoever reviews the file.
const isProse = (v) =>
  typeof v === 'string' &&
  v.trim().length > 1 &&
  /[A-Za-z]{2}/.test(v) &&
  !/^https?:/i.test(v) &&
  !/^[\w-]+\.(js|css|png|jpg|jpeg|svg|webp)$/i.test(v);

function walk(node, p, out) {
  if (typeof node === 'string') { out.push([p, node]); return; }
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${p}[${i}]`, out)); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, p ? `${p}.${k}` : k, out);
  }
}

const catalogue = new Map();               // english -> Set(origin)
const add = (v, origin) => {
  if (!catalogue.has(v)) catalogue.set(v, new Set());
  catalogue.get(v).add(origin);
};

const report = [];
for (const [dir, file] of QUIZZES) {
  const src = fs.readFileSync(path.join(ROOT, dir, 'public', file), 'utf8');
  // Collect every top-level const/let/var, not only questionnaireConfig: some configs
  // keep results tables as loose bindings that calculateScore closes over.
  const names = [...new Set([...src.matchAll(/^\s*(?:const|let|var)\s+(\w+)\s*=/gm)].map((m) => m[1]))];
  const expr = '({' + names.map((n) => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '})';
  const all = vm.runInNewContext(src + '\n;' + expr + ';',
    { window: {}, document: { getElementById: () => null }, console: { log() {}, error() {} } },
    { timeout: 8000 });

  const leaves = [];
  for (const [name, value] of Object.entries(all)) {
    if (value === undefined || typeof value === 'function') continue;
    // questionnaireConfig re-exports several of these; the Map dedupes by string.
    walk(value, name === 'questionnaireConfig' ? '' : name, leaves);
  }
  let kept = 0, skipped = 0;
  for (const [p, v] of leaves) {
    if (denied(p)) { skipped++; continue; }
    if (!isProse(v)) { skipped++; continue; }
    add(v, `${dir}:${p}`);
    kept++;
  }

  // Prose inside calculateScore() and friends is not reachable by walking data - it
  // lives in the function source. Collect the literals so the catalogue is complete;
  // translate() unwraps the <p> the config adds around them at render time.
  const fnAt = src.search(/calculateScore\s*[:(]/);
  let fnKept = 0;
  if (fnAt >= 0) {
    for (const m of src.slice(fnAt).matchAll(/(['"])((?:\\.|(?!\1)[^\\]){10,})\1/g)) {
      const v = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
      // The literal scanner runs over raw source, so a regex that walks past an
      // escaped quote swallows whole blocks of JavaScript. Everything below rejects
      // code that made it through: a real sentence has none of these.
      if (!/ /.test(v) || !/[a-z]{3}/.test(v)) continue;
      if (/^[\w.\-/#]+$/.test(v) || v.includes('${') || /^<[a-z]/i.test(v)) continue;
      if (/[\n\r]/.test(v)) continue;                       // spans lines - it is code
      if (/[;{}]|=>|\)\s*\{|\|\||&&/.test(v)) continue;        // JS punctuation
      if (/\b(const|let|var|return|function|config|allAnswers|results|userInfo|push|map|forEach|includes)\b/.test(v)) continue;
      if (!/^[A-Z]/.test(v.trim())) continue;                // sentences start capitalised
      if (v.trim().split(/\s+/).length < 3) continue;         // too short to be prose
      add(v, `${dir}:calculateScore()`);
      fnKept++;
    }
  }
  // Step tabs the ENGINE derives rather than the config declaring them: when a
  // question group has no label, questionnaire-engine.js builds one from the group
  // key. Those strings are displayed but exist nowhere in the config, so without
  // this they vanish from the catalogue on every regenerate.
  for (const g of (all.questionnaireConfig?.questionGroups || [])) {
    if (g.label || !g.key) continue;
    const derived = (g.key.charAt(0).toUpperCase() + g.key.slice(1)).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    if (isProse(derived)) add(derived, `${dir}:questionGroups[].key -> derived tab label`);
  }

  report.push([dir, leaves.length, kept, fnKept, skipped]);
}

console.log('  quiz              leaves  from-data  from-functions  skipped');
report.forEach(([d, l, k, f, s]) =>
  console.log(`  ${d.padEnd(17)} ${String(l).padStart(5)} ${String(k).padStart(10)} ${String(f).padStart(15)} ${String(s).padStart(8)}`));
console.log(`\n  unique English strings: ${catalogue.size}`);

// ---- write the catalogue -----------------------------------------------------
const entries = [...catalogue.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const OUT = path.join(HERE, 'hi.js');

let existing = {};
if (fs.existsSync(OUT)) {
  const prev = fs.readFileSync(OUT, 'utf8');
  const m = prev.match(/window\.SU_I18N\.hi = (\{[\s\S]*?\n\});/);
  if (m) { try { existing = eval('(' + m[1] + ')'); } catch (e) { /* regenerate */ } }
}

const lines = entries.map(([en, origins]) => {
  const hi = existing[en] !== undefined ? existing[en] : en;   // never lose work already done
  const where = [...origins][0].split(':')[1].split(/[.[]/)[0];
  return `  ${JSON.stringify(en)}:\n    ${JSON.stringify(hi)},${hi === en ? '   // TODO' : ''}  // ${where}`;
});

fs.writeFileSync(OUT,
`/**
 * Hindi catalogue - generated by extract.mjs, then translated by hand.
 *
 * Keyed by the English source string. A key with no translation yet holds its own
 * English, and translate() falls back to English for anything missing, so a
 * half-finished file always ships safely rather than showing blanks.
 *
 * Regenerate after editing any config:  node _shared/public/i18n/extract.mjs
 * Existing translations are preserved; only new strings are added.
 */
window.SU_I18N = window.SU_I18N || {};
window.SU_I18N.hi = {
${lines.join('\n')}
};
`);

const done = entries.filter(([en]) => existing[en] !== undefined && existing[en] !== en).length;
console.log(`  wrote ${path.relative(ROOT, OUT)}  (${entries.length} entries, ${done} already translated)`);
