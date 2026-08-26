# Sitemap and robots.txt - sehatUP

Checked live on 25 August 2026.

---

## 1. Is the XML sitemap updated automatically?

**Yes. Confirmed.** Shopify generates and maintains it. Nothing is manual, and it
cannot be edited.

Sitemap index: **https://www.sehatup.com/sitemap.xml**

It splits into five child sitemaps:

| Child sitemap | URLs | Newest lastmod |
| --- | --- | --- |
| `sitemap_products_1.xml` | 36 | 2026-08-25 11:24 |
| `sitemap_pages_1.xml` | 25 | 2026-04-15 14:31 |
| `sitemap_collections_1.xml` | 18 | 2026-08-24 18:34 |
| `sitemap_blogs_1.xml` | 31 | 2026-08-25 11:23 |
| `sitemap_agentic_discovery.xml` | - | AI agent discovery, Shopify-generated |

The products and blogs sitemaps carry a `lastmod` from earlier the same day the check
was run, which is the direct evidence that regeneration is live rather than cached.

### What that means in practice

- Add, edit or delete a product, collection, page or blog post and the sitemap picks
  it up automatically, usually within minutes.
- Unpublishing an item from the Online Store sales channel removes it from the
  sitemap.
- There is **no way to add, remove or reorder URLs manually**. Shopify does not expose
  the sitemap for editing, and no app can change it. The only lever is publish status
  on the item itself.
- `changefreq` and `priority` are not included by Shopify. Google ignores both anyway.

Submitted in Search Console as `sitemap.xml`. Only the index needs submitting; Google
follows the children itself.

---

## 2. Current robots.txt

Live file attached as **`robots.txt`** in this folder. Also at
**https://www.sehatup.com/robots.txt**

This is Shopify's auto-generated default. No custom rules have been added.

### What it already handles

The default is well-tuned and already blocks the usual crawl traps:

- `/checkout`, `/checkouts/`, `/cart/`, `/orders`, `/account` - transactional pages
- `/collections/*sort_by*` - sort parameter duplicates
- `/collections/*filter*&*filter*` - multi-filter combinations
- `/collections/*+*` and encoded variants - tag-combination URLs
- `/*?*preview_theme_id=*` - theme preview URLs
- `/services`, `/sf_*` - Shopify internals
- `/cart.js`, `/recommendations/products` - AJAX endpoints

It declares the sitemap on the last line:

```
Sitemap: https://www.sehatup.com/sitemap.xml
```

### Can it be edited?

Yes. Shopify allows a custom `robots.txt` through the theme:

**Online Store → Themes → Edit code → Templates → Add a new template →
select `robots.txt` → creates `robots.txt.liquid`**

That template starts by rendering Shopify's default rules, and rules can be added or
removed around it.

**Recommendation: leave it alone unless there is a specific reason.** The default
covers the standard e-commerce crawl traps. Editing it is the most common way stores
accidentally deindex themselves, and Shopify will not warn before it happens.

Note that search and cart pages are already handled outside robots.txt: `theme.liquid`
outputs `<meta name="robots" content="noindex, nofollow">` on those templates.

---

## 3. One finding worth acting on

Three collections are in the sitemap that should not be indexed:

```
https://www.sehatup.com/collections/frontpage
https://www.sehatup.com/collections/disable-cod
https://www.sehatup.com/collections/free-prepaid
```

- **`disable-cod`** and **`free-prepaid`** hold **zero products**. They exist to drive
  COD and prepaid logic, not to be browsed. They currently render as empty, indexable,
  crawlable pages.
- **`frontpage`** is the theme's homepage collection. It duplicates content already on
  the homepage.

### Cleanest fix

For `disable-cod` and `free-prepaid`, **remove Online Store from their sales channel
availability** in Shopify admin. That drops them from the sitemap and makes the URLs
return 404. Check first with whoever configured the COD rules that nothing depends on
the public storefront URL - most such setups key off the collection through the Admin
API, which keeps working when unpublished.

For `frontpage`, unpublishing is not an option because the homepage uses it. Add a
`noindex` instead, in `layout/theme.liquid`, extending the robots block already there:

```liquid
{% if template contains 'search' or template contains 'cart'
   or collection.handle == 'frontpage' %}
  <meta name="robots" content="noindex, nofollow">
{% else %}
  <meta name="robots" content="index, follow">
{% endif %}
```

Search Console will then flag `frontpage` as "Submitted URL marked noindex". That
warning is expected and harmless when the noindex is deliberate, since Shopify will not
let the URL out of the sitemap.
