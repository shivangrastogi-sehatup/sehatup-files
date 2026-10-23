// lm-hero (live version): new "card" layout = heading on top, photo + card
// (buttons, privacy line, trust, live Judge.me reviews) below. The two existing
// layouts render exactly as before.
const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/dump/_work/livelp/sections/lm-hero.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };

rep(`  assign box = false
  if s.layout == 'box'
    assign box = true
  endif
-%}`,
`  assign box = false
  if s.layout == 'box'
    assign box = true
  endif
  assign card = false
  if s.layout == 'card'
    assign card = true
  endif
-%}`);

rep(`<section class="lm-hero{% if s.glow %} lm-hero--glow{% endif %}{% if box %} lm-hero--box lm-hero--img-{{ s.image_side | default: 'left' }}{% endif %}"`,
`{%- if card -%}
<style>
  /* Card layout: heading on top, photo + card below. */
  .lm-hero--card .lm-hero__top { text-align: center; padding-top: clamp(36px, 4.5vw, 72px); }
  .lm-hero__ticks { list-style: none; display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 24px; margin: 0 0 18px; padding: 0; font: 600 15px/1.3 var(--lm-font); color: var(--lm-mute); }
  .lm-hero__ticks li { display: inline-flex; align-items: center; gap: 8px; }
  .lm-hero__ticks i { width: 20px; height: 20px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--lm-tick, #2e9e5b); }
  .lm-hero__ticks svg { width: 12px; height: 12px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .lm-hero--card .lm-hero__h { margin: 0 auto; max-width: 16em; }
  .lm-hero--card .lm-hero__sub { margin: 16px auto 0; }
  .lm-hero--card .lm-hero__in { align-items: stretch; padding-top: clamp(28px, 3.5vw, 52px); }
  .lm-hero--card .lm-hero__bg { aspect-ratio: auto; min-height: 440px; }
  .lm-hero__card { max-width: none; display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: clamp(24px, 3vw, 40px); border-radius: 28px; background: #fff; border: 1px solid var(--lm-line); box-shadow: 0 30px 60px -42px rgba(60, 30, 20, .4); }
  .lm-hero__card-h { margin: 0; font: 800 clamp(22px, 1.9vw, 28px)/1.2 var(--lm-font); letter-spacing: -.01em; color: var(--lm-ink); }
  .lm-hero__card-p { margin: 8px 0 0; font: 500 15px/1.55 var(--lm-font); color: var(--lm-mute); }
  .lm-hero--card .lm-hero__cta { flex-direction: column; margin-top: 24px; }
  .lm-hero--card .lm-hero__cta .lm-btn { width: 100%; justify-content: space-between; }
  .lm-hero--card .lm-hero__safe { align-self: flex-start; margin-top: 16px; }
  .lm-hero--card .lm-hero__proof { margin-top: 24px; padding-top: 22px; border-top: 1px solid var(--lm-line); }
  .lm-hero__revs { margin-top: 18px; min-width: 0; }
  .lm-hero__revs .jmr__card { flex-basis: 100%; min-height: 0; padding: 18px 18px 16px; }
  .lm-hero__revs .jmr__nav { justify-content: flex-start; margin-top: 12px; }
  .lm-hero__revs .jmr__arrow { width: 38px; height: 38px; }
  @media (max-width: 749.98px) {
    .lm-hero--card .lm-hero__top { padding-top: 28px; }
    .lm-hero__ticks { gap: 6px 16px; margin-bottom: 14px; font-size: 13.5px; }
    .lm-hero__ticks i { width: 18px; height: 18px; }
    .lm-hero--card .lm-hero__in { margin-top: 0; padding-top: 22px; }
    .lm-hero--card .lm-hero__bg { min-height: 0; }
    .lm-hero__card { padding: 22px 18px; border-radius: 22px; }
  }
</style>
<section class="lm-hero lm-hero--box lm-hero--card lm-hero--img-left{% if s.glow %} lm-hero--glow{% endif %}" style="{% if s.glow %}--lm-glow: {{ s.glow_color }}; {% endif %}--lm-tick: {{ s.tick_color | default: '#2e9e5b' }}; --lm-hw: {{ s.img_width }}%; --lm-hz: {{ s.img_zoom | divided_by: 100.0 }}; --lm-hy: {{ s.img_focus }}%; --lm-hm: {{ s.img_height_mobile }}px; --lm-hg: {{ s.gap }}px;">
  <div class="lm-wrap lm-hero__top">
    {%- assign ticks = s.ticks | newline_to_br | split: '<br />' -%}
    {%- if s.ticks != blank -%}
      <ul class="lm-hero__ticks">
        {%- for tk in ticks -%}{%- assign tk = tk | strip -%}{%- if tk != blank -%}<li><i aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7"/></svg></i>{{ tk }}</li>{%- endif -%}{%- endfor -%}
      </ul>
    {%- endif -%}
    <h1 class="lm-hero__h">{{ s.heading }}{% if s.highlight != blank %} <span class="lm-mark">{{ s.highlight }}</span>{% endif %}{% if s.heading_end != blank %} {{ s.heading_end }}{% endif %}</h1>
    {%- if s.subheading != blank -%}<p class="lm-hero__sub">{%- if s.sub_red != blank -%}{%- capture red -%}<span class="lm-mark">{{ s.sub_red }}</span>{%- endcapture -%}{{ s.subheading | replace_first: s.sub_red, red }}{%- else -%}{{ s.subheading }}{%- endif -%}</p>{%- endif -%}
  </div>
  <div class="lm-wrap lm-hero__in">
    {{ photo }}
    <div class="lm-hero__copy lm-hero__card">
      {%- if s.card_heading != blank -%}<h2 class="lm-hero__card-h">{{ s.card_heading }}</h2>{%- endif -%}
      {%- if s.card_text != blank -%}<p class="lm-hero__card-p">{{ s.card_text }}</p>{%- endif -%}
      <div class="lm-hero__cta">
        {%- if s.button_1 != blank -%}
          <a class="lm-btn lm-btn--red" href="{{ s.button_1_link | default: '#book' }}"><span>{{ s.button_1 }}{% if s.button_1_note != blank %}<small>{{ s.button_1_note }}</small>{% endif %}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg></a>
        {%- endif -%}
        {%- if s.button_2 != blank -%}
          <a class="lm-btn lm-btn--line" href="{{ s.button_2_link | default: '#' }}"><span>{{ s.button_2 }}{% if s.button_2_note != blank %}<small>{{ s.button_2_note }}</small>{% endif %}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg></a>
        {%- endif -%}
      </div>
      {%- if s.privacy != blank -%}
        <p class="lm-hero__safe"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>{{ s.privacy }}</p>
      {%- endif -%}
      {%- if s.trust_text != blank -%}
        <div class="lm-hero__proof">
          <span class="lm-hero__avs" aria-hidden="true">
            {%- assign avs = s.trust_initials | split: ',' -%}
            {%- for i in (1..3) -%}{%- assign ak = 'avatar_' | append: i -%}{%- assign letter = avs[forloop.index0] | strip | slice: 0 -%}{%- if s[ak] != blank -%}<i class="has-img">{{ s[ak] | image_url: width: 400, height: 400, crop: 'center' | image_tag: alt: '', loading: 'eager', width: 42, height: 42, widths: '120, 200, 300, 400', sizes: '42px' }}</i>{%- elsif letter != blank -%}<i>{{ letter }}</i>{%- endif -%}{%- endfor -%}
          </span>
          <span class="lm-hero__proof-t">
            <b>{{ s.trust_text }}</b>
            {%- if s.rating != blank -%}<span><i aria-hidden="true">★★★★★</i> ({{ s.rating }}/5)</span>{%- endif -%}
          </span>
        </div>
      {%- endif -%}
      {%- if s.review_products != blank -%}
        <div class="lm-hero__revs">{%- render 'sehat-jm-reviews', products: s.review_products, min: 4, max: 8, uid: section.id -%}</div>
      {%- endif -%}
    </div>
  </div>
</section>
{%- else -%}
<section class="lm-hero{% if s.glow %} lm-hero--glow{% endif %}{% if box %} lm-hero--box lm-hero--img-{{ s.image_side | default: 'left' }}{% endif %}"`);

