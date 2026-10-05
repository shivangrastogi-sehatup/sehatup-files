# sehatUP Shopify theme

Local copy of the store theme (Trade 15.4.1), store `0ec320-gj.myshopify.com`.
Work happens on the **draft theme `188534882607`**, never the live one.

```
# push one file to the draft (run from shopify-theme/live)
shopify theme push --store 0ec320-gj.myshopify.com --theme 188534882607 --only sections/<file>.liquid --path .

# preview
https://0ec320-gj.myshopify.com/pages/health-score-360?preview_theme_id=188534882607
```

Templates and `header-group.json` are edited in the theme editor too, so pull them
fresh into a temp folder before editing, then push from there (the files start with
a `/* */` comment that has to be kept).

## Health Score 360 page

Template `templates/page.healthscore 360.json`, top to bottom:

| Section | File | Notes |
|---|---|---|
| Hero, For Her / For Him | `health-check-cards.liquid` | Headline left, cards right from 900px; tiles below. H1 + MedicalWebPage JSON-LD. |
| "What is Health Score 360?" story | `health-score-scroll.liquid` | Pinned, scroll-linked (GSAP + Lenis). Photo `assets/hs360-couple-4k.webp`. |
| What happens after you start | `health-journey.liquid` | Sticky phone on desktop. |
| Signs checklist | `health-signs.liquid` | |
| Doctors | `health-doctors.liquid` | |
| Care kits | `health-kits.liquid` | 3 best sellers, photos shown untinted. |
| Reviews | `health-trust.liquid` | Judge.me carousel; anchor `#reviews`. |
| FAQ | `health-faq.liquid` | One answer open at a time, animated; FAQPage JSON-LD; anchor `#faq`. |
| Video bubble | `floating-product-video.liquid` | Plays inline; expand opens the big player. |
| Final call to action | `health-final-cta.liquid` | |

Old sections on the template are disabled, not deleted.

### The scroll story (`health-score-scroll.liquid`)

- Length: section is `330vh` desktop / `300vh` phone (`height` on `.is-live`).
- Timeline: `HOLD` is how long each card stays readable; `STEP` follows from it.
  During a hold the camera pushes in (`PUSH`), the card drifts and its bottom line fills,
  so every scroll moves something.
- Settle: only when the visitor stops mid-transition; inside a card it stays put.
- Camera framings per card are in `shots()`. Dot positions are section settings
  (`w_x`, `w_y`, `w_x2`, `w_y2`, `s_x`, `s_y`, `p_x`, `p_y`, in % of the photo).
- Framing is Apple-style: the photo always fills the screen and close-ups may crop
  hair, foreheads or legs, but never the eyes or the dots. Eye lines are settings
  (`eyes_him`, `eyes_her`, % down the photo); on short, wide screens a shot's zoom
  eases off only as much as needed to keep eyes and dots in frame.
- The photo is laid out at its deepest-zoom size and only scaled down (sharp), capped
  at ~4096 real pixels.
- Photo: 4K made from `Sunlit Couple Portrait with Plant Shadows.png` with
  Real-ESRGAN x4plus, blended 55/45 with the original plus fine grain so skin keeps its
  texture. Master in Downloads: `hs360-couple-4k-3840x2161.png`. If the photo is
  replaced, re-place the dots and check all three shots.
- `load` never fires on this page: start things on `DOMContentLoaded`; a shared
  ResizeObserver (`window.sehatRefreshWatch`) re-measures ScrollTrigger.

## Site-wide

- **Header** `sections/sehat-header.liquid` (in `header-group.json`): sticky 60px bar
  (56px phones), For Him / For Her dropdowns with photo prompt, search with live product
  suggestions + clear and close buttons (closes on any outside click or focus), slide-in
  drawer under 1100px. Keeps the class `section-header`, which the story and the
  journey measure. The old Trade header is still in the group, disabled.
- **Announcement bar**: the original one is back. `sehat-trust-bar.liquid` exists but
  is disabled.
- **Shared accordion** `assets/sehat-accordion.js`: put `data-sehat-accordion` on the
  wrapper of a group of `<details>` and load the file with `defer`. Items slide open
  and shut, one open at a time, with `is-opening` / `is-closing` classes for the
  section's own fade. Used by the Health Score FAQ and the product fold-outs.
- **Product page**: `sections/sehat-product.liquid` (gallery left, buy column right;
  fold-outs come from the `[description]` / `[benefits]` / `[how_to_use]` tags in each
  product description) and `sections/sehat-kit-items.liquid` ("What's in your kit",
  shown when a description names two or more other products). The buy buttons are
  the theme's own `buy-buttons` snippet, so the Shiprocket checkout is unchanged.
- **For Him page** (`templates/page.for-him.json`): `sehat-audience-hero` (headline, person photo, jump links), three `sehat-shelf` sections (one collection each: for-him, weight-for-him, overall-wellness; each carries an anchor name plus the old menu anchor id so existing menu links still land), then the clinic note, reviews, FAQ and final call to action reused from the other pages.
- **Product facts** `snippets/sehat-facts.liquid`: kit contents, the short how-to-take line and named ingredients per product handle. Used by the kit section, the shelves and the buy section.
- **Styles before markup** in every custom section, so pages never flash unstyled.
- `shopify-elements/lead-capture-popup.liquid` is the same file as
  `sections/lead-popup.liquid`; keep them in sync.

## Open items

- Real box photo for the phone journey (to be provided).
- Before publishing the draft: switch off the Taboola (archive-digger) and taggbox
  app embeds, feature reviews in Judge.me, then publish and re-test the live site.
- For Him / For Her sub-menu links point at anchors from `ai_gen_block_1595750`, which
  may no longer exist; fix them in Online Store → Navigation → main-menu.
- Unused assets that can be deleted: `hs360-couple.webp`, `hs360-couple-2x.webp`.
