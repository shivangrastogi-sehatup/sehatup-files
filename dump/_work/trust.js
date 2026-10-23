const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-trust.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };
const S = '#htr-{{ section.id }}';

// Width and type scale like the doctors / kits sections.
rep(`${S} .htr__inner { max-width: 1160px; margin: 0 auto; padding: 48px 24px 72px; }
  ${S} .htr__head { text-align: center; max-width: 640px; margin: 0 auto 36px; }`,
`${S} .htr__inner { max-width: 1320px; margin: 0 auto; padding: 64px 24px 80px; }
  ${S} .htr__head { text-align: center; max-width: 1100px; margin: 0 auto 40px; }`);
rep(`font: 800 clamp(28px, 3.4vw, 46px)/1.08 'Montserrat', sans-serif;`, `font: 800 clamp(30px, 3.6vw, 52px)/1.06 'Montserrat', sans-serif;`);
rep(`${S} .htr__sub { margin: 0; font: 400 16px/1.55`, `${S} .htr__sub { margin: 0 auto; max-width: min(620px, 43vw); font: 400 17px/1.6`);
rep(`${S} .htr__txt b { font: 700 15px/1.2`, `${S} .htr__txt b { font: 700 16px/1.25`);
rep(`${S} .htr__txt small { font: 400 12.5px/1.35`, `${S} .htr__txt small { font: 400 13.5px/1.4`);
rep(`    list-style: none; margin: 0 0 48px; padding: 22px 26px;`, `    list-style: none; margin: 0 0 48px; padding: 24px 28px;`);

// Rating: stars + score, then the trust line. One pill on wider screens.
rep(`  ${S} .htr__rating {
    display: inline-flex; align-items: center; gap: 8px; margin: 16px 0 0; padding: 8px 16px; border-radius: 999px;
    background: #faf7f5; font: 600 14px/1 'Montserrat', sans-serif; color: var(--htr-text);
  }`,
`  ${S} .htr__rating {
    display: inline-flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px 8px; margin: 18px 0 0; padding: 10px 18px; border-radius: 999px;
    background: #faf7f5; font: 600 15px/1.2 'Montserrat', sans-serif; color: var(--htr-text);
  }
  ${S} .htr__rating b { font-weight: 800; }
  ${S} .htr__rating span::before { content: "\\00B7"; margin-right: 8px; color: var(--htr-muted); }`);

// Review cards: a step up in size.
rep(`    height: 264px; padding: 24px 34px 22px;`, `    height: 284px; padding: 26px 36px 24px;`);
rep(`margin-bottom: 6px; font: 700 16px/1.35 'Montserrat', sans-serif !important;`, `margin-bottom: 6px; font: 700 17px/1.35 'Montserrat', sans-serif !important;`);
rep(`{ margin: 0; font: 400 14px/1.55 'Montserrat', sans-serif !important; color: var(--htr-muted); }`, `{ margin: 0; font: 400 15px/1.55 'Montserrat', sans-serif !important; color: var(--htr-muted); }`);
rep(`${S} .htr__reviews .jdgm-carousel-item__reviewer-name { flex: none; font: 700 13px/1.3`, `${S} .htr__reviews .jdgm-carousel-item__reviewer-name { flex: none; font: 700 14px/1.3`);
rep(`${S} .htr__reviews .jdgm-carousel-item__product-title { font: 600 12.5px/1.3`, `${S} .htr__reviews .jdgm-carousel-item__product-title { font: 600 13px/1.3`);

// Tablets.
rep(`  @media (max-width: 1023.98px) {
    ${S} .htr__strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }`,
`  @media (max-width: 1023.98px) {
    ${S} .htr__strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (min-width: 750px) and (max-width: 1099.98px) {
    ${S} .htr__heading { font-size: 38px; }
    ${S} .htr__sub { font-size: 16px; max-width: min(520px, 50vw); }
  }`);

// Phones.
rep(`    ${S} .htr__heading { font-size: 28px; }
    ${S} .htr__sub { font-size: 14.5px; }`,
`    ${S} .htr__heading { font-size: 30px; }
    ${S} .htr__sub { font-size: 15px; max-width: none; }
    /* No pill: stars and score on one line, the trust line under it. */
    ${S} .htr__rating { display: flex; padding: 0; background: none; gap: 4px 8px; margin-top: 16px; font-size: 15px; }
    ${S} .htr__rating i { font-size: 16px; }
    ${S} .htr__rating span { flex-basis: 100%; font: 500 14px/1.4 'Montserrat', sans-serif; color: var(--htr-muted); }
    ${S} .htr__rating span::before { content: none; }`);
rep(`    ${S} .htr__txt small { font-size: 11.5px; }
  }`,
`    ${S} .htr__txt small { font-size: 12.5px; }
    ${S} .htr__txt b { font-size: 14px; }
  }
  /* Narrow phones: one promise per row, so nothing is squeezed. */
  @media (max-width: 419.98px) {
    ${S} .htr__strip { grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 18px; }
    ${S} .htr__item { align-items: center; gap: 14px; }
  }`);
rep(`  @media (min-width: 3840px) { ${S} .htr__inner { zoom: 2.4; } }`,
`  @media (min-width: 3840px) { ${S} .htr__inner { zoom: 2.4; } }
  /* ...and a little wider at each step, like the doctors and kits rows. */
  @media (min-width: 1920px) { ${S} .htr__inner { max-width: 1360px; } }
  @media (min-width: 2560px) { ${S} .htr__inner { max-width: 1440px; } }`);

// Script: split "4.5 · Trusted by 25,000+ patients" into score and trust line.
rep(`        out.textContent = line.replace('[rating]', score ? score.toFixed(1) : '').replace('[count]', count || '');
        if (needR) out.insertAdjacentHTML('afterbegin', '<i>★★★★★</i>');`,
`        var parts = line.replace('[rating]', score ? score.toFixed(1) : '').replace('[count]', count || '').split(' · ');
        out.textContent = '';
        if (needR) out.insertAdjacentHTML('beforeend', '<i aria-hidden="true">★★★★★</i>');
        var b = document.createElement('b'); b.textContent = parts.shift(); out.appendChild(b);
        if (parts.length) { var sp = document.createElement('span'); sp.textContent = parts.join(' · '); out.appendChild(sp); }`);
fs.writeFileSync(p, t);
console.log('ok');
