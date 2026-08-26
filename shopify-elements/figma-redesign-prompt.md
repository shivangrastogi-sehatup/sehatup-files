# SehatUP website redesign - Figma build brief

Paste everything below the rule into Claude (the Claude panel inside Figma, or claude.ai with
the Figma connector). It is written to stand alone: it explains the business, what already
exists in the file, the conventions to follow, the exact copy to use, and the order of work.

---

You are continuing a website redesign that is already partly built in Figma. Read this whole
brief before touching the file. Work incrementally, screenshot after each section, and fix
problems before moving on.

## 1. The file

- File: **SehatUP Website Redesign 2026**
- URL: https://www.figma.com/design/xwykW8IVJpLk611rQXPkEt
- File key: `xwykW8IVJpLk611rQXPkEt`
- Plan: Figma Starter. **Hard cap of 3 pages per file**, creating a fourth throws an error.
  Organise with frames and sections inside the existing pages instead.

Pages that exist:

| Page | Node id | Holds |
| --- | --- | --- |
| 01 Foundations | `0:1` | Variables, text styles, components |
| 02 Home | `1:4` | Home page frames |
| 03 Product | `1:5` | Product page frames, empty so far |

## 2. The business, so the design decisions are grounded

SehatUP (sehatup.com) is an Indian direct to consumer health brand running on Shopify. It is
not a plain supplement store. The positioning is **"India's first multi-system digital clinic"**:
Ayurveda, Homeopathy and Allopathy doctors review a customer's case together and agree on one
plan, and a free doctor consult comes with every order. A large share of orders are cash on
delivery, because trust is the real barrier to purchase.

Who buys:

- Men, roughly 25 to 45, for energy, stamina, performance and weight.
- Women, roughly 22 to 40, for periods, hormonal balance, thyroid, weight and intimate care.

What the redesign has to fix, in priority order:

1. **Trust before product.** Doctor credentials, AYUSH certification, cash on delivery,
   discreet packaging and real reviews must be visible early, not buried in the footer.
2. **Route by concern, not by catalogue.** People arrive with a symptom, not a product name.
   The page should start from "what is bothering you" and lead to a shortlist.
3. **Make the free consult the hero action.** It is the strongest differentiator and the
   cheapest way to convert a hesitant buyer. It should never be a small secondary link.
4. **Discretion.** Sexual wellness is a large part of the range. Plain packaging and privacy
   need to be stated plainly, without being coy about it.

Real catalogue to design against. Do not invent products.

- Collections: All Products (34), Best Sellers (6), Combos (15), Overall Wellness (7),
  Her Care (3), Period Care (3), Sexual For Her (2), Sexual For Him (12), Weight Management (5),
  Weight For Her (7), Weight For Him (6), Weight Loss Packs (2), Hormone Balance Kit (1),
  Men's Performance Kit (1), Stress and Sleep Kits (2).
- Products: Pure Himalayan Shilajit Resin, Shilajit Honey Sticks, Garcinia Cambogia Drops,
  Daily Energy and Stamina Support Kit, Ashwagandha Tablets, Vaji Bati, Kern Drops,
  Zencal D3K2, HormoniHerb Blue Tea, Her Menses, Aloezy Intimate Foam Wash.

## 3. Two directions, built side by side

The client wants to compare two visual directions on the same home page before committing.

**Direction A, evolve the current brand.** Keeps the existing crimson `#EE204A` and Montserrat.
Reads energetic, retail, promotional. Fixes hierarchy, spacing and trust cues rather than
changing identity. This one is already partly built. It is the safe path, because the live
Shopify theme can adopt it section by section.

**Direction B, clean clinical.** Deep green and teal with warm sand neutrals. Crimson survives
only on primary CTAs and sale prices. Reads like a medical service rather than a supplement
shop: more whitespace, lighter type weights, calmer imagery. Not built yet.

Both directions must use the same components and text styles, so the only differences are
colour, weight and spacing. That is what makes the comparison honest.

## 4. What already exists, do not rebuild it

### Variables

Collection **Color** (`VariableCollectionId:1:6`), 19 variables:

```
brand/primary          #EE204A     brand/primary-hover     #D01D42
brand/deep             #9C1233     brand/ink               #3D0A1A
brand/tint             #FFF1F4
clinical/primary       #14584A     clinical/primary-hover  #0E4238
clinical/accent        #1F8A7A     clinical/tint           #E7F0EC
clinical/sand          #F7F2EA
neutral/ink            #1D1D1D     neutral/body            #555555
neutral/muted          #7A7A7A     neutral/line            #E5E5E5
neutral/surface        #FFFFFF     neutral/surface-alt     #F7F7F7
support/success        #1E9E62     support/star            #F5A524
support/sale           #D01D42
```

