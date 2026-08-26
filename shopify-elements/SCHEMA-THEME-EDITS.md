# Schema markup — direct theme file edits (no extra snippet)

## 0. FIRST — check Tapita. Do not skip this.

Line 2 of `layout/theme.liquid` is:

```liquid
{%- if content_for_header contains 'tapita-seo-script-tags' -%}{%- include 'tapita-seo-schema' -%}{%- endif -%}
```

The **Tapita SEO** app is installed and already has a structured-data hook in the
theme. Before writing anything, find out what it currently emits:

1. Open a live **product** page → right-click → View page source → Ctrl+F for
   `application/ld+json`. Count the blocks and note their `"@type"` values.
2. Do the same on the **homepage**, a **blog article**, and the **FAQ page**.
3. Open Edit code → `snippets/tapita-seo-schema.liquid` to see the source.

Then pick a lane:

| What you find | Do this |
|---|---|
| Tapita emits Product / Article / FAQ / Organization | **Use the Tapita app UI** — Apps → Tapita SEO → Structured Data / Rich Snippets. That is your single place to update all schemas. No code. Skip files 1–5 below. |
| Tapita emits nothing, or only Organization | Turn Tapita's structured data **off** completely so it can never conflict, then do files 1–5 below |
| Tapita emits some types only | Turn Tapita's structured data **off** completely and do files 1–5 (partial coverage from two sources is what creates duplicates) |

Never run Tapita's schema and the hand-written schema at the same time.
Two `Product` blocks on one page = invalid, and Google may drop rich results.

---

Every block below goes into the theme file itself. Method for each file:

1. Shopify Admin → Online Store → Themes → ⋯ → **Duplicate** (work on the copy)
2. ⋯ → **Edit code** → open the file
3. Ctrl+F for `application/ld+json`
4. Select the whole existing `<script type="application/ld+json"> … </script>` and replace
   it with the block below. If the file has none, paste at the position noted.
5. Save

Files to touch, in order:

| # | File | Emits | Existing schema in it? |
|---|------|-------|---|
| 1 | `layout/theme.liquid` | Organization + WebSite (sitewide) | **None** — confirmed, paste new |
| 2 | `sections/main-product.liquid` | Product + Offer + AggregateRating + Breadcrumb | check for `ld+json` |
| 3 | `sections/main-article.liquid` | BlogPosting + Breadcrumb | check for `ld+json` |
| 4 | `sections/main-collection-product-grid.liquid` | CollectionPage + Breadcrumb | usually none |
| 5 | `sections/collapsible-content.liquid` (your FAQ section) | FAQPage | none |

The `@id` values tie them together — Product in file 2 points at the Organization
defined in file 1. Same page, so Google resolves it. That is why business details are
entered **once**, in `theme.liquid`, and never repeated.

---

## 1. `layout/theme.liquid`

Your file has **no** `application/ld+json` — Dawn's default `WebSite` block was removed
at some point. So this is a fresh paste, not a replace.

**Exact spot:** scroll to the bottom of the `<head>`. You will see these two lines:

```liquid
    <script src="https://unpkg.com/spf-analytics@1.0.0/index.js" defer></script>
</head>
```

Paste the block below **between them** — after the spf-analytics script, before
`</head>`. It must be after `{{ content_for_header }}`, which it is.

**Edit the CONFIG lines — this is the only place you enter business details.**

```liquid
{%- liquid
  assign biz_name       = 'SehatUp'
  assign biz_logo       = 'logo.png'
  assign biz_phone      = '+91-XXXXXXXXXX'
  assign biz_email      = 'support@sehatup.com'
  assign biz_street     = 'Street address'
  assign biz_city       = 'City'
  assign biz_region     = 'State'
  assign biz_zip        = '000000'
  assign biz_country    = 'IN'
  assign social_urls    = 'https://www.instagram.com/sehatup,https://www.facebook.com/sehatup,https://www.youtube.com/@sehatup'
-%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": {{ shop.url | append: '/#organization' | json }},
      "name": {{ biz_name | json }},
      "url": {{ shop.url | json }},
      "logo": {
        "@type": "ImageObject",
        "url": {{ biz_logo | file_img_url: '600x' | prepend: 'https:' | json }}
      },
      "contactPoint": [{
        "@type": "ContactPoint",
        "telephone": {{ biz_phone | json }},
        "email": {{ biz_email | json }},
        "contactType": "customer service",
        "areaServed": "IN",
        "availableLanguage": ["en", "hi"]
      }],
      "address": {
        "@type": "PostalAddress",
        "streetAddress": {{ biz_street | json }},
        "addressLocality": {{ biz_city | json }},
        "addressRegion": {{ biz_region | json }},
        "postalCode": {{ biz_zip | json }},
        "addressCountry": {{ biz_country | json }}
      },
      "sameAs": [
        {%- assign socials = social_urls | split: ',' -%}
        {%- for s in socials -%}
          {%- unless forloop.first %},{% endunless %}{{ s | strip | json }}
        {%- endfor -%}
      ]
    },
    {
      "@type": "WebSite",
      "@id": {{ shop.url | append: '/#website' | json }},
      "url": {{ shop.url | json }},
      "name": {{ biz_name | json }},
      "publisher": { "@id": {{ shop.url | append: '/#organization' | json }} },
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": {{ shop.url | append: '/search?q={search_term_string}' | json }}
        },
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
</script>
```

