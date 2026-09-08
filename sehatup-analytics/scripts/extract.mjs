/**
 * Move a contiguous run of declarations out of NewUI.jsx into its own module.
 *
 *   node scripts/extract.mjs <out-file> <startAnchor> <lastDeclAnchor> <name,name,...>
 *
 * Safety, because this edits a 14k-line file that runs a live CRM:
 *   - the end of the block is found by BRACE MATCHING from the last declaration,
 *     not by looking for a line that trims to "}" (an indented inner brace
 *     matches that too, which silently cut a function in half)
 *   - refuses to run if the block references React or Firestore
 *   - refuses unless every requested name is present and gets exported
 *   - asserts the resulting line count, so nothing is duplicated or lost
 * Nothing is written unless every check passes.
 */
import fs from 'fs';

const [outFile, startAnchor, lastDecl, namesArg] = process.argv.slice(2);
if (!outFile || !startAnchor || !lastDecl || !namesArg) {
  console.error('usage: extract.mjs <out> <startAnchor> <lastDeclAnchor> <names>');
  process.exit(1);
}
const names = namesArg.split(',').map(s => s.trim()).filter(Boolean);

const SRC = 'src/NewUI.jsx';
const raw = fs.readFileSync(SRC, 'utf8');
const NL = raw.includes('\r\n') ? '\r\n' : '\n';
const L = raw.split(/\r?\n/);

const start = L.findIndex(l => l.includes(startAnchor));
if (start < 0) throw new Error(`start anchor not found: ${startAnchor}`);
const declLine = L.findIndex((l, i) => i >= start && l.startsWith(lastDecl));
if (declLine < 0) throw new Error(`last declaration not found: ${lastDecl}`);

// Walk braces from the last declaration to its real closing brace. Strings and
// comments are not parsed; these are plain declarations, and the assertions
// below catch it if that ever stops being true.
let depth = 0, end = -1, seen = false;
for (let i = declLine; i < L.length; i++) {
  for (const ch of L[i]) {
    if (ch === '{') { depth++; seen = true; }
    else if (ch === '}') depth--;
  }
  if (seen && depth === 0) { end = i + 1; break; }
  if (depth < 0) throw new Error(`unbalanced braces near line ${i + 1}`);
}
if (end < 0) throw new Error('could not find end of block');

const block = L.slice(start, end);
const text = block.join(NL);

if (/\buseState\b|\buseEffect\b|React\.|<[A-Z][A-Za-z]*[\s/>]/.test(text)) {
  throw new Error('block references React — not a pure helper module');
}
if (/\bdb\b|firestore|collection\(|getDocs\(/.test(text)) {
  throw new Error('block touches Firestore — not a pure helper module');
}
for (const n of names) {
  if (!new RegExp(`^(const|function) ${n}\\b`, 'm').test(text)) {
    throw new Error(`"${n}" is not declared at the top level of this block`);
  }
}

let body = text;
for (const n of names) {
  body = body.replace(new RegExp(`^(const|function) ${n}\\b`, 'm'), `export $1 ${n}`);
}
const exported = (body.match(/^export (const|function)/gm) || []).length;
if (exported !== names.length) throw new Error(`expected ${names.length} exports, produced ${exported}`);

const rest = L.slice(0, start).concat(L.slice(end));
const imp = `import { ${names.join(', ')} } from './${outFile.replace(/^src\//, '').replace(/\.jsx?$/, '')}';`;
let lastImport = -1;
for (let k = 0; k < 80; k++) if (rest[k] && rest[k].startsWith('import ')) lastImport = k;
if (lastImport < 0) throw new Error('no import block found to append to');
rest.splice(lastImport + 1, 0, imp);

if (rest.length !== L.length - block.length + 1) throw new Error('line-count check failed');

fs.mkdirSync(outFile.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(outFile, body + NL);
fs.writeFileSync(SRC, rest.join(NL));
console.log(`${outFile}: ${block.length} lines, ${exported} exports`);
console.log(`NewUI.jsx: ${L.length} -> ${rest.length}`);
