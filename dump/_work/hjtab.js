const fs = require('fs'), dir = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/';

// 1. Breakpoint gaps: "max-width: 1099px" + "min-width: 1100px" leaves
// 1099.01-1099.99px (zoomed / scaled screens) with neither rule. Close them.
for (const f of ['health-score-glance', 'health-check-doors', 'health-journey', 'health-signs', 'health-doctors', 'health-kits', 'health-trust', 'health-faq', 'health-final-cta', 'sehat-header']) {
  const p = dir + f + '.liquid';
  let t = fs.readFileSync(p, 'utf8'), n = 0;
  t = t.replace(/max-width:(\s*)(599|699|749|1023|1099|1279)px\)/g, (m, sp, v) => (n++, `max-width:${sp}${v}.98px)`));
  fs.writeFileSync(p, t);
  console.log(f, n);
}

// 2. Journey: tablet uses the full width, the score card stays by the phone,
// call buttons get icons.
const p = dir + 'health-journey.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };

rep(`    #hj-{{ section.id }}.is-live .hj__slot {
      /* Phone to the left, the score card beside it rather than on the screen. */
      display: flex; justify-content: flex-start; position: relative; margin-top: 22px;`,
`    #hj-{{ section.id }}.is-live .hj__slot {
      /* Phone to the left, the score card right beside it rather than on the screen. */
      display: flex; justify-content: flex-start; position: relative; margin-top: 22px;
      width: calc(var(--ph) * .49 + 136px); max-width: 100%;`);

rep(`  @media (min-width: 750px) and (max-width: 1099.98px) {
    #hj-{{ section.id }} .hj__inner { max-width: 600px; padding: 72px 24px 40px; }
    #hj-{{ section.id }} .hj__heading { font-size: 38px; margin-bottom: 12px; }
    /* keep the score card right beside its phone */
    #hj-{{ section.id }} .hj__slot { max-width: 400px; }
  }`,
`  @media (min-width: 750px) and (max-width: 1099.98px) {
    #hj-{{ section.id }} .hj__inner { max-width: none; padding: 72px 6% 40px; }
    #hj-{{ section.id }} .hj__heading { font-size: 38px; margin-bottom: 12px; }
    /* Each step: its text on the left, its phone and score card on the right. */
    #hj-{{ section.id }}.is-live .hj__step {
      display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: 1fr auto auto auto auto 1fr;
      column-gap: 6%; padding: 32px 0;
    }
    #hj-{{ section.id }}.is-live .hj__n { grid-area: 2 / 1; }
    #hj-{{ section.id }}.is-live .hj__day { grid-area: 3 / 1; }
    #hj-{{ section.id }}.is-live .hj__title { grid-area: 4 / 1; font-size: 30px; }
    #hj-{{ section.id }}.is-live .hj__text { grid-area: 5 / 1; font-size: 16px; }
    #hj-{{ section.id }}.is-live .hj__slot { grid-area: 1 / 2 / 7 / 3; margin-top: 0; }
  }`);

const ico = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
rep(`<div class="hj__call-btns"><span></span><span class="hj__end"></span><span></span></div>`,
`<div class="hj__call-btns"><span>${ico('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>')}</span><span class="hj__end">${ico('<path d="M3 14.5c5-4.7 13-4.7 18 0l-2.3 2.3-3.2-1.6v-2.4a11 11 0 0 0-7 0v2.4l-3.2 1.6z"/>')}</span><span>${ico('<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>')}</span></div>`);
rep(`  #hj-{{ section.id }} .hj__call-btns span { width: 2.6em; height: 2.6em; border-radius: 50%; background: rgba(255,255,255,.22); }`,
`  #hj-{{ section.id }} .hj__call-btns span { width: 2.6em; height: 2.6em; border-radius: 50%; background: rgba(255,255,255,.22); display: grid; place-items: center; color: #fff; }
  #hj-{{ section.id }} .hj__call-btns svg { width: 1.15em; height: 1.15em; }`);

fs.writeFileSync(p, t);
console.log('journey ok');
