// Phones (below 750px): section titles and intro lines use the full width.
const fs = require('fs'), dir = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/';
const edit = (f, pairs) => {
  const p = dir + f + '.liquid'; let t = fs.readFileSync(p, 'utf8');
  for (const [a, b] of pairs) { const c = t.split(a).length - 1; if (c !== 1) throw new Error(f + ': anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); }
  fs.writeFileSync(p, t); console.log('ok', f);
};
const ph = (id, rules) => `\n  /* Phones: title and intro use the full width. */\n  @media (max-width: 749.98px) { ${rules.map(r => `#${id}-{{ section.id }} ${r}`).join(' ')} }\n</style>`;

edit('health-journey', [[`  @media (prefers-reduced-motion: reduce) {\n    #hj-`, `  @media (max-width: 749.98px) { #hj-{{ section.id }} .hj__heading, #hj-{{ section.id }} .hj__text { max-width: none; } }\n\n  @media (prefers-reduced-motion: reduce) {\n    #hj-`]]);
edit('health-signs', [[`    #hsg-{{ section.id }} .hsg__sub { font-size: 15px; }`, `    #hsg-{{ section.id }} .hsg__sub { font-size: 15px; max-width: none; }`]]);
edit('health-doctors', [[`.hdr__sub { font-size: 15px; max-width: 600px; }`, `.hdr__sub { font-size: 15px; max-width: none; }`]]);
edit('health-kits', [[`    #hkt-{{ section.id }} .hkt__sub { font-size: 14.5px; }`, `    #hkt-{{ section.id }} .hkt__sub { font-size: 14.5px; max-width: none; }`]]);
edit('health-trust', [[`</style>`, ph('htr', ['.htr__head { max-width: none; }'])]]);
edit('health-final-cta', [[`    #hfc-{{ section.id }} .hfc__inner { padding: 52px 20px; border-radius: 22px; }`, `    #hfc-{{ section.id }} .hfc__inner { padding: 52px 16px; border-radius: 22px; }\n    #hfc-{{ section.id }} .hfc__heading, #hfc-{{ section.id }} .hfc__sub { max-width: none; }`]]);
edit('health-score-glance', [[`    #hsg-{{ section.id }} .g__in { grid-template-columns: minmax(0, 1fr); gap: 0; padding: 36px 20px 40px; }`, `    #hsg-{{ section.id }} .g__in { grid-template-columns: minmax(0, 1fr); gap: 0; padding: 36px 16px 40px; }`]]);
