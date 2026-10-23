const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-doctors.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };
const S = '#hdr-{{ section.id }}';

// Same width as the quiz cards; same type scale as the sections above.
rep(`${S} .hdr__inner { max-width: 1160px;`, `${S} .hdr__inner { max-width: 1320px;`);
rep(`${S} .hdr__eyebrow { margin: 0 0 14px; font: 700 12px/1`, `${S} .hdr__eyebrow { margin: 0 0 16px; font: 700 13px/1`);
rep(`font: 800 clamp(28px, 3.4vw, 46px)/1.08 'Montserrat', sans-serif;`, `font: 800 clamp(30px, 3.6vw, 52px)/1.06 'Montserrat', sans-serif;`);
rep(`${S} .hdr__sub { margin: 0 auto; max-width: 600px; font: 400 16px/1.6`, `${S} .hdr__sub { margin: 0 auto; max-width: 640px; font: 400 17px/1.6`);
rep(`${S} .hdr__row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }`, `${S} .hdr__row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; }`);
// The wider cards would make square photos very tall: a little wider than tall.
rep(`    position: relative; aspect-ratio: 1 / 1; background: var(--hdr-stone);`, `    position: relative; aspect-ratio: 6 / 5; background: var(--hdr-stone);`);
rep(`${S} .hdr__body { padding: 22px 24px 26px; display: grid; gap: 6px; }`, `${S} .hdr__body { padding: 24px 28px 30px; display: grid; gap: 8px; }`);
rep(`${S} .hdr__name { margin: 0; font: 700 21px/1.2`, `${S} .hdr__name { margin: 0; font: 700 23px/1.2`);
rep(`${S} .hdr__degree { margin: 0; font: 600 13px/1.4`, `${S} .hdr__degree { margin: 0; font: 600 14.5px/1.45`);
rep(`${S} .hdr__role { margin: 8px 0 0; padding-top: 12px; border-top: 1px solid #eee6e0; font: 400 15px/1.5`, `${S} .hdr__role { margin: 8px 0 0; padding-top: 14px; border-top: 1px solid #eee6e0; font: 400 16px/1.55`);
rep(`font: 700 15.5px/1 'Montserrat', sans-serif; text-decoration: none; box-shadow`, `font: 700 16px/1 'Montserrat', sans-serif; text-decoration: none; box-shadow`);
rep(`font: 500 14.5px/1.5 'Montserrat', sans-serif; color: var(--hdr-muted); }`, `font: 500 15px/1.5 'Montserrat', sans-serif; color: var(--hdr-muted); }`);

// Phones: same heading sizes as the sections above.
rep(`    ${S} .hdr__heading { font-size: 28px; }
    ${S} .hdr__sub { font-size: 14.5px; }`,
`    ${S} .hdr__heading { font-size: 30px; }
    ${S} .hdr__sub { font-size: 15px; }
    ${S} .hdr__degree { font-size: 13.5px; }
    ${S} .hdr__body { padding: 20px 20px 24px; }`);

// Tablets: three cards in a row are too narrow, so a swipe row (two cards and a bit).
rep(`  @media (prefers-reduced-motion: reduce) { ${S} .hdr__card { transition: none; } }`,
`  @media (min-width: 750px) and (max-width: 1099.98px) {
    ${S} .hdr__inner { padding-left: 0; padding-right: 0; }
    ${S} .hdr__head { padding: 0 6%; margin-bottom: 36px; }
    ${S} .hdr__heading { font-size: 38px; }
    ${S} .hdr__sub { font-size: 16px; }
    ${S} .hdr__row {
      display: flex; gap: 20px; overflow-x: auto; padding: 4px 6% 22px;
      scroll-snap-type: x mandatory; scroll-padding: 0 6%; scrollbar-width: none;
    }
    ${S} .hdr__row::-webkit-scrollbar { display: none; }
    ${S} .hdr__card { flex: 0 0 calc((88% - 20px) / 2.15); scroll-snap-align: start; }
    ${S} .hdr__name { font-size: 21px; }
    ${S} .hdr__cta { margin-top: 24px; }
  }
  @media (prefers-reduced-motion: reduce) { ${S} .hdr__card { transition: none; } }`);
fs.writeFileSync(p, t);
console.log('ok');