---

## 2. `sections/main-product.liquid`

Near the bottom of the file Dawn has either `{{ product | structured_data }}` or a
hand-written Product JSON inside a `<script type="application/ld+json">`. Replace the
whole script tag with the two below. **Edit the 4 shipping/return lines.**

```liquid
{%- liquid
  assign ship_min_days = 2
  assign ship_max_days = 7
  assign ship_cost     = 0
  assign return_days   = 7

  assign v   = product.selected_or_first_available_variant
  assign cur = cart.currency.iso_code
  assign rating       = product.metafields.reviews.rating
  assign rating_count = product.metafields.reviews.rating_count
  assign has_rating = false
  if rating_count != blank and rating_count.value > 0 and rating != blank
    assign has_rating = true
  endif
-%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": {{ product.url | prepend: shop.url | append: '#product' | json }},
  "name": {{ product.title | json }},
  "description": {{ product.description | strip_html | strip_newlines | truncate: 500 | json }},
  "url": {{ product.url | prepend: shop.url | json }},
  "sku": {{ v.sku | default: product.id | json }},
  {%- if v.barcode != blank %}
  "gtin": {{ v.barcode | json }},
  {%- endif %}
  "brand": { "@type": "Brand", "name": {{ product.vendor | default: shop.name | json }} },
  {%- if product.type != blank %}
  "category": {{ product.type | json }},
  {%- endif %}
  "image": [
    {%- for img in product.images limit: 5 -%}
      {%- unless forloop.first %},{% endunless -%}
      {{ img | image_url: width: 1600 | prepend: 'https:' | json }}
    {%- endfor -%}
  ],
  {%- if has_rating %}
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": {{ rating.value.rating }},
    "bestRating": {{ rating.value.scale_max | default: 5 }},
    "worstRating": {{ rating.value.scale_min | default: 1 }},
    "reviewCount": {{ rating_count.value }}
  },
  {%- endif %}
  "offers": {
    {%- if product.variants.size > 1 %}
    "@type": "AggregateOffer",
    "offerCount": {{ product.variants.size }},
    "lowPrice": {{ product.price_min | divided_by: 100.0 }},
    "highPrice": {{ product.price_max | divided_by: 100.0 }},
    "priceCurrency": {{ cur | json }},
    "availability": {% if product.available %}"https://schema.org/InStock"{% else %}"https://schema.org/OutOfStock"{% endif %},
    "url": {{ product.url | prepend: shop.url | json }},
    "seller": { "@id": {{ shop.url | append: '/#organization' | json }} }
    {%- else %}
    "@type": "Offer",
    "price": {{ v.price | divided_by: 100.0 }},
    "priceCurrency": {{ cur | json }},
    "availability": {% if v.available %}"https://schema.org/InStock"{% else %}"https://schema.org/OutOfStock"{% endif %},
    "itemCondition": "https://schema.org/NewCondition",
    "url": {{ product.url | prepend: shop.url | json }},
    "priceValidUntil": {{ 'now' | date: '%Y' | plus: 1 | append: '-12-31' | json }},
    "seller": { "@id": {{ shop.url | append: '/#organization' | json }} },
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": { "@type": "MonetaryAmount", "value": {{ ship_cost }}, "currency": {{ cur | json }} },
      "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "IN" },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY" },
        "transitTime": { "@type": "QuantitativeValue", "minValue": {{ ship_min_days }}, "maxValue": {{ ship_max_days }}, "unitCode": "DAY" }
      }
    },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "IN",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": {{ return_days }},
      "returnMethod": "https://schema.org/ReturnByMail",
      "returnFees": "https://schema.org/FreeReturn"
    }
    {%- endif %}
  }
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": {{ shop.url | json }} }
    {%- if collection.title != blank -%}
    ,{ "@type": "ListItem", "position": 2, "name": {{ collection.title | json }}, "item": {{ collection.url | prepend: shop.url | json }} }
    ,{ "@type": "ListItem", "position": 3, "name": {{ product.title | json }} }
    {%- else -%}
    ,{ "@type": "ListItem", "position": 2, "name": {{ product.title | json }} }
    {%- endif -%}
  ]
}
</script>
```

---

## 3. `sections/main-article.liquid`