Collection **Scale** (`VariableCollectionId:1:26`): `space/4 8 12 16 24 32 48 64 80 96 120`,
and `radius/sm 8`, `radius/md 12`, `radius/lg 20`, `radius/xl 28`, `radius/pill 999`.

### Text styles, all Montserrat

```
Display/XL        56  ExtraBold      Display/L         44  ExtraBold
Display/M mobile  32  ExtraBold      Heading/XL        36  Bold
Heading/L         28  Bold           Heading/M         22  SemiBold
Heading/S         18  SemiBold       Body/L            18  Regular
Body/M            16  Regular        Body/S            14  Regular
Label/L           16  SemiBold       Label/M           14  SemiBold
Label/XS eyebrow  12  Bold, +8% tracking, written in caps
Price/L           24  ExtraBold      Price/M           18  Bold
```

### Components on 01 Foundations

- **Button** component set `3:14`. Properties Style = Primary / Secondary / Outline, and
  Size = L / M. Variant ids: Primary L `3:2`, Primary M `3:4`, Secondary L `3:6`,
  Secondary M `3:8`, Outline L `3:10`, Outline M `3:12`. Radius 12, padding 16 by 32 at L and
  12 by 24 at M. Outline is the variant meant for use over photography.
- **Rating** `4:2`. Five `support/star` stars plus a Body/S count in a text node named `Count`.
- **Product card** `5:2`, 300 wide. Structure is `Media` (260 tall, holds `Badge`) then `Body`
  with text nodes named `Category` and `Title`, a Rating instance, a `Price` row containing
  `Now`, `Was` (strikethrough) and `Discount`, then a Primary M button filled to width.
  Override those named text nodes per product rather than detaching the instance.

### Home page, Direction A desktop

Frame `5:23`, named `Home / Direction A / Desktop 1440`. Vertical auto layout, 1440 wide,
white. Content sits in a 1200 wide container, so the side gutter is 120.

| Section | Node | State |
| --- | --- | --- |
| Announcement | `5:24` | Done. Crimson bar, white Label/M |
| Header | `5:25` | Done. Two rows: logo, search, Track order, Login, Cart, "Talk to a doctor" CTA, then a nav row |
| Hero | `5:26` | Done. brand/tint background, copy left, brand/deep media panel right with a white floating card |
| Trust bar | `5:27` | Done. Four items with hairline top and bottom rules |
| Shop by concern | `5:28` | Done. Six tiles, three columns, two rows |
| Bestsellers | `5:29` | **Empty placeholder** |
| How it works | `5:30` | **Empty placeholder** |
| Consult band | `5:31` | **Empty placeholder** |
| Testimonials | `5:32` | **Empty placeholder** |
| FAQ | `5:33` | **Empty placeholder** |
| Footer | `5:34` | **Empty placeholder** |

One known defect to fix: the six concern tiles in `5:28` alternate `brand/tint` and
`clinical/tint`. The green does not belong in Direction A. Make all six `brand/tint`, and if
you want variety, give alternating tiles a slightly deeper wash of the same hue.

## 5. Plugin API gotchas learned the hard way in this file

These already caused rework. Follow them.

1. **`resize()` resets `layoutSizing` to FIXED.** If you resize a container and then append
   children, set `layoutSizingVertical = 'HUG'` afterwards, or the container stays at its
   resized height and the content collapses into a thin line. This broke the concern grid once.
2. **A paint carrying only a variable binding can render black.** When you assign a fill to a
   node that was created in an earlier script, `setBoundVariableForPaint` on a
   `{r:0, g:0, b:0}` literal sometimes never resolves, and the node renders pure black. Always
   build the paint with the variable's resolved RGB as well as the binding:

   ```js
   const val = v.valuesByMode[Object.keys(v.valuesByMode)[0]];
   const p = figma.variables.setBoundVariableForPaint(
     { type: 'SOLID', color: { r: val.r, g: val.g, b: val.b } }, 'color', v
   );
   ```

3. **Guard variable values by type.** `'r' in val` throws on the numeric Scale variables, so
   test `typeof val === 'object'` first.
