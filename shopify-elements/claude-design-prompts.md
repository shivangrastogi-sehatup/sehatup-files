# SehatUP redesign - Claude Design prompts (v2, written against the live site)

Rewritten after reviewing screenshots of the live pages: home, product, Health Score 360, lead
popup, about, blog index, blog article, combos, for her, for him, and a policy page.

## How to run this

Settings at claude.ai/design: template **UI mockups**, design system **not Nocturne** (pick
none or default), model **Opus 5**.

Run the prompts in order, in **one project**, so context carries between them. Attach the
screenshots listed at the top of each prompt to that message.

The single biggest change from v1: this is now **one visual direction applied across every
page**, not two directions on one page. Ten pages that disagree with each other is the actual
problem. A second colourway is not.

---

## PROMPT 1 - Design system and home page

**Attach:** the logo, and the full home page screenshot.

I am redesigning sehatup.com. The attached screenshots are the live site as it stands today.
Study them before designing. Build a design system and then a new home page, as two artboards:
desktop 1440 wide and mobile 390 wide.

### The business

SehatUP is an Indian direct to consumer health brand on Shopify. It is not a supplement store.
It positions as India's first integrated digital health clinic: doctors from Ayurveda,
Homeopathy and Modern Medicine review a case together and agree on one plan, rather than each
treating in isolation. Every order includes a free doctor consult. Many orders are cash on
delivery, because trust, not price, is the barrier. Buyers are men roughly 25 to 45 (energy,
stamina, sexual performance, weight) and women roughly 22 to 40 (periods, PCOS, hormones,
weight, intimate care).

The lead magnet is **Health Score 360**, a two minute quiz that produces a personalised report
delivered on WhatsApp.

### What is wrong with the current site, which this redesign must fix

1. **Every page has a different hero.** Dark photo on home, purple on Combos, pink on For Her,
   blue on For Him, plain white on Health Score 360. Five unrelated treatments. The site reads
   as five sites. One hero pattern, with a controlled tint per audience, is the main fix.
2. **Section rhythm is inconsistent.** Padding, heading sizes and card widths change from page
   to page and sometimes within a page. The "Conditions we Solve" grid puts three wide cards on
   one row and five narrow ones on the next.
3. **Empty and broken modules.** "Featured In" on the home page is a heading over a white void.
   Several product carousels contain one or two items but still show arrows on both sides.
4. **Three floating elements compete**: a WhatsApp button, a floating video reel, and a lead
   capture popup. At most one should be present at a time.
5. **Trust assets are low resolution raster badges.** AYUSH, GMP and Verified Doctors need to
   be crisp and consistently sized.

Keep what works: the triple-system idea, the consistent footer, the trust badges on every page,
real reviews with customer photos, and the Health Score 360 quiz as the primary lead capture.

### Design system to establish first

**Logo.** Use the attached wordmark: "sehat" in near black, "UP" in crimson, with the small
square-dot glyph to its left. Do not redraw it.

**Colour.** Crimson `#EE204A` is the single brand colour and the only colour used for primary
actions. Support it with crimson hover `#D01D42`, deep berry `#9C1233`, near black berry
`#3D0A1A`, and a pale pink wash `#FFF1F4`. Neutrals: ink `#1D1D1D`, body `#555555`, muted
`#7A7A7A`, hairline `#E5E5E5`, white `#FFFFFF`, off white `#F7F7F7`. Star gold `#F5A524`,
success green `#1E9E62`.

Audience tints, used **only** as soft section backgrounds, never as full hero colour swaps:
rose `#FDF0F4` for For Her, slate blue `#EDF1F8` for For Him, violet `#F1ECFA` for Combos,
sand `#FAF6EF` for editorial and about.

**Type.** Montserrat throughout. Display 56 and 44 ExtraBold, headings 36 and 28 Bold, 22 and
18 SemiBold, body 18, 16 and 14 Regular, labels 16 and 14 SemiBold, a 12 Bold uppercase eyebrow
with wide tracking, prices 24 ExtraBold. Mobile top headline drops to 32.

