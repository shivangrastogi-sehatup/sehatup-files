const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-final-cta.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };
const S = '#hfc-{{ section.id }}';

// Same row width as the doctors / kits / reviews sections.
rep(`position: relative; overflow: hidden; max-width: 1160px; margin: 0 auto; padding: 84px 32px;`,
    `position: relative; overflow: hidden; max-width: 1272px; margin: 0 auto; padding: 96px 40px;`);
rep(`margin: 0 auto 14px; max-width: 760px; font: 800 clamp(30px, 4vw, 56px)/1.05`, `margin: 0 auto 16px; max-width: 860px; font: 800 clamp(30px, 4vw, 58px)/1.05`);
rep(`${S} .hfc__sub { position: relative; margin: 0 auto; max-width: 520px; font: 400 17px/1.55`, `${S} .hfc__sub { position: relative; margin: 0 auto; max-width: 560px; font: 400 18px/1.55`);
rep(`gap: 12px; min-width: 200px; justify-content: center;
    padding: 17px 28px; border-radius: 999px; font: 700 16px/1`, `gap: 12px; min-width: 220px; justify-content: center;
    padding: 19px 30px; border-radius: 999px; font: 700 17px/1`);
rep(`${S} .hfc__note { position: relative; margin: 22px 0 0; font: 500 13px/1.4`, `${S} .hfc__note { position: relative; margin: 24px 0 0; font: 500 14px/1.4`);

rep(`  @media (max-width: 749.98px) {
    ${S} { padding: 8px 16px 56px; }`,
`  @media (min-width: 750px) and (max-width: 1099.98px) {
    ${S} .hfc__inner { padding: 80px 6%; }
    ${S} .hfc__heading { font-size: 42px; }
    ${S} .hfc__sub { font-size: 17px; }
  }
  @media (max-width: 749.98px) {
    ${S} { padding: 8px 16px 56px; }`);
rep(`    ${S} .hfc__btn { min-width: 0; }`, `    ${S} .hfc__btn { min-width: 0; padding: 18px 24px; font-size: 16px; }\n    ${S} .hfc__note { font-size: 13px; }`);
rep(`  @media (min-width: 3840px) { ${S} .hfc__inner { zoom: 2.4; } }`,
`  @media (min-width: 3840px) { ${S} .hfc__inner { zoom: 2.4; } }
  /* ...and a little wider at each step, like the rows above. */
  @media (min-width: 1920px) { ${S} .hfc__inner { max-width: 1312px; } }
  @media (min-width: 2560px) { ${S} .hfc__inner { max-width: 1392px; } }`);
fs.writeFileSync(p, t);
console.log('ok');
