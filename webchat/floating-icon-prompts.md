# SehatUP chat launcher - floating icon brief

Ten image-generation prompts for the floating chat button, plus the house-style
block that has to travel with every one of them.

Paste **Block A** into ChatGPT first. Then paste **one** variation block per
image. Do not paste all ten at once - you get ten muddled hybrids instead of ten
clean options.

---

## 0. Where this icon actually lives

The launcher is drawn in `webchat/public/widget.js` (the inline `<svg>` at
line ~551, inside `.launcher`). Everything below is dictated by that button:

| Thing | Value | Why it matters to the artwork |
|---|---|---|
| Button size | **58px** desktop, **54px** mobile | This is the whole canvas. Not 512. Not 128. |
| Shape | Perfect circle, `border-radius: 50%` | Anything outside the inscribed circle gets cut off |
| Button fill | `#ee204a` SehatUP crimson | Either the artwork sits *on* this, or the artwork *replaces* it |
| Current glyph | White, 26px, 2px stroke | The detail ceiling that already works at this size |
| Drop shadow | Applied by CSS | **Do not bake a shadow into the image.** It will double up |
| Hover | Lifts 2px, no colour change | Artwork must survive on a plain background at rest |
| Tagline slot | The `.tip` pill, 58px tall, unfurls to the left | **The tagline is never inside the icon.** It lives here |

Two production modes. Every variation below is tagged with one:

- **Mode G (glyph)** - a flat white mark that sits inside the crimson circle at
  about 26-30px. Reads as an interface control. Best for symbolic ideas.
- **Mode B (badge)** - a full-bleed circular illustration that fills all 58px and
  replaces the crimson fill. Reads as a person you can talk to. Best for the
  doctor-portrait ideas. Must keep crimson or wine somewhere or the button stops
  looking like SehatUP.

### The taglines

Each variation ships with a matching tagline pair. These are real widget
settings, not decoration - wire the winner in with:

```html
data-tip-title="..."   <!-- bold line, ~22 characters before it wraps -->
data-tip-text="..."    <!-- second line, ~46 characters -->
```

---

## Block A - house style (paste this before every variation)

```
You are designing a floating chat-launcher icon for SehatUP, an Indian
Ayurvedic health brand that sells wellness formulations and offers free
consultations with AYUSH-certified doctors. The audience is Indian adults,
25-55, buying for private health concerns - stamina, hormones, weight, sleep.
The tone is a calm consulting room, not an emergency ward, and not a tech
startup.

BRAND PALETTE - use only these:
  Crimson (primary)   #ee204a
  Deep wine           #45101f
  Wine mid            #55123a
  Ink                 #241a1e
  Leaf green (accent) #2f6b4f
  Warm paper          #faf7f6
  Pure white          #ffffff

OUTPUT SPEC:
  - Square canvas, 1024 x 1024, but design it to be judged at 58 x 58 pixels.
  - Flat 2D vector illustration. Clean geometric shapes, confident edges.
  - No 3D rendering, no photorealism, no gradient meshes, no bevels, no glow,
    no drop shadow, no outer stroke, no background scene, no texture, no grain.
  - A single flat solid background colour only.
  - Keep all artwork inside a centred circle covering 78% of the canvas.
    Everything outside that circle will be clipped away by the button.

THE 58-PIXEL RULE - this is the hardest constraint and it overrides every
aesthetic instinct you have:
  - Minimum thickness of any line, limb or stroke: 4% of the circle diameter.
  - Minimum gap between any two shapes: 3% of the circle diameter.
  - Maximum 5 to 7 distinct shapes in the entire icon. Count them.
  - Faces are 3 to 5 shapes total. No pupils inside irises, no eyebrows, no
    nostrils, no individual fingers, no hair strands, no folds in fabric.
  - If a detail would be smaller than a grain of rice on a phone screen,
    delete it rather than shrink it.

HARD BANS:
  - No text, no letters, no numbers, no wordmark, no signature anywhere.
  - No red cross or white-cross-on-red. That is the Red Cross emblem and it is
    legally protected. Use a stethoscope, a leaf or a pulse line instead.
  - No caduceus (the two-snake winged staff). That is a commerce symbol.
    If you need a medical staff, use the single-snake Rod of Asclepius.
  - No syringes, needles, pills, capsules, hospital beds, IV drips, ECG
    monitors, or anything that reads as clinical or frightening.
  - No stock-photo smiles, no thumbs up, no laurel wreaths, no shields.
  - No Western white lab coat as the only signifier of "doctor". Indian
    practitioners read as doctors via the stethoscope, not the coat.

Confirm you have understood, then wait for the variation brief.
```

