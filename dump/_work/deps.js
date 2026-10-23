// Files the draft's Health Score 360 page needs, compared with theme 189138927919.
const fs = require('fs'), path = require('path');
const DRAFT = 'D:/firebase/sehatupfirebase-main/shopify-theme/live', T = 'D:/firebase/sehatupfirebase-main/dump/_work/t189';
const rd = (root, f) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return null; } };
const json = s => JSON.parse(s.slice(s.indexOf('{')));
const tpl = json(rd(DRAFT, 'templates/page.healthscore 360.json'));
const need = new Set(['templates/page.healthscore 360.json']);
const queue = [];
const add = f => { if (!need.has(f)) { need.add(f); queue.push(f); } };
const walkBlocks = (blocks) => { for (const b of Object.values(blocks || {})) { if (b.type && !b.type.startsWith('@') && rd(DRAFT, `blocks/${b.type}.liquid`) != null) add(`blocks/${b.type}.liquid`); walkBlocks(b.blocks); } };
for (const s of Object.values(tpl.sections)) { add(`sections/${s.type}.liquid`); walkBlocks(s.blocks); }
while (queue.length) {
  const f = queue.shift(), src = rd(DRAFT, f);
  if (src == null) { console.log('MISSING IN DRAFT', f); continue; }
  for (const m of src.matchAll(/\{%-?\s*(?:render|include)\s+['"]([^'"]+)['"]/g)) add(`snippets/${m[1]}.liquid`);
  for (const m of src.matchAll(/\brender\s+['"]([^'"]+)['"]/g)) add(`snippets/${m[1]}.liquid`);
  for (const m of src.matchAll(/['"]([\w.-]+\.(?:css|js|svg|png|jpg|webp|woff2?|json))['"]\s*\|\s*asset_url/g)) add(`assets/${m[1]}`);
  for (const m of src.matchAll(/content_for\s+['"]block['"],\s*type:\s*['"]([^'"]+)['"]/g)) add(`blocks/${m[1]}.liquid`);
}
// Which other templates / groups in the target theme use each section?
const users = {};
const scan = dir => { for (const f of fs.readdirSync(path.join(T, dir))) if (f.endsWith('.json')) { try { const j = json(rd(T, `${dir}/${f}`)); for (const s of Object.values(j.sections || {})) (users[s.type] ||= new Set()).add(`${dir}/${f}`); } catch {} } };
scan('templates'); scan('sections');
const rows = [];
for (const f of [...need].sort()) {
  const a = rd(DRAFT, f), b = rd(T, f);
  const state = a == null ? 'not in draft' : b == null ? 'NEW' : a === b ? 'same' : 'DIFFERENT';
  let used = '';
  if (f.startsWith('sections/')) { const ty = path.basename(f, '.liquid'); used = [...(users[ty] || [])].filter(x => x !== 'templates/page.healthscore 360.json').join(', '); }
  rows.push(`${state.padEnd(12)} ${f}${used ? '   (also used by: ' + used + ')' : ''}`);
}
console.log(rows.join('\n'));
console.log('layout:', tpl.layout || '(default theme.liquid)');
