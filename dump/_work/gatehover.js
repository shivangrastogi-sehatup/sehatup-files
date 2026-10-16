// Wrap every CSS rule that uses :hover (and is not already inside an
// @media (hover: hover) block) in @media (hover: hover) { ... }.
// Selector lists that mix :hover with other selectors are split: the
// non-hover selectors keep the rule ungated.
const fs = require('fs');
const A = '\u0001', B = '\u0002';
for (const p of process.argv.slice(2)) {
  const t = fs.readFileSync(p, 'utf8');
  const s0 = t.indexOf('<style'), s1 = t.indexOf('</style>', s0);
  if (s0 < 0) { console.log('no style', p); continue; }
  const head = t.slice(0, s0), tail = t.slice(s1);
  const liq = [];
  const css = t.slice(s0, s1).replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g, m => A + (liq.push(m) - 1) + B);
  let out = '', i = 0, depth = 0, n = 0;
  const gate = [];
  while (i < css.length) {
    const ob = css.indexOf('{', i), cb = css.indexOf('}', i);
    if (ob < 0 && cb < 0) { out += css.slice(i); break; }
    if (cb >= 0 && (ob < 0 || cb < ob)) {
      out += css.slice(i, cb + 1); i = cb + 1; depth--;
      while (gate.length && depth < gate[gate.length - 1]) gate.pop();
      continue;
    }
    const pre = css.slice(i, ob);
    let cut = Math.max(pre.lastIndexOf('}') + 1, pre.lastIndexOf('*/') + 2, pre.lastIndexOf('>') + 1, 0);
    // Liquid tags at the very start (e.g. {% if %}) stay outside the rule.
    const peel = pre.slice(cut).match(new RegExp('^(\\s*' + A + '\\d+' + B + ')*'));
    if (peel) cut += peel[0].length;
    const lead = pre.slice(0, cut), selRaw = pre.slice(cut), sel = selRaw.trim();
    if (sel.startsWith('@')) {
      out += pre + '{'; i = ob + 1; depth++;
      if (/\(hover:\s*hover\)/.test(sel)) gate.push(depth);
      continue;
    }
    const end = css.indexOf('}', ob);
    const body = css.slice(ob, end + 1);
    if (!gate.length && sel.includes(':hover')) {
      const parts = sel.split(',').map(x => x.trim());
      const hov = parts.filter(x => x.includes(':hover')), rest = parts.filter(x => !x.includes(':hover'));
      const indent = (selRaw.match(/^\s*/) || [''])[0];
      out += lead + indent + (rest.length ? rest.join(', ') + ' ' + body + indent : '') + '@media (hover: hover) { ' + hov.join(', ') + ' ' + body + ' }';
      n++;
    } else out += pre + body;
    i = end + 1;
  }
  out = out.replace(new RegExp(A + '(\\d+)' + B, 'g'), (m, k) => liq[+k]);
  fs.writeFileSync(p, head + out + tail);
  console.log(p.split(/[\\/]/).pop(), 'gated', n);
}
