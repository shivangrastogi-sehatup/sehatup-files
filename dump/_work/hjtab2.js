const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-journey.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };

rep(`      display: flex; justify-content: flex-start; position: relative; margin-top: 22px;
      width: calc(var(--ph) * .49 + 136px); max-width: 100%;`,
`      display: flex; justify-content: flex-start; position: relative; margin-top: 22px;`);
rep(`    #hj-{{ section.id }} .hj__inner { grid-template-columns: 1fr; gap: 0; padding: 56px 16px 32px; }`,
`    #hj-{{ section.id }} .hj__inner { grid-template-columns: minmax(0, 1fr); gap: 0; padding: 56px 16px 32px; }`);
// Card and kit box hang off the phone's right edge; on narrow phones they
// slide left over the phone just enough to stay on screen.
rep(`    #hj-{{ section.id }}.is-live .hj__slot .hj__chip { right: 0; top: 16%; padding: 9px 10px; border-radius: 12px; }`,
`    #hj-{{ section.id }}.is-live .hj__slot .hj__chip { left: min(calc(var(--ph) * .49 + 12px), calc(100% - 150px)); right: auto; max-width: 150px; top: 16%; padding: 9px 10px; border-radius: 12px; }`);
rep(`    #hj-{{ section.id }}.is-live .hj__slot .hj__box { right: 0; bottom: 3%; width: calc(var(--ph) * .34); }`,
`    #hj-{{ section.id }}.is-live .hj__slot .hj__box { left: min(calc(var(--ph) * .4), calc(100% - var(--ph) * .34)); right: auto; bottom: 3%; width: calc(var(--ph) * .34); }`);
rep(`    #hj-{{ section.id }}.is-live .hj__slot { grid-area: 1 / 2 / 7 / 3; margin-top: 0; }`,
`    #hj-{{ section.id }}.is-live .hj__slot { grid-area: 1 / 2 / 7 / 3; margin-top: 0; width: calc(var(--ph) * .49 + 162px); }`);
fs.writeFileSync(p, t);
console.log('ok');