4. **Montserrat style names have no spaces**: `SemiBold` and `ExtraBold`, not `Semi Bold`.
5. **`node.query()` fails on names containing spaces.** Walk `children` instead.
6. Load every Montserrat weight you intend to use before writing text, and await it.
7. Return created and mutated node ids from every script. `console.log` is invisible and
   `figma.notify()` throws.
8. Add up the widths of a horizontal row before you build it. The header was first built at
   1283 wide inside a 1200 container and clipped its own CTA.

## 6. Copy rules

- **No em dashes anywhere.** Use a plain hyphen or restructure the sentence. Em dashes read as
  machine written, and the client has asked for them to be avoided.
- Indian English, plain and direct. No hype, no "revolutionary", no "unlock".
- Claims stay defensible: AYUSH certified, doctor reviewed, free consult. Never promise a cure.
- Prices use the rupee glyph, which renders correctly in Montserrat.

## 7. What to build next, in order

### Milestone 1, finish Direction A desktop

**Bestsellers `5:29`.** Background `neutral/surface-alt`, padding 88 top and bottom, gap 36.
A header row with the title "Bestsellers this month" in Heading/XL, a sub "The products our
customers reorder most, across energy, weight and hormonal care." in Body/M, and a right
aligned "View all products" in Label/L `brand/primary`. Then a row of four Product card
instances, gap 24, each filled to width, overridden with:

1. OVERALL WELLNESS / Pure Himalayan Shilajit Resin / 4.8 (312) / 1,499 / 1,999 / 25% OFF / badge BESTSELLER
2. ENERGY AND STAMINA / Shilajit Honey Sticks, pack of 15 / 4.7 (188) / 899 / 1,199 / 25% OFF / badge NEW
3. WEIGHT MANAGEMENT / Garcinia Cambogia Drops / 4.6 (241) / 749 / 999 / 25% OFF / hide badge
4. PERIOD AND HORMONES / HormoniHerb Blue Tea / 4.8 (96) / 649 / 899 / 28% OFF / hide badge

**How it works `5:30`.** White, padding 88, gap 40. Centred header "How SehatUP works" plus
"Three steps, and a doctor stays with you through all of them." Then three columns, gap 28,
each with a 48px `brand/tint` circle holding a crimson number, a Heading/S title, and Body/S
muted body text:

1. Take the 60 second assessment. "Answer questions about your symptoms, sleep, diet and
   medical history. No account needed."
2. Doctors build one plan. "Ayurveda, Homeopathy and Allopathy doctors review your case
   together and agree on a single protocol."
3. Delivered, with follow ups. "Medicines reach you in 3 to 5 days. Your doctor checks in
   every week on WhatsApp."

Close the section with a centred Primary L button reading "Start free assessment".

**Consult band `5:31`.** Full bleed `brand/deep`, padding 72. Left holds Heading/XL in white,
"Not sure what you need? Ask a doctor first.", and Body/M white at 80 percent opacity, "A 10
minute call with an AYUSH certified doctor, free, before you buy anything." Right holds an
Outline L "Book a free call" and a Secondary L "WhatsApp us".

**Testimonials `5:32`.** White, padding 88. Centred header "Reviews from people with the same
problem". Three cards, gap 24, each white with a `neutral/line` border, radius 20, padding 28,
holding a Rating instance, the quote in Body/M, a hairline divider, then the name in Label/M
and the concern in Body/S muted.

1. "I had tried three different shilajit brands before this. The difference was the doctor
   call, she told me I also needed to fix my sleep. Energy is back after six weeks."
   Rahul M., 34, Jaipur / Energy and stamina
2. "My cycles were irregular for two years. The blue tea plus the plan they built actually
   worked, and the follow ups kept me on track."
   Priya S., 29, Pune / Period and hormones
3. "I ordered cash on delivery because I did not trust online supplements. The box was plain
   and nobody at home asked questions."
   Arjun K., 41, Lucknow / Sexual wellness

**FAQ `5:33`.** Background `neutral/surface-alt`, padding 88. Two columns. Left holds
"Questions people ask before ordering" in Heading/XL and a crimson link, "Still unsure? Talk to
a doctor free." Right holds five rows, white, radius 12, padding 20 by 24, question in Label/L
with a chevron, and the first row expanded to show its answer in Body/S:

1. Is the doctor consult really free? "Yes. Every order includes one, and you can book a call
   before buying anything. No fee, no card details."
2. How long before I see results?
3. Can I take this with my existing prescription?
4. Do you deliver to my city?
5. What if it does not work for me?