---

## The ten variations

### 1. The single doctor - "someone is actually there"

**Mode B (badge).** The baseline. A person, not a symbol. The whole point of the
button is that a human being is on the other end of it.

**Tagline:** `SehatUP Mitra` / `A real doctor is one tap away`

```
VARIATION 1 - SINGLE DOCTOR PORTRAIT (full-bleed circular badge)

A head-and-shoulders portrait of one Indian doctor, cropped inside a circle
that fills the entire canvas.

Composition: head slightly above centre, shoulders cut off by the bottom edge
of the circle. Face turned three-quarters, eyes toward the viewer. The figure
is a flat silhouette-plus-planes illustration, not a rendered face.

Colour: the circle background is deep wine #45101f. The figure is warm paper
#faf7f6 and ink #241a1e. A single crimson #ee204a accent - the collar, or the
stethoscope tubing - and nothing else in crimson.

The stethoscope around the neck is the only prop and it must be thick and
simple: two straight tubes and one round chest piece. No detailed earpieces.

Expression: calm and attentive. Not smiling with teeth. Not stern.

Face budget: skin shape, hair shape, two eye dots, one mouth line. That is all.
```

---

### 2. Doctor inside a speech bubble - "talk to a doctor"

llo world
```

---

### 3. Two doctors - "a second opinion is built in"

**Mode B (badge).** Two heads reads as consultation rather than customer
service. It is the "we discuss your case" idea.

**Tagline:** `Two doctors, one plan` / `Your case gets a second opinion`

```
VARIATION 3 - TWO DOCTORS SIDE BY SIDE (full-bleed circular badge)

Two Indian doctors shown shoulder to shoulder, head and shoulders only, inside
a circle that fills the canvas.

Composition: the two figures overlap slightly, one half a head taller and set
slightly back, the other in front. One woman, one man. They are turned very
slightly toward each other but both facing the viewer. The overlap is the whole
idea - they are a pair, not two separate people.

Colour: circle background deep wine #45101f. Figures in warm paper #faf7f6 with
ink #241a1e hair. One figure carries a crimson #ee204a stethoscope, the other a
leaf green #2f6b4f one. Those two accents are the only colour.

Separation: leave a clear wine-coloured gap between the two silhouettes so they
do not merge into one blob when shrunk. That gap is at least 3% of the circle
width.

Faces: two eye dots and one mouth line each. Nothing more.
```

---

### 4. Three doctors - "a whole panel, not one opinion"

**Mode B (badge).** The authority play. Three is the smallest number that reads
as an institution.

**Tagline:** `A panel, not a pop-up` / `AYUSH certified doctors on call`

```
VARIATION 4 - THREE DOCTORS IN AN ARC (full-bleed circular badge)

Three Indian doctors arranged in a shallow arc inside a circle that fills the
canvas, following the curve of the circle itself.

Composition: the centre figure is largest and front-most, the two flanking
figures are smaller and set back and slightly lower, so the group forms a gentle
triangle. Head and shoulders only, cropped at the bottom of the circle. A mix of
women and men.

Colour: circle background deep wine #45101f. All three figures in warm paper
#faf7f6 with ink #241a1e hair. Exactly one crimson #ee204a accent, on the centre
figure's stethoscope. The two outer figures carry no props at all - they are
pure silhouette.

Simplification is critical here: three figures at 58 pixels means each head is
about 15 pixels. The outer two must be reduced to head-and-shoulder silhouettes
with no facial features whatsoever. Only the centre figure gets eye dots.

Keep visible wine-coloured gaps between all three silhouettes.
```

---

### 5. Doctor and patient - human connection

**Mode B (badge).** Not a service icon, a relationship icon. Two people facing
each other rather than facing the customer.

**Tagline:** `Someone who listens` / `Talk it through, no judgment`

```
VARIATION 5 - DOCTOR AND PATIENT IN CONVERSATION (full-bleed circular badge)

Two figures in profile, facing each other, inside a circle that fills the canvas.

Composition: seen from the side, head and shoulders, angled toward one another
with a clear gap between their faces. The left figure wears a stethoscope and is
the doctor; the right figure carries no prop and is the patient. Between and
slightly above their heads, a small rounded speech bubble sits in the gap,
shared by both of them.

The negative space between the two profiles should read as a soft vessel shape -
the space between them is doing as much work as the figures.

