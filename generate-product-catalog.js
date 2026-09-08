// generate-product-catalog.js
// Builds a print-ready HTML product catalog (image + title + description + prices)
// for ALL Shopify products. Open the generated PRODUCT_CATALOG.html in a browser
// and press Ctrl+P -> "Save as PDF" to get your PDF.
//
// This file is standalone. It does NOT modify fetch-product-table.js.
// No npm install required (uses only built-in https + fs).

const https = require('https');
const fs = require('fs');

const SHOPIFY_DOMAIN = '0ec320-gj.myshopify.com';
const ACCESS_TOKEN = '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';
const API_VERSION = '2026-01';

const OUTPUT_HTML = 'PRODUCT_CATALOG.html';

// --- Fetch one page of products, returning { products, nextPageInfo } ---
function fetchPage(pageInfo) {
  return new Promise((resolve, reject) => {
    let path = `/admin/api/${API_VERSION}/products.json?limit=250`;
    if (pageInfo) {
      // When paginating with page_info, only limit + page_info are allowed.
      path = `/admin/api/${API_VERSION}/products.json?limit=250&page_info=${encodeURIComponent(pageInfo)}`;
    }

    const options = {
      hostname: SHOPIFY_DOMAIN,
      path,
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Shopify API error: ${res.statusCode} - ${data}`));
        }

        // Parse the Link header to find the "next" page_info cursor.
        let nextPageInfo = null;
        const link = res.headers.link || res.headers.Link;
        if (link) {
          const match = link.split(',').find((s) => s.includes('rel="next"'));
          if (match) {
            const url = match.match(/<([^>]+)>/);
            if (url) {
              const pi = new URL(url[1]).searchParams.get('page_info');
              if (pi) nextPageInfo = pi;
            }
          }
        }

        resolve({ products: JSON.parse(data).products, nextPageInfo });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// --- Fetch every product across all pages ---
async function fetchAllProducts() {
  let all = [];
  let pageInfo = null;
  let page = 1;
  do {
    process.stdout.write(`\r🔄 Fetching products (page ${page})... total so far: ${all.length}`);
    const { products, nextPageInfo } = await fetchPage(pageInfo);
    all = all.concat(products);
    pageInfo = nextPageInfo;
    page++;
  } while (pageInfo);
  process.stdout.write('\n');
  return all;
}

// --- Escape plain text for safe HTML embedding ---
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Pick the best image URL for a product ---
function imageFor(p) {
  if (p.image && p.image.src) return p.image.src;
  if (p.images && p.images.length && p.images[0].src) return p.images[0].src;
  return null;
}

function money(n) {
  return '₹' + parseFloat(n).toFixed(2);
}

// --- Stock + flagged-ingredient detection -------------------------------
// Molecules worth calling out on the sheet. Substring match, case-insensitive.
const FLAGGED_INGREDIENTS = ['tadalafil', 'dapoxetine'];

// Shopify only actually blocks a sale when it is TRACKING inventory and the
// policy is to deny overselling. A variant with no inventory_management is
// untracked and always sellable, however its quantity reads.
function variantAvailable(v) {
  if (!v.inventory_management) return true;
  if (v.inventory_policy === 'continue') return true;
  return Number(v.inventory_quantity == null ? 0 : v.inventory_quantity) > 0;
}

// Out of stock only when every variant is unsellable.
function isOutOfStock(p) {
  const vs = p.variants || [];
  if (!vs.length) return false;
  return !vs.some(variantAvailable);
}

// Looks at title, variant names, tags, type and the description body, since
// the molecule is usually named in the ingredients block rather than the title.
function flaggedIn(p) {
  const hay = [
    p.title, p.body_html, p.tags, p.product_type, p.vendor,
    ...(p.variants || []).map((v) => v.title),
  ].join(' ').toLowerCase();
  return FLAGGED_INGREDIENTS.filter((w) => hay.includes(w));
}

// --- Strip Shopify section delimiters like [description], [benefits],
//     [how_to_use], [/ingredients], [details] etc., and remove the empty
//     paragraphs/spans they leave behind. ---
function cleanDescription(html) {
  if (!html) return html;
  let out = html;

  // 1. Remove the bracket delimiters themselves (lowercase words + underscores,
  //    optional leading slash): [description] [/description] [how_to_use] etc.
  out = out.replace(/\[\/?[a-z_]+\]/gi, '');

  // 2. Remove block elements (p / h1-h6) that are now empty or contain only
  //    whitespace, <br>, &nbsp;, or empty inline tags left behind.
  const emptyInline = '(?:\\s|&nbsp;|<br\\s*\\/?>|<span[^>]*>\\s*<\\/span>|<strong[^>]*>\\s*<\\/strong>|<em[^>]*>\\s*<\\/em>)*';
  out = out.replace(new RegExp(`<p[^>]*>${emptyInline}<\\/p>`, 'gi'), '');
  out = out.replace(new RegExp(`<h[1-6][^>]*>${emptyInline}<\\/h[1-6]>`, 'gi'), '');

  return out.trim();
}

// --- Build one product card ---
function cardHtml(p, index) {
  const v = (p.variants && p.variants[0]) || {};
  const sellingPrice = v.price != null ? parseFloat(v.price) : null;
  const mrp = v.compare_at_price ? parseFloat(v.compare_at_price) : sellingPrice;
  const discounted = sellingPrice != null ? sellingPrice * 0.9 : null;

  const img = imageFor(p);
  // Ask Shopify's CDN for a small rendition rather than shrinking the full-size
  // file in the browser: the catalog can run to hundreds of products.
  const thumbSrc = img ? img.replace(/(\.[a-z]+)(\?|$)/i, '_240x$1$2') : null;
  const imgTag = thumbSrc
    ? `<img class="product-img" src="${escapeHtml(thumbSrc)}" alt="${escapeHtml(p.title)}" loading="lazy" />`
    : `<div class="product-img no-img">No image</div>`;

  const oos = isOutOfStock(p);
  const flags = flaggedIn(p);
  const badges = [
    oos ? '<span class="badge badge-oos">Out of stock</span>' : '',
    ...flags.map((f) => `<span class="badge badge-rx">${escapeHtml(f[0].toUpperCase() + f.slice(1))}</span>`),
  ].filter(Boolean).join('');

  // Data attributes drive the card highlight in CSS: a flagged molecule that is
  // also unavailable is the combination worth spotting first.
  const state = [oos ? 'oos' : '', flags.length ? 'rx' : ''].filter(Boolean).join(' ');

  // body_html is real HTML from Shopify — clean out the [section] delimiters,
  // then render (fallback to a placeholder).
  const cleaned = cleanDescription(p.body_html);
  const description = (cleaned && cleaned.trim())
    ? cleaned
    : '<em class="muted">No description available.</em>';

  const showMrp = mrp != null && sellingPrice != null && mrp > sellingPrice;

  return `
  <article class="card"${state ? ` data-state="${state}"` : ''}>
    <div class="card-body">
      <div class="card-thumb">${imgTag}</div>
      <div class="card-index">#${index + 1}</div>
      <h2 class="product-title">${escapeHtml(p.title)}</h2>
      ${badges ? `<div class="badges">${badges}</div>` : ''}
      <div class="price-row">
        ${sellingPrice != null ? `<span class="price">${money(sellingPrice)}</span>` : ''}
        ${showMrp ? `<span class="mrp">${money(mrp)}</span>` : ''}
        ${discounted != null ? `<span class="off">10% off: ${money(discounted)}</span>` : ''}
      </div>
      <div class="description">${description}</div>
    </div>
  </article>`;
}

// --- Assemble the full HTML document ---
function buildHtml(products, droppedCount = 0) {
  const generatedAt = new Date().toLocaleString('en-IN');
  const cards = products.map((p, i) => cardHtml(p, i)).join('\n');
  const oosCount = products.filter(isOutOfStock).length;
  const rxCount = products.filter((p) => flaggedIn(p).length).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SehatUP Product Catalog</title>
<style>
  :root {
    --ink: #1a2b23;
    --muted: #6b7c74;
    --line: #e3e9e5;
    --brand: #1f7a53;
    --brand-soft: #eaf5ef;
    --off: #b8461f;
    --oos: #c2410c;
    --rx: #6d28d9;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--ink);
    background: #f6f8f7;
    line-height: 1.5;
  }
  .page-header {
    padding: 28px 40px;
    background: var(--brand);
    color: #fff;
  }
  .page-header h1 { margin: 0 0 4px; font-size: 26px; letter-spacing: .3px; }
  .page-header p { margin: 0; opacity: .85; font-size: 13px; }
  .page-summary { margin-top: 10px !important; display: flex; gap: 8px; flex-wrap: wrap; opacity: 1 !important; }
  .k {
    font-size: 11.5px; font-weight: 700;
    padding: 3px 10px; border-radius: 999px;
    background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.3);
  }
  .catalog {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    padding: 32px 40px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .card {
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  /* Floated, not a flex column: a flex row would reserve the image's full
     height beside a one-line title and leave a gap under it. Floating lets the
     title sit alongside and the copy reclaim the full width once it clears. */
  .card-thumb {
    float: right;
    margin: 0 0 10px 14px;
    width: 96px; height: 96px;
    display: flex; align-items: center; justify-content: center;
    background: var(--brand-soft);
    border-radius: 8px;
    padding: 6px;
    overflow: hidden;
  }
  .product-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
  }
  .no-img {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    text-align: center;
    color: var(--muted);
    font-size: 10px;
  }
  .card-body { padding: 16px 18px 20px; }
  /* Contain the floated thumbnail so a short product still gets a full-height card. */
  .card-body::after { content: ''; display: block; clear: both; }
  .card-index { font-size: 11px; color: var(--muted); font-weight: 600; margin-bottom: 2px; }
  .product-title { margin: 0; font-size: 17px; line-height: 1.3; }

  /* Highlights. A flagged molecule that is also unavailable gets both the
     stripe and the tinted head, so it reads first on a dense page. */
  .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .badge {
    font-size: 10.5px; font-weight: 700; letter-spacing: .02em;
    padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  }
  .badge-oos { background: #fdeceb; color: var(--oos); border: 1px solid #f6c9c4; }
  .badge-rx  { background: #f1ecfd; color: var(--rx);  border: 1px solid #d9cbf8; }

  .card[data-state~="oos"] { border-color: #f3c8c1; border-left: 4px solid var(--oos); }
  .card[data-state~="rx"]  { border-left: 4px solid var(--rx); }
  .card[data-state~="rx"][data-state~="oos"] {
    border-left: 4px solid var(--oos);
    background: #fffaf9;
  }
  .card[data-state~="oos"] .product-title { color: var(--oos); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .chip {
    font-size: 11px; padding: 2px 8px; border-radius: 999px;
    background: var(--brand-soft); color: var(--brand); font-weight: 600;
  }
  .price-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .price { font-size: 20px; font-weight: 700; color: var(--ink); }
  .mrp { font-size: 14px; color: var(--muted); text-decoration: line-through; }
  .off { font-size: 12px; color: var(--off); font-weight: 600; }
  .description { font-size: 13px; color: #374b41; }
  .description img { max-width: 100%; height: auto; }
  .description p:first-child { margin-top: 0; }
  .muted { color: var(--muted); }

  @page { size: A4; margin: 14mm 14mm 16mm; }

  @media print {
    body { background: #fff; font-size: 10.5pt; }

    /* Was a full page on its own; now a compact banner at the top of page 1. */
    .page-header {
      background: var(--brand) !important;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 8mm;
      /* Its own sheet, so every product starts at the top of a clean page. */
      break-after: page; page-break-after: always;
    }
    .page-header h1 { font-size: 17pt; }
    .page-header p { font-size: 8.5pt; }

    /* One product per sheet. */
    .catalog {
      display: block;
      padding: 0; max-width: none;
    }
    .card {
      break-inside: avoid; page-break-inside: avoid;
      break-after: page; page-break-after: always;
      border: none;
      border-radius: 0;
      box-shadow: none;
      margin: 0;
    }
    /* Without this the forced break after the final card emits a blank sheet. */
    .card:last-child { break-after: auto; page-break-after: auto; }
    .card-body { padding: 8px 12px 10px; }
    .card-thumb { width: 26mm; height: 26mm; margin-left: 8px; }
    .product-title { font-size: 12.5pt; }
    .price { font-size: 13pt; }
    .price-row { margin-bottom: 8px; }
    /* Tightened so the longest description still lands inside one sheet. */
    .description { font-size: 9pt; line-height: 1.45; }
    .description p { margin: 0 0 5px; }
    .description ul, .description ol { margin: 5px 0; padding-left: 18px; }
    .description li { margin-bottom: 2px; }
    .description h1, .description h2, .description h3, .description h4 {
      font-size: 10pt; margin: 8px 0 4px;
    }
    /* Keep a heading with the text under it rather than stranded at a page foot. */
    .product-title, .badges, .price-row { break-after: avoid; page-break-after: avoid; }
    .description h1, .description h2, .description h3,
    .description h4, .description strong {
      break-after: avoid; page-break-after: avoid;
    }
    .description p, .description li { orphans: 3; widows: 3; }

    /* The highlights are the point of the sheet, so force them to ink. On a
       mono printer the badge wording and the border still carry the meaning. */
    .chip, .badge, .card[data-state], .k {
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .card[data-state~="oos"] { border-left-width: 4px; }
  }
</style>
</head>
<body>
  <header class="page-header">
    <h1>SehatUP Product Catalog</h1>
    <p>${products.length} products &middot; Generated ${escapeHtml(generatedAt)} &middot; To save as PDF: press Ctrl+P and choose "Save as PDF"</p>
    <p class="page-summary">
      <span class="k">${droppedCount} excluded &mdash; out of stock &amp; ${escapeHtml(FLAGGED_INGREDIENTS.join('/'))}</span>
      ${oosCount ? `<span class="k k-oos">${oosCount} still out of stock</span>` : ''}
      ${rxCount ? `<span class="k k-rx">${rxCount} with ${escapeHtml(FLAGGED_INGREDIENTS.join(' / '))}</span>` : ''}
    </p>
  </header>
  <main class="catalog">
    ${cards}
  </main>
</body>
</html>`;
}

// Product titles to exclude from the catalog (case-insensitive substring match).
const EXCLUDE_TITLES = ['free sample'];

// Also drop anything that is BOTH unavailable and built on one of the flagged
// molecules — there is no point printing a sheet for something that cannot be
// sold. Either condition on its own is kept, and still gets badged.
function isDroppedLine(p) {
  return isOutOfStock(p) && flaggedIn(p).length > 0;
}

async function start() {
  try {
    let products = await fetchAllProducts();
    console.log(`✅ Fetched ${products.length} products.`);

    const before = products.length;
    products = products.filter((p) => {
      const title = (p.title || '').toLowerCase();
      return !EXCLUDE_TITLES.some((ex) => title.includes(ex));
    });
    if (products.length < before) {
      console.log(`🚫 Excluded ${before - products.length} product(s) (matched: ${EXCLUDE_TITLES.join(', ')}).`);
    }

    const dropped = products.filter(isDroppedLine);
    products = products.filter((p) => !isDroppedLine(p));
    if (dropped.length) {
      console.log(`🚫 Excluded ${dropped.length} out-of-stock ${FLAGGED_INGREDIENTS.join('/')} product(s):`);
      dropped.forEach((p) => console.log(`     - ${p.title}`));
    }

    const html = buildHtml(products, dropped.length);
    fs.writeFileSync(OUTPUT_HTML, html);
    console.log(`✅ ${OUTPUT_HTML} created.`);
    console.log('👉 Open it in your browser, then Ctrl+P → "Save as PDF".');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

start();