**Layout.** Desktop content sits in a 1200 container inside 1440, so the gutter is 120. Section
padding 88 top and bottom, 64 for tighter bands. Card radius 20, button radius 12, pill 999.

**Components to define once and reuse on every later page.** Announcement bar, header, hero,
section heading block, product card, category tile, trust badge row, step item, doctor card,
testimonial card, FAQ accordion row, stat band, CTA band, footer, and a lead popup.

**One hero pattern for the whole site.** A tinted background, an eyebrow, a headline, one
sentence of body, two buttons (solid crimson primary, outlined secondary), a trust line, and a
photo panel to the right on desktop that stacks below the copy on mobile. Only the tint, the
photo and the words change from page to page.

### Home page sections, in order

Keep the current structure, which is sound. Fix the execution and tighten the copy.

1. **Announcement bar.** Black, white 13px, three items: Free shipping on prepaid orders, 100%
   trusted, Verified doctors.
2. **Header.** Logo, then For Him, For Her, Combos, Blogs, About Us, Health Score 360, then
   search, account and cart icons on the right. Add a crimson "Talk to a doctor" button, which
   the live header lacks. Sticky on scroll.
3. **Hero.** Eyebrow "INDIA'S FIRST INTEGRATED DIGITAL HEALTH CLINIC". Headline "Struggling
   with stress, hormones, weight or sexual health?" Sub "Find the real cause in 60 seconds."
   Body "Doctors from Ayurveda, Homeopathy and Modern Medicine work on your case together, and
   build one plan you can actually follow." Buttons "Start free assessment" and "Talk to a
   doctor". Photo of a doctor with a patient. Add a trust line beneath: 50,000+ patients ·
   AYUSH certified · 4.8 / 5 from 3,200 reviews.
4. **Why traditional healthcare fails most people.** Three columns: Fragmented treatment,
   "Different doctors, different opinions, and nobody connects the dots." Symptom-focused
   approach, "Most treatments fix what you feel now, not what caused it." Trial and error
   prescriptions, "Medicines change every time your problem does not go away."
5. **Why integrated care works.** Heading "Why sehatUP integrated care works", sub "The power of
   three medical systems working together." A four cell bento: Ayurveda "Overall wellness,
   hormonal balance and long term healing", Homeopathy "Personalised treatment with minimal side
   effects", Modern Medicine "Immediate symptomatic relief and accurate diagnosis", plus one
   image cell. Close with "Together they give you a complete 360 degree care plan that no single
   system can offer alone."
6. **How sehatUP works.** Four numbered steps, evenly sized: Know your health score, "A quick
   assessment that reveals issues in hormones, stress, digestion, sleep and lifestyle."
   Multi-system doctor review, "Doctors from Ayurveda, Homeopathy and Modern Medicine analyse
   your score and history together." Get a personalised care kit, "Custom medicines, herbs,
   nutrition and lifestyle, designed specifically for your body." Continuous monitoring,
   "Monthly follow ups and plan adjustments based on how your body responds." Then a crimson
   button "Start your Health Score".
7. **Conditions we solve.** Eight tiles in a strict four by two grid, all identical width. Do
   not repeat the current uneven three-then-five layout. Sexual wellness, Hormonal imbalance,
   Weight gain and metabolism, Stress and anxiety, Sleep issues, Digestion and bloating, Low
   energy and fatigue, Immunity. Each with a small icon, a title and one line. Beneath, a full
   width bar: "Not sure what to choose?" with a crimson "Take the 2 minute Health Score quiz".
8. **Meet our medical experts.** Three doctor cards with photo, name, qualification and years of
   experience. Use the three on the live site. Add a "View all doctors" link.
9. **Doctor-designed care kits.** Four kit cards in a two by two grid: Stress and Sleep Balance
   Kit, Women's Hormone Balance Kit, Men's Performance Kit, Weight Management Kit. Each with a
   product photo, a one line benefit, a price, and a Buy now button.
10. **Why people trust us.** AYUSH Approved, GMP Certified, Verified Doctors, as crisp equal
    sized badges.
