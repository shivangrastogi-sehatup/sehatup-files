const fs = require('fs'), p = 'D:/firebase/sehatupfirebase-main/shopify-theme/live/sections/health-kits.liquid';
let t = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { const c = t.split(a).length - 1; if (c !== 1) throw new Error('anchor x' + c + ': ' + a.slice(0, 70)); t = t.replace(a, b); };

rep(`  the copy makes clear the doctor recommends the kit first.`,
`  the copy makes clear the doctor recommends the kit first.
  With "Kits for her" / "Kits for him" set, all kits sit in one swipeable row
  and the row follows the For Her / For Him switch above (hs360:who): the
  chosen side comes first, the other side after it.`);

rep(`{%- liquid
  assign s = section.settings
-%}`, `{%- liquid
  assign s = section.settings
  assign split = false
  if s.her_products != blank or s.him_products != blank
    assign split = true
  endif
-%}`);

rep(`  #hkt-{{ section.id }} .hkt__row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }`,
`  #hkt-{{ section.id }} .hkt__row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
  #hkt-{{ section.id }} .hkt__row--scroll {
    display: flex; gap: 22px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
    margin: -12px -12px 0; padding: 12px 12px 22px; transition: opacity .25s ease;
  }
  #hkt-{{ section.id }} .hkt__row--scroll::-webkit-scrollbar { display: none; }
  #hkt-{{ section.id }} .hkt__row--scroll .hkt__card { flex: 0 0 calc((100% - 44px) / 3); scroll-snap-align: start; }
  #hkt-{{ section.id }} .hkt__row--scroll.is-swap { opacity: 0; }
  #hkt-{{ section.id }} .hkt__row--scroll .hkt__badge { display: none; }
  #hkt-{{ section.id }} .hkt__row--scroll .hkt__card[data-top] .hkt__badge { display: inline-block; }
  #hkt-{{ section.id }} .hkt__tools { display: flex; align-items: center; gap: 18px; flex: none; }
  #hkt-{{ section.id }} .hkt__nav { display: flex; gap: 8px; }
  #hkt-{{ section.id }} .hkt__arrow {
    width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid #e2dbd5; background: #fff; color: var(--hkt-text);
    display: grid; place-items: center; cursor: pointer; transition: border-color .2s ease, opacity .2s ease;
  }
  #hkt-{{ section.id }} .hkt__arrow svg { width: 16px; height: 16px; }
  #hkt-{{ section.id }} .hkt__arrow:disabled { opacity: .35; cursor: default; }
  @media (hover: hover) { #hkt-{{ section.id }} .hkt__arrow:not(:disabled):hover { border-color: var(--hkt-text); } }
  #hkt-{{ section.id }} .hkt__arrow:focus-visible { outline: 2px solid var(--hkt-text); outline-offset: 2px; }
  @media (min-width: 750px) and (max-width: 1099px) {
    #hkt-{{ section.id }} .hkt__row--scroll .hkt__card { flex-basis: calc((100% - 22px) / 2.2); }
  }
  /* Phones: swipe (the next card peeks in), no arrows. */
  @media (max-width: 749px) {
    #hkt-{{ section.id }} .hkt__row--scroll { margin: 0; gap: 12px; padding: 4px 16px 18px; scroll-padding: 0 16px; }
    #hkt-{{ section.id }} .hkt__row--scroll .hkt__card { flex-basis: 76%; }
    #hkt-{{ section.id }} .hkt__nav { display: none; }
  }`);

rep(`      {%- if s.all_link != blank and s.all_label != blank -%}
        <a class="hkt__all" href="{{ s.all_link }}">{{ s.all_label }}<span aria-hidden="true">&rarr;</span></a>
      {%- endif -%}
    </div>`,
`      <div class="hkt__tools">
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
    </div>`);

