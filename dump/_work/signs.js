const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-signs.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };
const S = '#hsg-{{ section.id }}';

rep(`${S} .hsg__inner { max-width: 980px;`, `${S} .hsg__inner { max-width: 1100px;`);
// Same heading sizes as the journey section above.
rep(`font: 800 clamp(28px, 3.4vw, 46px)/1.08 'Montserrat', sans-serif;`, `font: 800 clamp(30px, 3.6vw, 52px)/1.06 'Montserrat', sans-serif;`);
rep(`${S} .hsg__sub { margin: 0 auto; max-width: 560px; font: 400 16px/1.55`, `${S} .hsg__sub { margin: 0 auto; max-width: 640px; font: 400 17px/1.55`);
rep(`    border-radius: 999px; background: #f7f3f0; text-align: left;`, `    border-radius: 18px; background: #f7f3f0; text-align: left;`);
rep(`font: 400 12.5px/1.5 'Montserrat', sans-serif; color: #6b6b6b; }`, `font: 400 13px/1.5 'Montserrat', sans-serif; color: #6b6b6b; }`);
rep(`    ${S} .hsg__heading { font-size: 28px; }
    ${S} .hsg__sub { font-size: 14.5px; }`,
`    ${S} .hsg__heading { font-size: 30px; }
    ${S} .hsg__sub { font-size: 15px; }`);
rep(`padding: 16px; border-radius: 20px; text-align: center; }`, `padding: 16px; border-radius: 18px; text-align: center; }`);
// Tablets: heading like the journey section's tablet heading.
rep(`  @media (max-width: 599.98px) {
    ${S} .hsg__chips {`,
`  @media (min-width: 750px) and (max-width: 1099.98px) {
    ${S} .hsg__inner { padding: 72px 6% 64px; }
    ${S} .hsg__heading { font-size: 38px; }
    ${S} .hsg__sub { font-size: 16px; }
  }
  @media (max-width: 599.98px) {
    ${S} .hsg__chips {`);
fs.writeFileSync(p, t);
console.log('ok');
