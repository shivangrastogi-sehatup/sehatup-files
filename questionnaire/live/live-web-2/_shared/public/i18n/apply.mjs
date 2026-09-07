/**
 * Merge a batch of translations into hi.js.
 *
 *   node _shared/public/i18n/apply.mjs <batch.json>
 *
 * A batch is { "english source string": "हिंदी", ... }. Keys that are not already in
 * the catalogue are reported and skipped rather than added: if a key does not match
 * a real config string exactly, it would sit in the file translating nothing, which
 * is the quiet failure this whole scheme exists to avoid.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'hi.js');
const batchFile = process.argv[2];
if (!batchFile) { console.error('usage: node apply.mjs <batch.json>'); process.exit(1); }

const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
const src = fs.readFileSync(OUT, 'utf8');
const m = src.match(/window\.SU_I18N\.hi = (\{[\s\S]*?\n\});/);
if (!m) { console.error('could not parse hi.js'); process.exit(1); }
const current = eval('(' + m[1] + ')');

let applied = 0, unknown = [], unchanged = 0;
for (const [en, hi] of Object.entries(batch)) {
  if (!(en in current)) { unknown.push(en); continue; }
  if (current[en] === hi) { unchanged++; continue; }
  current[en] = hi;
  applied++;
}

const keys = Object.keys(current).sort((a, b) => a.localeCompare(b));
const lines = keys.map((en) => {
  const hi = current[en];
  return `  ${JSON.stringify(en)}:\n    ${JSON.stringify(hi)},${hi === en ? '   // TODO' : ''}`;
});

const header = src.slice(0, src.indexOf('window.SU_I18N = window.SU_I18N'));
fs.writeFileSync(OUT, header + 'window.SU_I18N = window.SU_I18N || {};\nwindow.SU_I18N.hi = {\n' + lines.join('\n') + '\n};\n');

const todo = keys.filter((k) => current[k] === k).length;
console.log(`applied ${applied}, unchanged ${unchanged}, unknown ${unknown.length}`);
if (unknown.length) unknown.slice(0, 10).forEach((k) => console.log('   UNKNOWN KEY: ' + JSON.stringify(k.slice(0, 70))));
console.log(`catalogue: ${keys.length} entries, ${keys.length - todo} translated, ${todo} still English`);