rep(`    <div class="hkt__row">
      {%- for product in s.products -%}
        {%- liquid
          assign probe = product.title | append: ' ' | append: product.handle | downcase
          assign her = false
          if probe contains 'female' or probe contains 'women' or probe contains 'her ' or probe contains 'period' or probe contains 'menses' or probe contains 'hormon'
            assign her = true
          endif`,
`    <div class="hkt__row{% if split %} hkt__row--scroll{% endif %}" data-hkt-row>
      {%- if split -%}{%- assign groups = 'her,him' | split: ',' -%}{%- else -%}{%- assign groups = 'all' | split: ',' -%}{%- endif -%}
      {%- for g in groups -%}
      {%- liquid
        if g == 'her'
          assign list = s.her_products
        elsif g == 'him'
          assign list = s.him_products
        else
          assign list = s.products
        endif
      -%}
      {%- for product in list -%}
        {%- liquid
          if g == 'her'
            assign her = true
          elsif g == 'him'
            assign her = false
          else
            assign probe = product.title | append: ' ' | append: product.handle | downcase
            assign her = false
            if probe contains 'female' or probe contains 'women' or probe contains 'her ' or probe contains 'period' or probe contains 'menses' or probe contains 'hormon'
              assign her = true
            endif
          endif`);

rep(`        <a class="hkt__card {% if her %}hkt__card--her{% else %}hkt__card--him{% endif %}" href="{{ product.url }}">`,
`        <a class="hkt__card {% if her %}hkt__card--her{% else %}hkt__card--him{% endif %}" href="{{ product.url }}" data-who="{% if her %}her{% else %}him{% endif %}"{% if split and g == 'her' and forloop.first %} data-top{% endif %}>`);

rep(`            {%- if forloop.first and s.first_badge != blank -%}<span class="hkt__badge">{{ s.first_badge }}</span>{%- endif -%}`,
`            {%- if s.first_badge != blank -%}{%- if split or forloop.first -%}<span class="hkt__badge">{{ s.first_badge }}</span>{%- endif -%}{%- endif -%}`);

rep(`        </a>
      {%- endfor -%}
    </div>`, `        </a>
      {%- endfor -%}
      {%- endfor -%}
    </div>`);

rep(`\n\n{% schema %}`, `
{%- if split -%}
<script>
  (function () {
    var root = document.getElementById('hkt-{{ section.id }}');
    if (!root) return;
    var row = root.querySelector('[data-hkt-row]');
    var prev = root.querySelector('.hkt__arrow[data-dir="-1"]'), next = root.querySelector('.hkt__arrow[data-dir="1"]');
    function step() { var c = row.querySelector('.hkt__card'); return c ? c.getBoundingClientRect().width + 22 : row.clientWidth; }
    function sync() {
      if (!prev) return;
      prev.disabled = row.scrollLeft < 4;
      next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
    }
    [prev, next].forEach(function (b) { if (b) b.addEventListener('click', function () { row.scrollBy({ left: step() * +b.dataset.dir, behavior: 'smooth' }); }); });
    row.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();

    // Follow the For Her / For Him switch further up the page: that side first.
    var shown = 'her';
    function order(who) {
      if (who === shown || (who !== 'her' && who !== 'him')) return;
      shown = who;
      var cards = Array.prototype.slice.call(row.querySelectorAll('.hkt__card'));
      var mine = cards.filter(function (c) { return c.dataset.who === who; });
      var rest = cards.filter(function (c) { return c.dataset.who !== who; });
      if (!mine.length) return;
      row.classList.add('is-swap');
      setTimeout(function () {
        cards.forEach(function (c) { c.removeAttribute('data-top'); });
        mine.concat(rest).forEach(function (c) { row.appendChild(c); });
        mine[0].setAttribute('data-top', '');
        row.scrollLeft = 0;
        row.classList.remove('is-swap');
        sync();
      }, 250);
    }
    document.addEventListener('hs360:who', function (e) { order(e.detail); });
  })();
</script>
{%- endif -%}

{% schema %}`);

rep(`    { "type": "product_list", "id": "products", "label": "Kits", "limit": 4 },`,
`    { "type": "product_list", "id": "her_products", "label": "Kits for her", "limit": 8, "info": "Shown first when For Her is chosen above. With either list set, the kits become a swipeable row." },
    { "type": "product_list", "id": "him_products", "label": "Kits for him", "limit": 8, "info": "Shown first when For Him is chosen above." },
    { "type": "product_list", "id": "products", "label": "Kits (old single list)", "limit": 4, "info": "Used only when both lists above are empty." },`);

JSON.parse(t.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/)[1]);
fs.writeFileSync(p, t);
console.log('ok');
