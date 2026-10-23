const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-kits.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };
const S = '#hkt-{{ section.id }}';

// Heading: centred, same sizes as the sections above. Cards row as wide as the doctors row.
rep(`${S} .hkt__inner { max-width: 1160px; margin: 0 auto; padding: 88px 24px 40px; }
  ${S} .hkt__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 36px; }
  ${S} .hkt__eyebrow { margin: 0 0 14px; font: 700 12px/1`,
`${S} .hkt__inner { max-width: 1320px; margin: 0 auto; padding: 88px 24px 56px; }
  ${S} .hkt__head { max-width: 1100px; margin: 0 auto 44px; text-align: center; }
  ${S} .hkt__eyebrow { margin: 0 0 16px; font: 700 13px/1`);
rep(`font: 800 clamp(28px, 3.4vw, 46px)/1.08 'Montserrat', sans-serif;`, `font: 800 clamp(30px, 3.6vw, 52px)/1.06 'Montserrat', sans-serif;`);
rep(`${S} .hkt__sub { margin: 0; max-width: 560px; font: 400 16px/1.55`, `${S} .hkt__sub { margin: 0 auto; max-width: min(620px, 43vw); font: 400 17px/1.6`);
rep(`${S} .hkt__all { flex: none; display: inline-flex; gap: 8px; align-items: center; font: 700 15px/1`,
`${S} .hkt__more { margin: 32px 0 0; text-align: center; }
  ${S} .hkt__all { display: inline-flex; gap: 8px; align-items: center; font: 700 16px/1`);

// Arrows on the cards' left and right edges, level with the middle of the photos.
rep(`  ${S} .hkt__tools { display: flex; align-items: center; gap: 18px; flex: none; }
  ${S} .hkt__nav { display: flex; gap: 8px; }
  ${S} .hkt__arrow {
    width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid #e2dbd5; background: #fff; color: var(--hkt-text);
    display: grid; place-items: center; cursor: pointer; transition: border-color .2s ease, opacity .2s ease;
  }
  ${S} .hkt__arrow svg { width: 16px; height: 16px; }
  ${S} .hkt__arrow:disabled { opacity: .35; cursor: default; }`,
`  ${S} .hkt__track { position: relative; container-type: inline-size; }
  ${S} .hkt__arrow {
    --mid: calc((100cqw - 44px) / 6 + 12px); /* half a photo (photos are square, 3 cards a row) */
    position: absolute; z-index: 3; top: var(--mid); margin-top: -26px;
    width: 52px; height: 52px; border-radius: 50%; border: 0; background: #fff; color: var(--hkt-text);
    display: grid; place-items: center; cursor: pointer;
    box-shadow: 0 6px 18px rgba(29, 29, 29, .16);
    transition: color .2s ease, background-color .2s ease, box-shadow .2s ease;
  }
  ${S} .hkt__arrow[data-dir="-1"] { left: -26px; }
  ${S} .hkt__arrow[data-dir="1"] { right: -26px; }
  ${S} .hkt__arrow svg { width: 20px; height: 20px; }
  /* At the start or the end of the row the arrow goes pale: nothing more that way. */
  ${S} .hkt__arrow:disabled { cursor: default; background: #f4f1ee; color: #c9c2bc; box-shadow: none; }`);
rep(`  @media (hover: hover) { ${S} .hkt__arrow:not(:disabled):hover { border-color: var(--hkt-text); } }`,
`  @media (hover: hover) { ${S} .hkt__arrow:not(:disabled):hover { background: var(--hkt-text); color: #fff; } }`);
rep(`    ${S} .hkt__row--scroll .hkt__card { flex-basis: calc((100% - 22px) / 2.2); }
  }`,
`    ${S} .hkt__row--scroll .hkt__card { flex-basis: calc((100% - 22px) / 2.2); }
    ${S} .hkt__arrow { --mid: calc((100cqw - 22px) / 4.4 + 12px); }
    ${S} .hkt__arrow[data-dir="-1"] { left: -14px; }
    ${S} .hkt__arrow[data-dir="1"] { right: -14px; }
    ${S} .hkt__heading { font-size: 38px; }
    ${S} .hkt__sub { font-size: 16px; max-width: min(520px, 50vw); }
  }`);
// Phones: swipe, no arrows (as before).
rep(`    ${S} .hkt__nav { display: none; }`, `    ${S} .hkt__arrow { display: none; }`);

rep(`    ${S} .hkt__head { flex-direction: column; align-items: flex-start; padding: 0 16px; margin-bottom: 24px; gap: 16px; }
    ${S} .hkt__heading { font-size: 28px; }
    ${S} .hkt__sub { font-size: 14.5px; max-width: none; }`,
`    ${S} .hkt__head { padding: 0 16px; margin-bottom: 26px; }
    ${S} .hkt__heading { font-size: 30px; }
    ${S} .hkt__sub { font-size: 15px; max-width: none; }
    ${S} .hkt__more { margin-top: 16px; padding: 0 16px; }`);
