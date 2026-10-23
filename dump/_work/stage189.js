// Stage the draft's Health Score 360 page for theme 189138927919 (a copy of live).
const fs = require('fs'), path = require('path');
const D = 'D:/firebase/sehatupfirebase-main/shopify-theme/live', OUT = 'D:/firebase/sehatupfirebase-main/dump/_work/stage189';
fs.rmSync(OUT, { recursive: true, force: true });
const cp = (from, to = from) => { fs.mkdirSync(path.dirname(path.join(OUT, to)), { recursive: true }); fs.copyFileSync(path.join(D, from), path.join(OUT, to)); };

for (const s of ['health-check-cards', 'health-check-doors', 'health-doctors', 'health-faq', 'health-final-cta', 'health-journey', 'health-kits', 'health-score-glance', 'health-score-scroll', 'health-signs', 'health-trust', 'featured-in-custom'])
  cp(`sections/${s}.liquid`);
cp('assets/sehat-accordion.js'); cp('assets/hs360-couple-v3-4k.webp');

// The draft's newer floating video, under its own name, so the live one used on
// the homepage, landing pages and product page stays as it is.
let v = fs.readFileSync(path.join(D, 'sections/floating-product-video.liquid'), 'utf8');
const m = v.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
const sch = JSON.parse(m[1]);
sch.name = 'Video (Health Score)';
if (sch.presets) sch.presets = sch.presets.map(p => ({ ...p, name: 'Video (Health Score)' }));
v = v.replace(m[1], '\n' + JSON.stringify(sch, null, 2) + '\n');
fs.mkdirSync(path.join(OUT, 'sections'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'sections/floating-product-video-hs360.liquid'), v);

// Template: same as the draft, the video pointed at the renamed copy.
let t = fs.readFileSync(path.join(D, 'templates/page.healthscore 360.json'), 'utf8');
const n = t.split('"type": "floating-product-video"').length - 1;
if (n !== 1) throw new Error('video type x' + n);
t = t.replace('"type": "floating-product-video"', '"type": "floating-product-video-hs360"');
JSON.parse(t.slice(t.indexOf('{')));
fs.mkdirSync(path.join(OUT, 'templates'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'templates/page.healthscore 360.json'), t);

const list = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : list.push(path.relative(OUT, p).replace(/\\/g, '/')); } })(OUT);
console.log(list.join('\n'));