11. **Results band.** Full width near black berry. "Real people. Real progress." Four stats:
    40% better sleep, 30% improved energy, 25% reduced stress, better digestion stamina and
    hormonal balance. Add one line under it: "Self reported by patients after 12 weeks."
12. **Featured in.** The live site renders this heading over an empty space. Either fill it with
    the four press logos actually used on the Health Score page (Healthcare, The Week, United
    News of India, siliconindia), or delete the section. Do not leave it empty.
13. **FAQ.** Six rows, first one open. How can I start my care plan? Is my information
    confidential? Are the products safe? Is my treatment plan customised to my needs? Do I have
    to pay for the doctor consultation? Are medications part of the programme?
14. **Blogs.** Three latest posts as cards with thumbnail, title, date and read time.
15. **Footer.** As the live site, which already works: logo and the line "India's first
    integrated digital health clinic. Your trusted partner for authentic Ayurvedic wellness
    solutions.", phone, email, address, then Quick links, Support and Company columns, social
    icons, and the copyright bar. Add a medical disclaimer line above the copyright: "These
    products are not intended to diagnose, treat, cure or prevent any disease. Speak to your
    doctor before starting any supplement."

### Mobile

Same sections and identical copy at 390. Header collapses to logo, search, cart and a
hamburger. Hero stacks with the headline at 32 and full width buttons. Three and four column
grids become two columns, or one where the card needs the width. The conditions grid becomes
two by four. Care kits stack one per row. Stats become a two by two grid.

### Copy rules for every prompt in this project

Plain hyphens, never em dashes. Indian English, plain and direct. No hype words. Never promise
a cure. Sentence case for headings, not Title Case For Every Word. Keep claims to the ones
given.

---

## PROMPT 2 - For Him, For Her, Combos

**Attach:** the For Him, For Her and Combos screenshots.

Redesign these three audience landing pages using the system from the home page. Three
artboards at 1440, plus one mobile artboard at 390 for For Him as the pattern for all three.

These three pages are currently the weakest on the site. Two problems.

**First, the heroes are unrelated to each other and to the home page.** Purple on Combos, hot
pink on For Her, blue on For Him, each with its own layout. Replace all three with the single
hero pattern, changing only the tint (slate blue for him, rose for her, violet for combos), the
photo and the words.

**Second, the copy reads like machine translation and destroys credibility.** Replace it
exactly as follows.

**For Him.** Current headline "Manufactured For Masculine Prowess" becomes "Built for how men
actually live." Sub: "Stamina, weight and energy, handled by doctors who look at the whole
picture instead of one symptom." Buttons "Shop men's products" and "Take the free men's health
score". Section "Which area do you require assistance in?" becomes "What do you want to work
on?" with chips: Lasting longer, Stronger erections, More energy, Losing weight, Better sleep,
Hormonal balance. "Shop by Category" keeps its name, with three tiles: Sexual wellness "Better
control, better confidence", Weight management "Backed by science, safe to use", Energy and
strength "Daily stamina, strength and focus". "The Integrated Solutions Come in Handy For Men"
becomes "How the three systems work together for men", using the same bento as the home page.
The three product rows are renamed: "Beneficial packs for intercourse" becomes "Sexual
performance", "Remedies For Weight Control" becomes "Weight management", "Energy & Daily
Wellness" stays. Each row keeps its left hand explainer panel, but rewrite the panel copy in
plain language.

**For Her.** Current headline "Having problems with exertion, hormonal issues, weight or sexual
issues?" becomes "Periods, hormones and weight, treated at the root." Sub: "India's first
digital clinic where Ayurveda, Homeopathy and Modern Medicine doctors build one plan together."
Buttons "Start free assessment" and "Talk to a doctor". "What problems do you need help with
today?" is good, keep it, with chips: Irregular periods, Painful cramps and PMS, Heavy or
missed periods, Period bloating, PCOS or PCOD, Unwanted facial hair, Trouble losing weight,
Stubborn belly fat. "Pick up your products according to the sections" becomes "Shop by what you
need", with two tiles: "Period and PCOS care" and "Weight management". Product rows: Period
care, and Weight management.

