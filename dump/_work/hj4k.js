const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-journey.liquid';
let t = fs.readFileSync(p, 'utf8');
const a = t.indexOf('  /* Big screens: everything grows with the screen');
const b = t.indexOf('  /* Phones and tablets: the section heading centred. */');
if (a < 0 || b < a) throw new Error('anchors');
const S = '#hj-{{ section.id }}';
t = t.slice(0, a) + `  /* Big screens (QHD, 4K): same width (92%) and the same growth steps as the
     quizzes section above. Sizes are the laptop sizes times --k (no zoom: the
     sticky phone and the step triggers measure real pixels). */
  @media (min-width: 1680px) { ${S} { --k: 1.12; } }
  @media (min-width: 1920px) { ${S} { --k: 1.25; } }
  @media (min-width: 2240px) { ${S} { --k: 1.45; } }
  @media (min-width: 2560px) { ${S} { --k: 1.65; } }
  @media (min-width: 3200px) { ${S} { --k: 2; } }
  @media (min-width: 3840px) { ${S} { --k: 2.4; } }
  @media (min-width: 1680px) {
    ${S} { --ph: min(calc(600px * var(--k)), 72vh); }
    ${S} .hj__inner { max-width: 92vw; padding-left: 0; padding-right: 0; }
    ${S}.is-live .hj__inner { grid-template-columns: minmax(0, calc(620px * var(--k))) auto; padding-top: calc(96px * var(--k)); }
    ${S} .hj__eyebrow { font-size: calc(12px * var(--k)); margin-bottom: calc(18px * var(--k)); }
    ${S} .hj__heading { font-size: calc(52px * var(--k)); margin-bottom: calc(36px * var(--k)); max-width: calc(620px * var(--k)); }
    ${S} .hj__n { font-size: calc(44px * var(--k)); margin-bottom: calc(10px * var(--k)); }
    ${S} .hj__day { font-size: calc(13px * var(--k)); margin-bottom: calc(6px * var(--k)); }
    ${S}.is-live .hj__title { font-size: calc(44px * var(--k)); margin-bottom: calc(8px * var(--k)); }
    ${S}.is-live .hj__text { font-size: calc(17px * var(--k)); max-width: calc(500px * var(--k)); }
    ${S}.is-live .hj__chip { padding: calc(14px * var(--k)) calc(18px * var(--k)) calc(14px * var(--k)) calc(16px * var(--k)); border-radius: calc(16px * var(--k)); gap: calc(4px * var(--k)); }
    ${S} .hj__chip-k { font-size: calc(11px * var(--k)); }
    ${S} .hj__chip-n { font-size: calc(34px * var(--k)); }
    ${S} .hj__chip-s { font-size: calc(12px * var(--k)); }
  }

` + t.slice(b);
fs.writeFileSync(p, t);
console.log('ok');
