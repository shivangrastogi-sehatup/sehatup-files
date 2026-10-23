const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-faq.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };
const S = '#hfq-{{ section.id }}';

// One column: centred head (like the other sections), questions below.
rep(`  ${S} .hfq__inner {
    max-width: 1160px; margin: 0 auto; padding: 88px 24px;
    display: grid; grid-template-columns: minmax(0, 380px) minmax(0, 1fr); gap: 64px; align-items: start;
  }
  ${S} .hfq__side { position: sticky; top: 110px; }`,
`  ${S} .hfq__inner { max-width: 1320px; margin: 0 auto; padding: 88px 24px; }
  ${S} .hfq__side { max-width: 1100px; margin: 0 auto 44px; text-align: center; }`);
rep(`font: 800 clamp(28px, 3.2vw, 44px)/1.08 'Montserrat', sans-serif;`, `font: 800 clamp(30px, 3.6vw, 52px)/1.06 'Montserrat', sans-serif;`);
rep(`${S} .hfq__sub { margin: 0; font: 400 16px/1.55`, `${S} .hfq__sub { margin: 0 auto; max-width: min(620px, 43vw); font: 400 17px/1.6`);
rep(`display: inline-flex; align-items: center; gap: 10px; margin-top: 24px; padding: 13px 20px; border-radius: 999px;
    border: 1.5px solid var(--hfq-text); color: var(--hfq-text); text-decoration: none; font: 700 14.5px/1`,
`display: inline-flex; align-items: center; gap: 10px; margin-top: 26px; padding: 15px 24px; border-radius: 999px;
    border: 1.5px solid var(--hfq-text); color: var(--hfq-text); text-decoration: none; font: 700 15.5px/1`);

// Shop links: look like links (red, underlined, arrow), same style as "See all combos".
rep(`  ${S} .hfq__shop { margin: 22px 0 0; display: flex; flex-wrap: wrap; gap: 8px; }
  ${S} .hfq__shop a {
    padding: 9px 14px; border-radius: 999px; background: #fff; text-decoration: none;
    font: 700 13px/1 'Montserrat', sans-serif; color: var(--hfq-text); box-shadow: 0 1px 4px rgba(29,29,29,.08);
  }
  @media (hover: hover) { ${S} .hfq__shop a:hover { color: var(--hfq-accent); } }`,
`  ${S} .hfq__shop { margin: 24px 0 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 14px 28px; }
  ${S} .hfq__shop a {
    display: inline-flex; align-items: center; gap: 8px; padding-bottom: 5px; border-bottom: 2px solid currentColor;
    text-decoration: none; font: 700 15px/1 'Montserrat', sans-serif; color: var(--hfq-accent);
  }
  ${S} .hfq__shop a::after { content: "\\2192"; transition: transform .2s ease; }
  @media (hover: hover) { ${S} .hfq__shop a:hover::after { transform: translateX(3px); } }
  ${S} .hfq__shop a:focus-visible { outline: 2px solid var(--hfq-text); outline-offset: 3px; }`);

// Questions: centred list, a step bigger.
rep(`  ${S} .hfq__list { border-top: 1px solid #e6dfd9; }`, `  ${S} .hfq__list { max-width: 900px; margin: 0 auto; border-top: 1px solid #e6dfd9; }`);
rep(`    padding: 22px 4px; font: 700 17px/1.35`, `    padding: 24px 4px; font: 700 18.5px/1.35`);
rep(`${S} .hfq__plus { position: relative; flex: none; width: 28px; height: 28px;`, `${S} .hfq__plus { position: relative; flex: none; width: 32px; height: 32px;`);
rep(`${S} .hfq__a { padding: 0 52px 24px 4px; font: 400 15.5px/1.65`, `${S} .hfq__a { padding: 0 56px 26px 4px; font: 400 16.5px/1.65`);

// Tablets and phones.
rep(`  @media (max-width: 749.98px) {
    ${S} .hfq__inner { grid-template-columns: 1fr; gap: 24px; padding: 56px 16px; }
    ${S} .hfq__side { position: static; }
    ${S} .hfq__heading { font-size: 28px; }
    ${S} .hfq__sub { font-size: 14.5px; }`,
`  @media (min-width: 750px) and (max-width: 1099.98px) {
    ${S} .hfq__inner { padding: 72px 6%; }
    ${S} .hfq__heading { font-size: 38px; }
    ${S} .hfq__sub { font-size: 16px; max-width: min(520px, 50vw); }
  }
  @media (max-width: 749.98px) {
    ${S} .hfq__inner { padding: 56px 16px; }
    ${S} .hfq__side { margin-bottom: 28px; }
    ${S} .hfq__heading { font-size: 30px; }
    ${S} .hfq__sub { font-size: 15px; max-width: none; }
    ${S} .hfq__contact { margin-top: 22px; padding: 14px 22px; font-size: 15px; }
    ${S} .hfq__shop { gap: 14px 22px; margin-top: 22px; }
    ${S} .hfq__shop a { font-size: 14.5px; }`);
rep(`    ${S} .hfq__q { padding: 18px 2px; font-size: 15.5px; }
    ${S} .hfq__a { padding: 0 8px 20px 2px; font-size: 14.5px; }`,
`    ${S} .hfq__q { padding: 18px 2px; font-size: 16px; }
    ${S} .hfq__plus { width: 28px; height: 28px; }
    ${S} .hfq__a { padding: 0 8px 20px 2px; font-size: 15px; }`);
fs.writeFileSync(p, t);
console.log('ok');
