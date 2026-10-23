const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-journey.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };

rep(`  @media (min-width: 750px) and (max-width: 1099.98px) {
    #hj-{{ section.id }} .hj__inner { max-width: none; padding: 72px 6% 40px; }`,
`  @media (min-width: 640px) and (max-width: 1099.98px) {
    #hj-{{ section.id }} .hj__inner { max-width: none; padding: 72px 6% 40px; }`);

rep(`    #hj-{{ section.id }}.is-live .hj__slot { grid-area: 1 / 2 / 7 / 3; margin-top: 0; width: calc(var(--ph) * .49 + 162px); }
  }`,
`    #hj-{{ section.id }}.is-live .hj__slot { grid-area: 1 / 2 / 7 / 3; margin-top: 0; width: calc(var(--ph) * .49 + 162px); }
  }
  /* Large phones (640-749): same side by side, a slightly smaller phone. */
  @media (min-width: 640px) and (max-width: 749.98px) {
    #hj-{{ section.id }} { --ph: min(380px, 62svh); }
    #hj-{{ section.id }} .hj__inner { padding: 56px 24px 32px; }
    #hj-{{ section.id }} .hj__heading { font-size: 32px; }
    #hj-{{ section.id }}.is-live .hj__step { column-gap: 24px; }
    #hj-{{ section.id }}.is-live .hj__title { font-size: 24px; }
    #hj-{{ section.id }}.is-live .hj__text { font-size: 15px; }
  }
  /* Phones: no room beside the text, so the phone and its card sit centred below it. */
  @media (max-width: 639.98px) {
    #hj-{{ section.id }}.is-live .hj__slot { width: calc(var(--ph) * .49 + 162px); max-width: 100%; margin-left: auto; margin-right: auto; }
  }`);
fs.writeFileSync(p, t);
console.log('ok');
