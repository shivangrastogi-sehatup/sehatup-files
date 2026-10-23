const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/featured-in-custom.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b, all) => { const c = t.split(a).length - 1; if (all ? c < 1 : c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = all ? t.split(a).join(b) : t.replace(a, b); };
const P = '.ftr-{{ sid }}.ftr--page';

// Breakpoint gap (599.01-599.99px had neither layout).
rep(`(max-width: 599px)`, `(max-width: 599.98px)`, true);

rep(`  @media (prefers-reduced-motion: reduce) {
    .ftr-track-{{ sid }}.is-scrolling { animation: none; }`,
`  /* "Health Score page look": heading and big-screen growth like the
     other Health Score page sections (zoom is safe here: the strip measures
     itself with offsetWidth / scrollWidth, which ignore zoom). */
  ${P} .ftr-inner-{{ sid }} { max-width: 1320px; }
  ${P} .ftr-heading-{{ sid }} { margin: 0 0 24px; color: #1d1d1d; font: 800 clamp(30px, 3.6vw, 52px)/1.06 'Montserrat', sans-serif; letter-spacing: -.02em; text-wrap: balance; }
  @media (min-width: 750px) and (max-width: 1099.98px) { ${P} .ftr-heading-{{ sid }} { font-size: 38px; } }
  @media (max-width: 749.98px) { ${P} .ftr-heading-{{ sid }} { font-size: 30px; margin-bottom: 16px; } }
  @media (min-width: 1680px) { ${P} .ftr-inner-{{ sid }} { zoom: 1.12; } }
  @media (min-width: 1920px) { ${P} .ftr-inner-{{ sid }} { zoom: 1.25; max-width: 1360px; } }
  @media (min-width: 2240px) { ${P} .ftr-inner-{{ sid }} { zoom: 1.45; } }
  @media (min-width: 2560px) { ${P} .ftr-inner-{{ sid }} { zoom: 1.65; max-width: 1440px; } }
  @media (min-width: 3200px) { ${P} .ftr-inner-{{ sid }} { zoom: 2; } }
  @media (min-width: 3840px) { ${P} .ftr-inner-{{ sid }} { zoom: 2.4; } }

  @media (prefers-reduced-motion: reduce) {
    .ftr-track-{{ sid }}.is-scrolling { animation: none; }`);
rep(`<section class="ftr-{{ sid }}">`, `<section class="ftr-{{ sid }}{% if s.page_style %} ftr--page{% endif %}">`);

const sch = t.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
const j = JSON.parse(sch[1]);
const at = j.settings.findIndex(x => x.id === 'heading');
if (at < 0) throw new Error('no heading setting');
j.settings.splice(at + 1, 0, { type: 'checkbox', id: 'page_style', label: 'Health Score page look', info: 'Big heading and big-screen sizing like the other Health Score page sections.', default: false });
t = t.replace(sch[1], '\n' + JSON.stringify(j, null, 2) + '\n');
fs.writeFileSync(p, t);

const tp = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/templates/page.healthscore 360.json';
let tt = fs.readFileSync(tp, 'utf8');
const a = '"heading": "sehatUP in the News",';
if (tt.split(a).length !== 2) throw new Error('template anchor x' + (tt.split(a).length - 1));
tt = tt.replace(a, a + '\n        "page_style": true,');
JSON.parse(tt.slice(tt.indexOf('{')));
fs.writeFileSync(tp, tt);
console.log('ok');