Dawn has an `"@type": "Article"` block at the bottom. Replace it.

```liquid
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "@id": {{ article.url | prepend: shop.url | append: '#article' | json }},
  "headline": {{ article.title | truncate: 110 | json }},
  "description": {{ article.excerpt_or_content | strip_html | strip_newlines | truncate: 300 | json }},
  "articleBody": {{ article.content | strip_html | strip_newlines | truncate: 2000 | json }},
  "url": {{ article.url | prepend: shop.url | json }},
  "mainEntityOfPage": { "@type": "WebPage", "@id": {{ article.url | prepend: shop.url | json }} },
  {%- if article.image %}
  "image": [{{ article.image | image_url: width: 1600 | prepend: 'https:' | json }}],
  {%- endif %}
  "datePublished": {{ article.published_at | date: '%Y-%m-%dT%H:%M:%S%z' | json }},
  "dateModified": {{ article.updated_at | default: article.published_at | date: '%Y-%m-%dT%H:%M:%S%z' | json }},
  "author": { "@type": "Person", "name": {{ article.author | default: shop.name | json }} },
  "publisher": { "@id": {{ shop.url | append: '/#organization' | json }} }
  {%- if article.tags.size > 0 %},
  "keywords": {{ article.tags | join: ', ' | json }}
  {%- endif %}
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": {{ shop.url | json }} },
    { "@type": "ListItem", "position": 2, "name": {{ blog.title | json }}, "item": {{ blog.url | prepend: shop.url | json }} },
    { "@type": "ListItem", "position": 3, "name": {{ article.title | json }} }
  ]
}
</script>
```

---

## 4. `sections/main-collection-product-grid.liquid`

No existing schema here — paste at the very **bottom of the file, before the
`{% schema %}` tag**. (Everything after `{% schema %}` is settings JSON, not markup.)

```liquid
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": {{ collection.title | json }},
  "description": {{ collection.description | strip_html | strip_newlines | truncate: 300 | json }},
  "url": {{ collection.url | prepend: shop.url | json }},
  "isPartOf": { "@id": {{ shop.url | append: '/#website' | json }} },
  "mainEntity": {
    "@type": "ItemList",
    "numberOfItems": {{ collection.products_count }},
    "itemListElement": [
      {%- for p in collection.products limit: 20 -%}
        {%- unless forloop.first %},{% endunless %}
        { "@type": "ListItem", "position": {{ forloop.index }}, "url": {{ p.url | prepend: shop.url | json }}, "name": {{ p.title | json }} }
      {%- endfor -%}
    ]
  }
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": {{ shop.url | json }} },
    { "@type": "ListItem", "position": 2, "name": {{ collection.title | json }} }
  ]
}
</script>
```

---

## 5. FAQ — `sections/collapsible-content.liquid`

This reads the FAQ accordion rows you already built in the theme editor, so there is
**no metafield to maintain** — edit the FAQ text in the customizer and the schema
follows. Paste at the bottom of the file, **before `{% schema %}`**.

If your FAQ section is a different file, open it, check its `{% schema %}` for the
block `"type"` and the text setting names, and swap `collapsible_row` / `heading` /
`row_content` below to match.

```liquid
{%- liquid
  assign faq_rows = 0
  for block in section.blocks
    if block.type == 'collapsible_row' and block.settings.heading != blank
      assign faq_rows = faq_rows | plus: 1
    endif
  endfor
-%}
{%- if faq_rows > 0 -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {%- assign printed = 0 -%}
    {%- for block in section.blocks -%}
      {%- if block.type == 'collapsible_row' and block.settings.heading != blank -%}
        {%- if printed > 0 %},{% endif %}
        {
          "@type": "Question",
          "name": {{ block.settings.heading | strip_html | json }},
          "acceptedAnswer": {
            "@type": "Answer",
            "text": {{ block.settings.row_content | strip_html | strip_newlines | json }}
          }
        }
        {%- assign printed = printed | plus: 1 -%}
      {%- endif -%}
    {%- endfor -%}
  ]
}
</script>
{%- endif -%}
```

---

## Before publishing

1. Preview the duplicated theme. Grab one **product**, one **blog article**, one
   **collection**, the **homepage**, and the **FAQ page** URL.
2. Run each through <https://validator.schema.org> and
   <https://search.google.com/test/rich-results>.
3. Expect **exactly one** Product entry per product page. If you see two, your review
   app (Judge.me / Loox) is also injecting Product schema — turn off its
   "rich snippets / SEO markup" setting, or delete the `aggregateRating` block from
   file 2.
4. Publish. Then watch **Search Console → Enhancements → Products / Merchant listings**
   over the next 1–2 weeks.

**Never hardcode a star rating you don't have** — the `aggregateRating` block above
only renders when real review data exists. Faking it gets a manual action that kills
rich results sitewide.