Colour: circle background warm paper #faf7f6. Figures in deep wine #45101f
silhouette. The shared speech bubble is crimson #ee204a. That inverted ground is
deliberate - this variation is warm and light where the others are dark.

Profiles only, no facial features at all. The tilt of each head carries the
whole expression: the doctor's head tilted slightly down and forward, listening.
```

---

### 6. Cupped hands and a leaf - personal wellness

**Mode G (glyph).** The Ayurveda half of the brand. Care and plant medicine
without a single clinical cue.

**Tagline:** `Ayurveda, personalised` / `Built around your body, not a template`

```
VARIATION 6 - CUPPED HANDS HOLDING A LEAF (white glyph)

A flat white glyph on a solid crimson #ee204a circular background.

Two cupped hands seen from the front, forming a wide shallow bowl at the bottom
of the composition. Rising out of the bowl, a single upright leaf - a simple
pointed oval with one straight centre vein.

The hands are drawn as two solid, mitten-like shapes with a single notch each to
suggest a thumb. No individual fingers. The two hands nearly meet at the centre
with a small gap between them.

The leaf is solid white with the centre vein knocked out in crimson negative
space, and that vein is thick - at least 4% of the icon width.

Proportion: hands occupy the bottom 45% of the glyph, leaf the top 55%. The leaf
must read as a leaf and not as a flame or a teardrop, so give it a slight
asymmetric curve at the tip.
```

---

### 7. The verified doctor - doctor authenticated

**Mode G (glyph).** The trust play. This is the one that answers "is there a
real doctor behind this, or a bot pretending".

**Tagline:** `Doctor verified` / `Every answer checked by an AYUSH doctor`

```
VARIATION 7 - VERIFIED DOCTOR BADGE (white glyph with green seal)

A flat white glyph on a solid crimson #ee204a circular background.

Centre: a simple doctor bust in solid white - circle head, trapezoid shoulders,
and a thick U-shaped stethoscope across the chest with one round chest piece.

Bottom right, overlapping the shoulder: a verification seal. A solid leaf green
#2f6b4f circle with a bold white checkmark inside it, and a thin crimson ring
separating the seal from the white bust so the two never touch.

The seal is about 34% of the glyph's width - large enough that the checkmark
survives at 58 pixels. The checkmark is a single thick two-stroke tick, chunky,
with rounded ends.

This is the only variation where a second colour appears in the glyph. The green
is what carries "authenticated"; keep everything else pure white.
```

---

### 8. Stethoscope chat bubble - the clever mark

**Mode G (glyph).** One continuous line that is both a stethoscope and a
conversation. The most brand-mark-like option and the one that will age best.

**Tagline:** `Ask anything about your health` / `Hindi ya English, jo comfortable ho`

```
VARIATION 8 - STETHOSCOPE FORMING A SPEECH BUBBLE (white glyph)

A flat white glyph on a solid crimson #ee204a circular background.

A single stethoscope tube drawn as one continuous thick white line. Instead of
hanging in the usual U shape, the tube loops around to enclose a rounded speech
bubble - the tubing IS the outline of the bubble, including a short tail at the
bottom left. The two earpiece ends rise from the top of the bubble as two short
straight prongs with small rounded caps. The round chest piece sits at the
bottom right of the bubble as a solid filled disc, doubling as a full stop.

The line weight is uniform and heavy throughout: at least 6% of the icon width,
with rounded caps and rounded joins. This is a bold marker drawing, not a
fineliner sketch.

The bubble interior stays empty crimson. Do not put a face, a cross or a pulse
line inside it. The emptiness is what makes the loop readable.
```

---

### 9. The named advisor

**Mode B (badge).** Gives the advisor a face, so the avatar in the panel header and
the launcher become the same person. Note this pulls against the gender-neutral brief -
sehatUP Mitra is a neutral name, and a portrait re-genders it.

**Tagline:** `sehatUP Mitra` / `Product, price ya health - kuch bhi puchiye`

```
VARIATION 9 - ANANYA, THE HEALTH ADVISOR (full-bleed circular badge)

A single Indian woman health advisor, head and shoulders, inside a circle that
fills the canvas. She is the friendly front desk of the brand, not a surgeon.

Composition: head centred and slightly large in frame, shoulders cropped by the
bottom of the circle. Facing the viewer straight on. Dark hair tied back, a
simple thick outline. A slim headset with a small boom mic curving toward one
cheek - drawn as one thick line and one small filled disc at the ear.

