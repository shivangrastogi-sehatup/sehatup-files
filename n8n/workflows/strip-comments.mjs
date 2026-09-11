// Generate the comment-free copy of a node file. The COMMENTED file stays the source of
// truth - regenerate rather than editing the stripped one, or the two drift apart.
//   node strip-comments.mjs extract-ai-response.txt extract-ai-response.min.txt
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out] = process.argv.slice(2);
const s = readFileSync(src, 'utf8');

// Character-level scan: a "//" inside a string or a regex is not a comment, and this file is
// full of URLs (https://) and regex literals. A naive line regex mangles both.
let r = '', i = 0, mode = 'code', quote = '';
while (i < s.length) {
  const c = s[i], n = s[i + 1];
  if (mode === 'code') {
    if (c === '/' && n === '/') { mode = 'line'; i += 2; continue; }
    if (c === '/' && n === '*') { mode = 'block'; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') { mode = 'str'; quote = c; r += c; i++; continue; }
    // A regex literal starts only where a value can start, i.e. after an operator or opener.
    if (c === '/') {
      const prev = r.replace(/\s+$/, '').slice(-1);
      if (prev === '' || '(,=:[!&|?{};+-*%~^<>'.includes(prev)) { mode = 're'; r += c; i++; continue; }
    }
    r += c; i++; continue;
  }
  if (mode === 'line') { if (c === '\n') { mode = 'code'; r += c; } i++; continue; }
  if (mode === 'block') { if (c === '*' && n === '/') { mode = 'code'; i += 2; } else i++; continue; }
  if (mode === 'str') { if (c === '\\') { r += c + (n || ''); i += 2; continue; } if (c === quote) mode = 'code'; r += c; i++; continue; }
  if (mode === 're') { if (c === '\\') { r += c + (n || ''); i += 2; continue; } if (c === '[') { mode = 'recls'; r += c; i++; continue; } if (c === '/') mode = 'code'; r += c; i++; continue; }
  if (mode === 'recls') { if (c === '\\') { r += c + (n || ''); i += 2; continue; } if (c === ']') mode = 're'; r += c; i++; continue; }
}

const clean = r
  .split('\n').map((l) => l.replace(/[ \t]+$/, ''))
  .filter((l, idx, arr) => !(l === '' && arr[idx - 1] === ''))
  .join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
writeFileSync(out, clean);
console.log(src + ' ' + s.length + ' chars -> ' + out + ' ' + clean.length + ' chars ('
  + Math.round((1 - clean.length / s.length) * 100) + '% smaller)');
