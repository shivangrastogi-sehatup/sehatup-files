const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-check-doors.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };

// Photo size / position (laptop and up; bigger screens scale with the zoom steps below).
rep(`  @media (min-width: 1400px) {
    #hcd-{{ section.id }} .d__panel--her .d__body { margin-left: 42%; }`,
`  /* Laptop and up: photo size and left/right position from the section settings. */
  @media (min-width: 1100px) {
    #hcd-{{ section.id }} .d__panel--her .d__person { height: calc((100% + 56px) * var(--her-s, 1)); left: var(--her-x, 0%); }
    #hcd-{{ section.id }} .d__panel--him .d__person { height: calc((100% + 56px) * var(--him-s, 1)); right: calc(var(--him-x, 0%) * -1); }
  }
  /* Big screens (QHD, 4K): the whole section grows in steps, so the layout set
     on a laptop keeps its proportions. */
  @media (min-width: 1680px) { #hcd-{{ section.id }} .d__in { zoom: 1.12; } }
  @media (min-width: 1920px) { #hcd-{{ section.id }} .d__in { zoom: 1.25; } }
  @media (min-width: 2240px) { #hcd-{{ section.id }} .d__in { zoom: 1.45; } }
  @media (min-width: 2560px) { #hcd-{{ section.id }} .d__in { zoom: 1.65; } }
  @media (min-width: 3200px) { #hcd-{{ section.id }} .d__in { zoom: 2; } }
  @media (min-width: 3840px) { #hcd-{{ section.id }} .d__in { zoom: 2.4; } }

  @media (min-width: 1400px) {
    #hcd-{{ section.id }} .d__panel--her .d__body { margin-left: 42%; }`);

rep(`<section id="hcd-{{ section.id }}" class="hcd">`,
`<section id="hcd-{{ section.id }}" class="hcd" style="--her-s: {{ s.her_img_size | default: 100 | divided_by: 100.0 }}; --her-x: {{ s.her_img_x | default: 0 }}%; --him-s: {{ s.him_img_size | default: 100 | divided_by: 100.0 }}; --him-x: {{ s.him_img_x | default: 0 }}%;">`);

const sch = t.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
const j = JSON.parse(sch[1]);
const add = (afterId, items) => { const i = j.settings.findIndex(s => s.id === afterId); if (i < 0) throw new Error('no ' + afterId); j.settings.splice(i + 1, 0, ...items); };
add('her_face', [
  { type: 'range', id: 'her_img_size', label: 'Her photo size (laptop)', min: 70, max: 160, step: 5, unit: '%', default: 100, info: 'Bigger zooms the photo in. Set it on a laptop: big screens scale it up, tablets and phones arrange themselves.' },
  { type: 'range', id: 'her_img_x', label: 'Her photo: move left / right', min: -30, max: 30, step: 1, unit: '%', default: 0, info: 'Minus moves left, plus moves right.' },
]);
add('him_face', [
  { type: 'range', id: 'him_img_size', label: 'His photo size (laptop)', min: 70, max: 160, step: 5, unit: '%', default: 100, info: 'Bigger zooms the photo in.' },
  { type: 'range', id: 'him_img_x', label: 'His photo: move left / right', min: -30, max: 30, step: 1, unit: '%', default: 0, info: 'Minus moves left, plus moves right.' },
]);
t = t.replace(sch[1], '\n' + JSON.stringify(j, null, 2) + '\n');
fs.writeFileSync(p, t);
console.log('ok, uses settings var s:', /assign s = section.settings/.test(t));