Colour: the circle background is a flat crimson #ee204a. She is rendered in warm
paper #faf7f6 and ink #241a1e, with a deep wine #45101f top. The headset is
white.

Warm and approachable: a small closed-mouth smile, drawn as one short curved
line. Eyes as two solid dots. No eyebrows, no nose.

She should read as an Indian woman in her early thirties without any caricature,
jewellery, bindi or costume detail. Silhouette and hair shape do the work.
```

---

### 10. Circle of people - community wellness

**Mode G (glyph).** The most abstract option and the strongest at tiny sizes,
because it has no faces to lose. Three heads that also read as a flower.

**Tagline:** `Thousands ask us daily` / `Private, free, and no waiting room`

```
VARIATION 10 - THREE HEADS FORMING A CIRCLE (white glyph)

A flat white glyph on a solid crimson #ee204a circular background.

Three identical abstract human figures arranged at 12, 4 and 8 o'clock around a
common centre, each rotated to face inward, forming a triangular rosette.

Each figure is exactly two shapes: a solid circle for the head and a rounded
petal or teardrop shape below it for the body, with a small gap between the two.
Nothing else - no arms, no legs, no faces.

The three figures do not touch. The crimson negative space they enclose at the
centre forms a small three-pointed shape, and that gap is deliberate: it must
stay open and at least 8% of the glyph width across.

The whole rosette should read two ways - as three people leaning in toward each
other, and as a simple flower. Symmetrical, balanced, calm.
```

---

## Negative prompt (append to any variation if the model drifts)

```
Do not include: text, letters, numbers, watermarks, signatures, red crosses,
caduceus, syringes, pills, hospital equipment, lab coats as the main signifier,
gradients, glows, drop shadows, outer strokes, 3D rendering, photorealism,
background scenery, texture, grain, sparkles, motion lines, thin hairline
details, small facial features, individual fingers, more than 7 shapes.
```

---

## How to judge the ten

Do not judge them at full size. Every one of them looks good at 1024px - that
tells you nothing.

1. **The 58px test.** Paste each into a document and scale it to 58 pixels wide.
   Anything that turns to mush is out, regardless of how good the big version is.
   Then check 54px, which is what phones get.
2. **The squint test.** Blur it until you can only see the overall shape. A good
   launcher icon still has a recognisable silhouette. If two variations blur to
   the same grey circle, keep the simpler one.
3. **The grayscale test.** Strip the colour. If the icon only worked because of
   the crimson, it is not doing its job.
4. **The corner test.** Drop it over a real product page screenshot, bottom
   right, 32px from the bottom and 20px from the right. Some marks that look
   confident on white vanish over a busy page.
5. **Mode B specifically:** badges lose their brand tie because they replace the
   crimson fill. Check that the button is still obviously SehatUP's and not a
   generic support avatar.

Realistic expectation: variations 2, 7, 8 and 10 will survive the 58px test
comfortably. Variations 3, 4 and 5 are the ones most likely to fail it, because
multiple figures at 58px is genuinely hard. Generate them anyway - if one works,
it says something none of the glyphs can say.

---

## Two practical notes on ChatGPT itself

**Transparency.** ChatGPT's image generation does not reliably produce a real
alpha channel. Ask for the glyph on a **flat, solid crimson circle centred on a
plain white background**, then cut the circle out yourself. Asking for a
"transparent background" usually returns a checkerboard pattern drawn as actual
pixels, which is worse than useless.

**It will add text.** Even with the ban in Block A, expect stray letters near the
bottom of roughly one image in four. Regenerate rather than trying to prompt it
away, and keep the ban in every single message - it forgets across turns.

---

## Wiring the winner in

The launcher currently draws its icon as an inline SVG path in
`webchat/public/widget.js` (search for `class="launcher"`, around line 551):

- **If the winner gets redrawn as a vector** (Mode G), replace that one `<path>`
  with the new path data and keep `fill="none" stroke="currentColor"`. It
  inherits `color: #fff` from `.launcher`, so it stays white for free and costs
  no extra network request.
- **If the winner stays a raster badge** (Mode B), swap the `<svg>` for
  `<img src="..." width="58" height="58" alt="">`, drop `background: var(--brand)`
  from `.launcher`, and export at **116x116** for 2x screens. Keep
  `border-radius: 50%` on the button so the badge is clipped to a circle.
- Either way, set the matching tagline on the Shopify snippet
  (`shopify-elements/sehatup-webchat.liquid`) with `data-tip-title` and
  `data-tip-text`, and consider reusing the same artwork for `data-avatar`, which
  fills the panel header.