**Footer `5:34`.** Background `brand/ink`, padding 72 top and 40 bottom, text in white or white
at reduced opacity. The logo and the line "India's first multi-system digital clinic." Then
four link columns: Shop (Bestsellers, Combos, For him, For her, All products), Care (Talk to a
doctor, Book a consult, Track order, Shipping and returns), Company (About us, Our doctors,
Blog, Careers), Support (WhatsApp, support@sehatup.com, phone number, FAQ). A bottom bar
carries "2026 SehatUP. All rights reserved.", the links Privacy, Terms and Refund policy, and
cash on delivery and payment chips. Just above the bottom bar, add a Body/S disclaimer at 60
percent opacity: "These products are not intended to diagnose, treat, cure or prevent any
disease. Speak to your doctor before starting any supplement."

When this milestone is done, screenshot the whole frame and check for clipped text, rows wider
than 1200, and any section that failed to hug its content.

### Milestone 2, Direction A mobile at 390 wide

A new frame named `Home / Direction A / Mobile 390`, placed to the right of the desktop frame
with a clear gap. Same sections and same copy, adapted:

- The announcement shrinks to a single line at 12px.
- The header becomes logo, search icon, cart and hamburger, with a horizontally scrolling row
  of concern chips underneath.
- The hero stacks: eyebrow, headline in Display/M mobile, body, two full width buttons stacked,
  then the media panel at 358 by 300, then the stat row wrapped onto two lines.
- The trust bar becomes a two by two grid.
- Concerns become a two column grid.
- Bestsellers become a horizontal scroll row showing roughly one and a half cards.
- Steps stack vertically, with the number circle to the left of the text.
- The consult band stacks, with full width buttons.
- Testimonials show one card with pagination dots.
- Footer columns stack as collapsed accordions.

### Milestone 3, Direction B in desktop and mobile

Duplicate both Direction A frames, rename them `Home / Direction B / Desktop 1440` and
`Home / Direction B / Mobile 390`, and place them below the Direction A pair so the two
directions read as two columns on the canvas. Then re-skin. Structure and copy stay identical,
which is the entire point of the comparison.

- `brand/tint` becomes `clinical/sand`, `brand/deep` becomes `clinical/primary`, section
  eyebrows become `clinical/accent`, the announcement bar and consult band become
  `clinical/primary`, and the footer becomes `clinical/primary-hover`.
- Primary buttons stay crimson. Sale prices stay `support/sale`. Nothing else is crimson.
- Increase section padding from 88 to 104, and drop headings from Bold to SemiBold.
- Concern tiles alternate `clinical/tint` and `clinical/sand`.

### Milestone 4, product page on page `1:5`

Build `Product / Desktop 1440` and `Product / Mobile 390` in Direction A colours. Re-use the
announcement, header and footer by copying those frames across from the home page.

Desktop, above the fold: a breadcrumb reading Home / Overall wellness / Pure Himalayan Shilajit
Resin, then two columns. Left is a 600 by 600 gallery with four 130px thumbnails. Right is a
520 wide buy box holding the eyebrow, an H1 in Heading/XL, a Rating instance with a "312
reviews" link, a price row with 1,499 in Price/L plus 1,999 struck through plus a 25% OFF chip
plus "Inclusive of all taxes" in Body/S, a size selector of three pills (20g, 50g, 100g, one
selected), a quantity stepper, a full width Primary L "Add to cart" with a Secondary L "Buy
now" beneath it, a trust strip reading Free doctor consult, Cash on delivery, 3 to 5 day
delivery, and a `brand/tint` inline card reading "Not sure if this is right for you? Talk to a
doctor free."

Below the fold, in this order: Why it works (three benefit cards), What is inside (ingredient
list with quantities), How to use (three steps), a doctor's note quote card carrying a name and
registration number, Reviews (rating summary with distribution bars plus three review cards),
FAQ, and four related product cards.

Mobile: the gallery swipes, the buy box stacks, and a sticky bottom bar holds the price and the
Add to cart button.

## 8. Definition of done

- Nothing is clipped, and no row exceeds the 1200 container.
- Every fill references a Color variable and every text node uses a text style. No loose hex
  values, no ad hoc font sizes.
- Every container hugs its content vertically unless a fixed height is deliberate.
- Layers are named for what they are, so the file can be handed to a developer.
- Both directions are comparable side by side at 20 percent zoom.
- Copy matches this brief exactly, and contains no em dashes.
