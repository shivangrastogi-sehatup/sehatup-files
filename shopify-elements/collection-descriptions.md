# Collection descriptions - SehatUP

Paste each into **Shopify admin → Products → Collections → [collection] → Description**.

Your theme already renders this field (`collection-hero__description` is in the live
markup), and the `CollectionPage` schema picks it up automatically, HTML stripped and
capped at 400 characters. The first sentence is what gets truncated into search
results, so it carries the meaning.

---

## Customer-facing collections

### All Products - `/collections/all-products` (34 products)

> Every SehatUP formulation in one place - ayurvedic supplements, daily wellness
> essentials and doctor-designed kits for men and women. Browse the full range, or
> use the category collections to narrow down by concern: energy and stamina, weight
> management, period care, or hormonal balance. Each product is formulated by our
> medical team and manufactured to AYUSH standards.

### Best Sellers - `/collections/best-sellers` (6 products)

> The products our customers reorder most. Pure Himalayan Shilajit Resin, Shilajit
> Honey Sticks, Garcinia Cambogia Drops and our Daily Energy & Stamina Support Kit
> lead the range - chosen for consistent results across energy, stamina and weight
> goals. If you are new to SehatUP and unsure where to start, start here.

### Combos - `/collections/combos` (15 products)

> Doctor-designed kits that combine several SehatUP products into one routine. Each
> combo is built around a single goal - performance, energy and stamina, weight
> management, or period and hormonal care - so the right products arrive together in
> the right doses. Better value than buying separately, and no guesswork about what
> pairs with what.

### Overall Wellness - `/collections/overall-wellness` (7 products)

> Daily ayurvedic support for energy, stamina and everyday vitality. Includes Pure
> Himalayan Shilajit Resin, Ashwagandha Tablets, Vaji Bati, Kern Drops and Zencal
> D3K2 - formulations for men and women who want to feel steadier through the day,
> recover better, and hold their focus. Suitable for long-term daily use as directed.

### Her Care - `/collections/her-care` (3 products)

> Everyday care formulated for women - HormoniHerb Blue Tea for hormonal balance,
> Zencal D3K2 for bone strength and vitamin D support, and Aloezy Intimate Foam Wash
> for gentle intimate hygiene. Made to sit alongside your existing routine rather
> than replace it, with guidance from our doctors included.

### Period Care - `/collections/period-care` (3 products)

> Support for irregular cycles, cramps and the days around your period. Her Menses
> works on rhythmic relief and hormonal harmony, HormoniHerb Blue Tea supports
> hormonal balance day to day, and Aloezy Intimate Foam Wash keeps intimate hygiene
> gentle through your cycle. Our doctors help you build the routine that fits your
> pattern.

### Sexual For Her - `/collections/sexual-for-her` (2 products)

> Ayurvedic support for women's intimate wellness and desire. A focused selection
> formulated by our medical team, intended to be taken as part of a wider routine
> covering hormonal balance, energy and sleep. Free doctor consultation is included
> with every order, so you can ask before you buy.

### Sexual For Him - `/collections/for-him` (12 products)

> Ayurvedic formulations for men's intimate wellness - stamina, drive and confidence.
> The range covers daily support as well as our Confidence & Performance Booster Kit
> for men who want a complete routine. Every order includes a free consultation with
> our doctors, who will tell you what suits your history and what does not.

### Weight Management - `/collections/women-weight` (5 products)

> Support for slow metabolism, stubborn weight and cravings. Slimtox Energy Tea,
> Garcinia Cambogia Drops, Zencal D3K2 and Diaboglob work on different parts of the
> problem - energy, appetite, and how your body handles sugar. Our doctors build the
> combination around your history rather than handing everyone the same plan.

### Weight For Her - `/collections/weight-for-her` (7 products)

> Weight support formulated for women, where hormones, thyroid and cycle all affect
> results. Includes Slimtox Energy Tea, Thyrostatin 3X, Garcinia Cambogia Drops and
> our Weight Management Kit for Women. Every plan starts with a free consultation, so
> the routine accounts for what is actually driving the weight rather than treating
> it as calories alone.

### Weight For Him - `/collections/weight-for-him` (6 products)

> Weight support for men - metabolism, appetite control and stubborn belly fat.
> Includes LeanRoutine, Garcinia Cambogia Drops, Thyrostatin 3X and our Weight
> Management Kit for Men. Built for men who train or work long hours and want a
> routine that survives a real schedule. Free doctor consultation with every order.

### Weight Loss Packs - `/collections/weight-loss-packs` (2 products)

> Complete weight management kits for men and women, with everything needed for a
> full routine in one order. Each pack pairs the core formulations with dosage
> guidance from our doctors, so you are not assembling a plan yourself. Choose the
> men's or women's kit depending on which pattern fits you.

### Hormone Balance Kit - `/collections/hormone-balance-kit` (1 product)

> Our Natural Period Care & Hormonal Wellness kit, built for irregular cycles, PCOS
> symptoms and the mood and skin changes that come with hormonal imbalance. Combines
> the formulations our doctors most often prescribe together, with a consultation
> included so the dosage fits your cycle.

### Men's Performance Kit - `/collections/mens-performance-kit` (1 product)

> The Confidence & Performance Booster Kit - our complete routine for men working on
> stamina, drive and confidence. Everything arrives together with dosage guidance,
> and a free consultation with our doctors so you start with a plan rather than a
> guess.

### Stress and Sleep Kits - `/collections/stress-and-sleeep-kits` (2 products)

> Support for stress, poor sleep and the fatigue that follows. Built around our Daily
> Energy & Stamina Support Kit, which combines ayurvedic adaptogens for people whose
> energy dips through the afternoon and whose sleep does not fully restore. Free
> doctor consultation included with every order.

---

## Do not write descriptions for these

### `disable-cod` and `free-prepaid` - 0 products each

These are operational collections driving your COD and prepaid logic, not pages for
customers. They currently return empty, indexable pages at
`/collections/disable-cod` and `/collections/free-prepaid`.

Add a `noindex` to them instead. In `layout/theme.liquid`, the robots block already
handles search and cart; extend it:

```liquid
{% if template contains 'search' or template contains 'cart'
   or collection.handle == 'disable-cod' or collection.handle == 'free-prepaid' %}
  <meta name="robots" content="noindex, nofollow">
{% else %}
  <meta name="robots" content="index, follow">
{% endif %}
```

### `frontpage` - "Home page", 6 products

A theme utility collection that feeds your homepage. It is reachable at
`/collections/frontpage` and duplicates content that already lives on the homepage.
Add it to the same noindex rule above.