rep(`    </ul>
  {%- endif -%}
</section>`, `    </ul>
  {%- endif -%}
</section>
{%- endif -%}`);

// schema
const m = t.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
const j = JSON.parse(m[1]);
const lay = j.settings.find(x => x.id === 'layout');
lay.options.push({ value: 'card', label: 'Heading on top, photo + card below' });
const after = (id, items) => { const i = j.settings.findIndex(x => x.id === id); if (i < 0) throw new Error('no ' + id); j.settings.splice(i + 1, 0, ...items); };
after('image', [
  { type: 'textarea', id: 'ticks', label: 'Ticked points above the heading (card layout)', info: 'One per line, e.g. Diet / Exercise / Weight Loss Pills.' },
  { type: 'color', id: 'tick_color', label: 'Tick colour', default: '#2e9e5b' },
  { type: 'text', id: 'card_heading', label: 'Card heading (card layout)' },
  { type: 'textarea', id: 'card_text', label: 'Card line (card layout)' },
]);
after('privacy', [
  { type: 'product_list', id: 'review_products', label: 'Reviews in the card (card layout)', limit: 8, info: 'Real Judge.me reviews (4 stars and up) of these products, one at a time. Empty hides them.' },
]);
t = t.replace(m[1], '\n' + JSON.stringify(j, null, 2) + '\n');
fs.writeFileSync(p, t);
console.log('ok');
