# Healthcare hero - foreground (doctor) image controls

## Why the sliders do nothing

Six settings exist in the schema but are never referenced in the CSS:

| Setting | Status |
| --- | --- |
| `foreground_offset_x` (Horizontal offset) | dead, `right: 0` is hardcoded |
| `foreground_offset_y` (Vertical offset) | dead, `bottom: 0` is hardcoded |
| `foreground_image_width` (Image width) | dead, size comes from Min height |
| `foreground_position_x` (Horizontal position) | dead |
| `foreground_position_y` (Vertical position) | dead |
| `hide_foreground_mobile` (Hide on mobile) | dead |

The doctor's size is driven only by **Spacing → Min height**, and below 1208px even
that is overridden by hardcoded heights of 380px, 350px and 320px.

---

## EDIT 1 - replace the foreground image CSS

Find this block (search for `foreground-image`):

```liquid
    {% if block.settings.layout_mode == 'background-with-overlay-image' and block.settings.foreground_image %}
      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} {
        position: absolute;
        right: 0;
        bottom: 0;
        z-index: 2;
      }

      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} img {
        height: {{ block.settings.section_min_height }}px;
        width: auto;
        object-fit: cover;
        object-position: bottom right;
        display: block;
      }
    {% endif %}
```

Replace the whole thing with:

```liquid
    {% if block.settings.layout_mode == 'background-with-overlay-image' and block.settings.foreground_image %}
      {%- liquid
        assign fg_scale = block.settings.foreground_image_scale | default: 100
        assign fg_x = block.settings.foreground_position_x
        assign fg_y = block.settings.foreground_position_y
        assign fg_ox = block.settings.foreground_offset_x | default: 0
        assign fg_oy = block.settings.foreground_offset_y | default: 0

        assign fg_tx = '0'
        assign fg_ty = '0'
        if fg_x == 'center'
          assign fg_tx = '-50%'
        endif
        if fg_y == 'center'
          assign fg_ty = '-50%'
        endif
      -%}

      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} {
        position: absolute;
        z-index: 2;
        {% if fg_x == 'left' %}
          left: {{ fg_ox }}%;
        {% elsif fg_x == 'center' %}
          left: 50%;
        {% else %}
          right: {{ fg_ox }}%;
        {% endif %}
        {% if fg_y == 'top' %}
          top: {{ fg_oy }}%;
        {% elsif fg_y == 'center' %}
          top: 50%;
        {% else %}
          bottom: {{ fg_oy }}%;
        {% endif %}
        transform: translate({{ fg_tx }}, {{ fg_ty }});
      }

      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} img {
        height: calc({{ block.settings.section_min_height }}px * {{ fg_scale }} / 100);
        width: auto;
        object-fit: contain;
        object-position: bottom center;
        display: block;
      }
    {% endif %}
```

---

## EDIT 2 - make the breakpoint heights respect the scale

These three currently hardcode a height, which overrides the size control.

**At `@media (max-width: 1208px)`** change:

```liquid
      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} img {
        height: 380px;
      }
```

to:

```liquid
      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} img {
        height: calc(380px * {{ block.settings.foreground_image_scale | default: 100 }} / 100);
      }
```

**At `@media (max-width: 1140px)`** there is a hardcoded block id, which is a bug. This
rule only ever matched one specific block instance:

```liquid
      .ai-healthcare-hero__foreground-image-ad05jwgx4dfvxbgjxvaigenblock1a1cde1mz7dkh img {
          height: 350px;
      }
```

Replace with:

```liquid
      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} img {
        height: calc(350px * {{ block.settings.foreground_image_scale | default: 100 }} / 100);
      }
```

**At `@media (max-width: 1084px)`** change:

```liquid
      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} img {
        height: 320px;
      }
```

to:

```liquid
      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} img {
        height: calc(320px * {{ block.settings.foreground_image_scale | default: 100 }} / 100);
      }
```

---

## EDIT 3 - make "Hide on mobile" work

Inside `@media (max-width: 1040px)`, find:

```liquid
      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} {
        position: relative;
        right: auto;
        bottom: auto;
        margin: 20px auto 0 auto;
        display: flex;
        justify-content: center;
        width: 100%;
      }
```

Replace with:

```liquid
      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} {
        {% if block.settings.hide_foreground_mobile %}
          display: none;
        {% else %}
          position: relative;
          left: auto;
          right: auto;
          top: auto;
          bottom: auto;
          transform: none;
          margin: 20px auto 0 auto;
          display: flex;
          justify-content: center;
          width: 100%;
        {% endif %}
      }
```

Note the added `left/top/transform` resets. Without them the new desktop positioning
leaks into the mobile layout.

And just below it:

```liquid
      .ai-healthcare-hero__foreground-image-{{ ai_gen_id }} img {
        height: auto;
        max-height: calc(300px * {{ block.settings.foreground_image_scale | default: 100 }} / 100);
        width: auto;
        max-width: 100%;
      }
```

---

## EDIT 4 - swap the dead width slider for a working size slider

In `{% schema %}`, find and **delete**:

```json
    {
      "type": "range",
      "id": "foreground_image_width",
      "label": "Image width",
      "min": 20,
      "max": 100,
      "step": 5,
      "unit": "%",
      "default": 40
    },
```

Replace it with:

```json
    {
      "type": "range",
      "id": "foreground_image_scale",
      "label": "Image size",
      "info": "100% keeps the current size. The image is sized from the section Min height.",
      "min": 50,
      "max": 200,
      "step": 5,
      "unit": "%",
      "default": 100
    },
```

---

## What changes visually

**Image size:** unchanged at 100%. The new slider scales from there.

**Position:** your saved Horizontal offset is probably 5%, and the old code ignored it
and used `right: 0`. Once wired up the doctor moves 5% in from the right edge. Set the
offset to 0 to keep exactly the current position.

**Mobile:** "Hide on mobile" is ticked by default and was being ignored, so the doctor
currently shows on phones underneath the text. Wiring it up will hide it. **Untick it**
if you want the current mobile layout kept.

**object-fit:** changed from `cover` to `contain`. With `cover` the image was being
cropped whenever the box aspect ratio did not match. `contain` shows the whole person.
If you preferred the crop, put `cover` back.

---

## Other dead settings in this block

Not fixed, since you only asked about the doctor image. All of these render controls
that do nothing:

| Setting | Why it does nothing |
| --- | --- |
| `desktop_width_percent` | never referenced |
| `background_image_size` | CSS hardcodes `object-fit: cover` |
| `background_overlay_color` | overlay div has no background colour |
| `background_overlay_opacity` | applied to the image itself, so it fades the photo rather than adding an overlay |
| `content_max_width` | commented out in the CSS |
| `accent_color` | the `.accent` class is never used in the markup |
| `heading_size`, `subheading_size`, `body_size` | desktop uses `clamp()`, so these only apply between breakpoints |
| `section_min_height_mobile` | mobile query hardcodes `min-height: auto` |
| `section_padding_*_mobile` (3) | mobile query hardcodes `24px 16px` |
| `mobile_content_alignment` | mobile query hardcodes `text-align: left` |
| `mobile_background_position_x` / `_y` | never referenced |

Fourteen dead controls in total. Say the word and I will wire them up or strip them out
so the panel only shows what actually works.