**Combos.** Headline "Save more. Perform better." is fine, keep it. Sub: "Doctor-crafted combos
that work better together, and save you up to 45 percent." "Choose your goal" keeps its three
cards. "Why our combos work" keeps its chips but set them on one consistent row rhythm rather
than the current ragged two rows.

**Fix the carousels.** Several rows currently hold one or two products but still show carousel
arrows on both sides, which reads as broken. Rule: fewer than four products means a static
centred grid with no arrows. Four or more means a carousel. Apply this everywhere.

All three pages end with the same three modules as the home page: trust badges, FAQ, footer.
Use the identical component, not a variation.

---

## PROMPT 3 - Product page and lead capture popup

**Attach:** the product page screenshot and the popup screenshot.

Redesign the product page as two artboards, 1440 and 390, plus one artboard for the lead
capture popup at 960 by 620.

The example product is Pure Himalayan Shilajit Resin, 20g, at Rs. 1,349 reduced from Rs. 2,309,
rated 4.88 from 8 reviews.

**Fix these specific problems from the live page.**

1. The heading currently reads "Pure Himalayan Shilajit Resin - 20g | SehatUP". The SEO title
   is leaking into the page. The heading should be the product name and size only.
2. Action hierarchy is inverted. "Add to cart" is a white outline while "Buy now" is solid red.
   Make "Add to cart" the solid crimson primary, full width, and "Buy now" the secondary
   beneath it.
3. A black "Still confused? Get free consultation" bar cuts across the layout. Make it a calm
   inline card inside the buy box instead, on the pale pink wash.
4. The gallery leads with a marketing banner that has text baked into the image. Lead with a
   clean product photograph on a plain background, and move the banner to a later slot.

**Above the fold on desktop:** breadcrumb, then two columns. Left, a large square gallery with
four thumbnails beneath. Right, a 520 buy box containing the category eyebrow, the product
name, the star rating with an "8 reviews" link, the price row with Rs. 1,349 large, Rs. 2,309
struck through, a discount chip and "Taxes included. Shipping calculated at checkout.", a
quantity stepper, a pincode field labelled "Estimated delivery time" with a Check button, a
pack selector with "Pack of 1" and "Pack of 2, get a free shaker", a prepaid offer strip
reading "FREE Ashwagandha sample, 30 tabs", the primary and secondary buttons, a three item
trust strip (Free shipping, Fast delivery, 100% natural), and the free consultation card.

**Below the fold, in order:** tabbed Description, Benefits and How to use. A product story band.
Customer reviews with the 4.88 summary, distribution bars, a Write a review button, customer
photos, and four review cards. Video testimonials. FAQ. Four related products. Footer.

**Mobile:** gallery swipes with dots, buy box stacks, and a sticky bottom bar holds the price
and Add to cart.

**Popup.** Keep the current concept, which works: a doctor photograph on a crimson gradient at
left, form at right. Eyebrow "TRUSTED BY THOUSANDS OF HAPPY PATIENTS", heading "Start your
health journey today", sub "Get personalised guidance from our expert doctors across Modern
Medicine, Ayurveda and Homeopathy." Fields: Full name, Mobile number, Age, Email (optional),
City. Crimson "Get free consultation" button. Reassurance line "Your details are safe with us.
No spam. Only health guidance." Over the photo, four ticks: Experienced and verified doctors,
Modern Medicine Ayurveda and Homeopathy, Your privacy is always protected, Care tailored just
for you.

Important: the live site shows this popup at the same time as a WhatsApp float and a floating
video reel. Design for **one** floating element at a time. Show the WhatsApp button as the
resting state, and the popup as an interruption that hides it.

---

## PROMPT 4 - Health Score 360 and About Us

**Attach:** the Health Score 360 and About Us screenshots.

Redesign both pages using the same system. Two desktop artboards at 1440, plus a mobile
artboard for Health Score 360.

**Health Score 360** is the main lead magnet, so it should be the most persuasive page on the
site. Keep the structure, fix these:

1. The "What is Health Score 360?" cards repeat the same sentence twice. Weight, Sexual
   wellness and Period care currently all describe metabolism and weight. Write three distinct
   lines: Weight, "Metabolism, energy patterns and what is driving the gain." Sexual wellness,
   "Performance, desire and the hormones behind both." Period care, "Cycle health, PMS signals
   and hormonal patterns."
2. Give the page the standard hero pattern instead of its current bare white opening.
3. Keep the two gendered quiz entry cards, the four step How it works, the Why it matters panel
   with the 360 graphic, the privacy block, the integrated treatment bento, the goal band, the
   press logos and the closing crimson CTA. Tighten spacing so the rhythm matches the home page.

**About Us.** Keep the narrative, which is genuinely good. Hero "Healthcare that finally makes
sense." Then the guesswork problem, the triple system model, what makes sehatUP different, the
founding story, Meet the founders (Karan Bhargava, Founder and CEO; Amit Singh Sandhu,
Co-founder and CMO), Our commitment, the founder videos, and the closing CTA band. One fix: the
bento on this page currently renders with an empty white cell. Make it a complete four cell
grid.

---

## PROMPT 5 - Blog index, blog article, and policy pages

**Attach:** the blog index, blog article and shipping policy screenshots.

Three desktop artboards at 1440 plus one mobile artboard for the article.

**Blog index.** The current three column card grid is close to right. Keep it. Improve: give
cards equal height regardless of title length, move the author and date onto one muted line,
make "Read more" a text link with an arrow rather than a heavy black button, and add a category
filter row above the grid (All, Men's health, Women's health, Weight, Sleep and stress,
Ayurveda explained). Keep the pagination.

**Blog article.** Set the body in a single 720 wide column for readability. Add a sticky table
of contents on the left at desktop, and a reading progress bar. Byline row with author, date
and read time. Pull quotes for the key claims. Keep the FAQ accordion at the end. After it, add
a related products strip, because the article is about weight and cortisol and you sell for
that, then three related posts, then the footer.

Note: the live article heading renders a literal `&amp;` instead of an ampersand. Show it
correctly as "Weight isn't about calories: it's cortisol, sleep and hormones too".

**Policy page template.** One template that serves shipping, privacy, refund and terms. The
current page is an unstructured wall of text that contradicts itself, quoting both "7 to 10
business days" and "3-7 business days" for the same thing. Design for clarity: a page title, a
"Last updated" line, a sticky contents list on the left linking to each section, body text at
680 wide, clear H2 rules between sections, properly rendered bullet lists (the live page shows
empty bullets with the text orphaned below), and a contact block at the end. Add a short plain
language summary box at the top, three or four bullets, above the formal text.

---

## OPTIONAL PROMPT 6 - A second colourway, only if you still want it

Do this last, and only after the pages above are settled. Duplicate the home page desktop
artboard and re-skin it as a calmer clinical alternative: deep green `#14584A` primary, darker
green `#0E4238` for dark bands, teal `#1F8A7A` for accents, pale green `#E7F0EC` and warm sand
`#F7F2EA` for tinted sections. Crimson survives only on primary buttons and sale prices.
Increase section padding from 88 to 104 and drop headings from Bold to SemiBold. Structure and
copy stay identical, which is the point of the comparison.

---

## Appendix - theme bugs to fix in code, not in the design

These are defects in the live Shopify theme. A redesign does not fix them, so they need
separate tickets.

1. Home page "Featured In" section renders a heading over empty space.
2. Health Score 360: the Weight and Sexual Wellness cards contain identical description text.
3. Blog article H1 outputs a literal `&amp;`, a double-escaped HTML entity.
4. Product page H1 includes the SEO suffix "| SehatUP".
5. Shipping policy states two different delivery windows, 7 to 10 business days and 3 to 7
   business days, and opens with meaningless boilerplate about capitalised letters.
6. Product carousels render navigation arrows even when holding a single item.
7. WhatsApp float, floating video reel and lead popup can all display simultaneously.
8. Trust badges are low resolution raster images, and should be SVG.
