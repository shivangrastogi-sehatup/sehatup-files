# TODO

## Remove Diwali from the draft theme (190038212911)

Draft theme only, never live. Pull the draft fresh before editing (the user edits in the Shopify editor), back up to `dump/`, push with `--only`, then check the preview.
Diwali section files stay in the theme (hidden, not deleted). The separate Diwali theme is kept for next year, so no on/off setting.
Pre-Diwali reference copy: `shopify-theme/live`.

### Home page sections

- [ ] 1. **Hero banner**
  - Put back the earlier photos: desktop `Background_hero_image.webp`, phone `Blurred-Minimalist-Reception-Lobby_2.webp`. They replace `Diwali_Glow_at_the_Clinic_Reception` and `Warm_Diwali_Hallway_Glow`.
  - Turn off "Festive text glow" and "Dark fade behind text".
  - Keep the new WhatsApp number (8287006498) on the second button.
- [ ] 2. **Light the diyas** (`diwali-lights`): hide it. The code stays.
- [ ] 3. **Diwali gifts** (`diwali-gifts`): hide it. The code stays.
- [ ] 4. **Doctor-designed kits**: change the heading "Doctor-Designed Diwali Care Kits" to "Doctor-Designed Care Kits".
- [ ] 5. **All other home sections**: no change needed. Their Diwali look (ivory/cream backgrounds, maroon accent words, gold dividers, gold hover glow, the "Diwali pick" tag on kits, the gold "Real People. Real Progress." box, spacing tweaks) comes from `snippets/diwali-fx.liquid`. Those rules only apply when the Diwali gifts section is on the page (`:has(.dwg)`), so step 3 removes them.

### On the home page but shared with every page

- [x] 6. **Announcement bar** (done 2026-11-13):
  - `sections/announcement-bar.liquid` is rewritten as a clean charcoal bar. The old scrolling code is gone.
  - It has a "Show discount" setting (off), with separate laptop and mobile text.
  - The `diwali_bar` and old `announcement_bar_xQxqR7` entries are removed from the header group. The `diwali-announcement.liquid` file is kept, unused.
  - The `offer-toast` snippet colours are now neutral.
- [ ] 7. **Shared Diwali file**: remove `{% render 'diwali-fx' %}` from `layout/theme.liquid`. The file stays. This takes off the Diwali font and colours, and the Diwali look on the product page, blog, article, cart and popup.
- [ ] 8. **Diyas above the footer**: remove `{% render 'diwali-footer-diyas' %}` from `layout/theme.liquid`. The file stays.
- [ ] 9. **Header**: remove the "Diwali theme" style block in `sections/sehat-header.liquid` (about lines 384-420). That's the gold line, gold underline, ivory dropdowns, gold ring on the cart count and the maroon card in the phone menu.
- [ ] 10. **Footer**: remove the "Diwali footer" maroon and gold styles in `sections/footer.liquid` (from about line 504).

### Other pages (after the home page)

- [ ] 11. **Final CTA** on About Us, Combos, For Her, For Him and Health Score 360:
  - Turn "festive" off (removes the diyas and "Shubh Deepavali").
  - Change the headings from "Begin this Diwali..." to normal wording.
- [ ] 12. **Product cards**: change the offer tag's default text from "Diwali offer" to "Offer" (`snippets/card-product.liquid`).
- [ ] 13. **Collection page, product grid and search**: the offer "Diwali: any 3 for 15% off" with code `FESTIVE15` and a diya icon. Ask the user whether the offer is still running. Then either take "Diwali" out of the wording or hide the offer.
