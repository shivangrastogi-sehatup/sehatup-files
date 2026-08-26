# How to verify the sitemap updates automatically

Companion to `sitemap-and-robots.md`. Verified live on **26 August 2026**.

**Short answer: yes, it updates automatically and in real time.** Shopify generates it on
every request. It cannot be edited, cached manually, or fall behind.

Read the section on `lastmod` before using timestamps as evidence of anything.

---

## Important: `lastmod` on the products sitemap means nothing

This trips people up, so deal with it first.

Every product in `sitemap_products_1.xml` carries **the same `lastmod`, equal to the
moment you requested the file**. It is a generation timestamp, not a record of when the
product changed.

Proof, from a single request:

```
HTTP Date header : Wed, 26 Aug 2026 06:09:18 GMT   =  11:39:18 IST
lastmod (all 36) : 2026-08-26T11:39:18+05:30       =  11:39:18 IST
```

Identical to the second. Request it again ten minutes later and every product reports
the new time. The public `products.json` endpoint behaves the same way, returning one
`updated_at` for all 35 products equal to request time.

### This is Shopify, not sehatUP

Checked against an unrelated Shopify store as a control:

| Store | Products | Distinct `lastmod` values | Value |
| --- | --- | --- | --- |
| sehatup.com | 36 | **1** | request time |
| allbirds.com | 294 | **1** | request time, 7s before the request |
| gymshark.com | 2082 | 0 | no `lastmod` emitted at all |

Nothing is misconfigured, no app is rewriting products, and there is nothing to fix.
It is how the platform emits this file.

### Consequence

Google's guidance is that `lastmod` should reflect a meaningful content change. Here it
never does, so Google discounts it for this sitemap and falls back to its own crawl
scheduling. That is normal for Shopify stores and not worth escalating.

**Do not use products-sitemap `lastmod` as evidence of freshness, in either direction.**
A recent timestamp does not mean a product changed, and it never goes stale.

### The other three sitemaps are fine

`pages`, `collections` and `blogs` all carry genuine per-URL modification times:

| Child sitemap | URLs | Distinct `lastmod` values | Newest | Oldest |
| --- | --- | --- | --- | --- |
| `sitemap_products_1.xml` | 36 | 1 (meaningless) | request time | request time |
| `sitemap_pages_1.xml` | 25 | 25 | 2026-04-15 14:31 | 2025-01-30 11:40 |
| `sitemap_collections_1.xml` | 18 | 13 | 2026-08-25 16:47 | 2026-02-02 16:48 |
| `sitemap_blogs_1.xml` | 31 | 31 | 2026-08-25 18:04 | 2026-08-24 16:37 |

Blogs updating across 24 to 25 August matches the recent publishing batch. This is the
real evidence that regeneration is live.

---

## Demonstration A: products, by URL presence

Because timestamps are useless for products, prove it with **which URLs are listed**.

1. Open the products sitemap and count the entries. Today: **36** (35 products plus the
   homepage).
   `https://www.sehatup.com/sitemap_products_1.xml?from=10478503625007&to=16108896616751`

2. In Shopify admin, open any product → **Publishing** → remove **Online Store** from
   its sales channels. Save.

3. Wait about a minute, return to the sitemap and **hard-reload** with
   `Ctrl + Shift + R`. A normal reload can serve a cached copy.

4. That product's `<loc>` is gone and the count is 35.

5. Re-add Online Store, hard-reload again, and it comes back.

Creating a new product and watching it appear works equally well.

---

## Demonstration B: blogs or pages, by timestamp

For these, `lastmod` is real, so the timestamp test is valid.

1. Open `https://www.sehatup.com/sitemap_blogs_1.xml` and note a post's `<lastmod>`.

2. In Shopify admin, open that post, make a trivial edit, **Save**.

3. Wait a minute, hard-reload the sitemap.

4. That post's `<lastmod>` now shows the time you saved. Its neighbours are unchanged,
   which is the part that makes this meaningful.

The neighbours staying put is what separates this from the products sitemap, where
everything moves at once regardless of what you did.

---

## Cross-check in Google Search Console

Confirms Google is actually reading the file, which the sitemap cannot tell you itself.

- **Indexing → Sitemaps** → the `sitemap.xml` row shows a **Last read** date and a
  discovered-URL count. A recent date means Google re-fetches on its own.
- **URL Inspection** on any product URL → **Page indexing** → **Referring sitemaps**
  should name `sitemap.xml`.

Only the index needs submitting. Google follows the five children itself.

---

## Command-line version

```bash
# The index
curl -s https://www.sehatup.com/sitemap.xml

# Show that products lastmod equals request time
curl -s -D - "https://www.sehatup.com/sitemap_products_1.xml?from=10478503625007&to=16108896616751" \
  -o body.xml | grep -i '^date:'
grep -oE '<lastmod>[^<]+' body.xml | sort -u

# Blogs: genuine per-URL timestamps
curl -s https://www.sehatup.com/sitemap_blogs_1.xml > b.xml
grep -oE '<lastmod>[^<]+' b.xml | sort -u | wc -l   # 31 distinct values
```

---

## Summary for the handover

- The sitemap **is** maintained automatically and in real time. Confirmed.
- It cannot be edited manually. No app can change it. The only lever is publish status.
- Products-sitemap `lastmod` is a generation timestamp and carries no information.
  This is Shopify-wide behaviour, verified against another store. Not a defect here.
- Pages, collections and blogs carry genuine timestamps and are the place to look for
  real freshness evidence.
- The outstanding action item is still the one in `sitemap-and-robots.md`: the
  `frontpage`, `disable-cod` and `free-prepaid` collections should not be indexed.