rep(`  @media (min-width: 3840px) { ${S} .hkt__inner { zoom: 2.4; } }`,
`  @media (min-width: 3840px) { ${S} .hkt__inner { zoom: 2.4; } }
  /* ...and the row gets a little wider at each step, like the doctors row. */
  @media (min-width: 1920px) { ${S} .hkt__inner { max-width: 1360px; } }
  @media (min-width: 2560px) { ${S} .hkt__inner { max-width: 1440px; } }`);
// Card text a step up, like the doctor cards.
rep(`${S} .hkt__title { margin: 0; font: 700 17px/1.3`, `${S} .hkt__title { margin: 0; font: 700 19px/1.3`);
rep(`${S} .hkt__price b { font: 800 20px/1`, `${S} .hkt__price b { font: 800 22px/1`);
rep(`${S} .hkt__body { padding: 20px 22px 24px;`, `${S} .hkt__body { padding: 22px 24px 26px;`);
rep(`font: 700 14.5px/1 'Montserrat', sans-serif; color: var(--hkt-ink); }\n  ${S} .hkt__cta span`, `font: 700 15px/1 'Montserrat', sans-serif; color: var(--hkt-ink); }\n  ${S} .hkt__cta span`);

// Markup: head is text only; arrows sit with the row; "See all combos" below the cards.
rep(`    <div class="hkt__head">
      <div>
        {%- if s.eyebrow != blank -%}<p class="hkt__eyebrow">{{ s.eyebrow }}</p>{%- endif -%}
        <h2 class="hkt__heading">{{ s.heading }}</h2>
        {%- if s.subheading != blank -%}<p class="hkt__sub">{{ s.subheading }}</p>{%- endif -%}
      </div>
      <div class="hkt__tools">
        {%- if s.all_link != blank and s.all_label != blank -%}
          <a class="hkt__all" href="{{ s.all_link }}">{{ s.all_label }}<span aria-hidden="true">&rarr;</span></a>
        {%- endif -%}
        {%- if split -%}
          <div class="hkt__nav">
            <button type="button" class="hkt__arrow" data-dir="-1" aria-label="Previous kits"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg></button>
            <button type="button" class="hkt__arrow" data-dir="1" aria-label="More kits"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></button>
          </div>
        {%- endif -%}
      </div>
    </div>

    <div class="hkt__row`,
`    <div class="hkt__head">
      {%- if s.eyebrow != blank -%}<p class="hkt__eyebrow">{{ s.eyebrow }}</p>{%- endif -%}
      <h2 class="hkt__heading">{{ s.heading }}</h2>
      {%- if s.subheading != blank -%}<p class="hkt__sub">{{ s.subheading }}</p>{%- endif -%}
    </div>

    <div class="hkt__track">
    {%- if split -%}
      <button type="button" class="hkt__arrow" data-dir="-1" aria-label="Previous kits"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg></button>
      <button type="button" class="hkt__arrow" data-dir="1" aria-label="More kits"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></button>
    {%- endif -%}
    <div class="hkt__row`);
rep(`      {%- endfor -%}
      {%- endfor -%}
    </div>`,
`      {%- endfor -%}
      {%- endfor -%}
    </div>
    </div>
    {%- if s.all_link != blank and s.all_label != blank -%}
      <p class="hkt__more"><a class="hkt__all" href="{{ s.all_link }}">{{ s.all_label }}<span aria-hidden="true">&rarr;</span></a></p>
    {%- endif -%}`);
rep(`                   srcset="{{ product.featured_image | image_url: width: 360 }} 360w, {{ product.featured_image | image_url: width: 600 }} 600w"
                   sizes="(max-width: 749.98px) 80vw, 340px"`,
`                   srcset="{{ product.featured_image | image_url: width: 360 }} 360w, {{ product.featured_image | image_url: width: 600 }} 600w, {{ product.featured_image | image_url: width: 900 }} 900w, {{ product.featured_image | image_url: width: 1300 }} 1300w"
                   sizes="(max-width: 749.98px) 76vw, (max-width: 1099.98px) 42vw, 30vw"`);
fs.writeFileSync(p, t);

// Template: clear the small note (the setting stays in the editor).
const tp = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/templates/page.healthscore 360.json';
let tt = fs.readFileSync(tp, 'utf8');
const a = '"note": "Pay just ₹50 to confirm and the rest on delivery, or pay in full online."';
const n = tt.split(a).length - 1; if (n !== 1) throw new Error('template note x' + n);
tt = tt.replace(a, '"note": ""');
fs.writeFileSync(tp, tt);
console.log('ok');
