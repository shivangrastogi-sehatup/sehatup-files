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
  const imgTag = img
    ? `<img class="product-img" src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}" loading="lazy" />`
    : `<div class="product-img no-img">No image</div>`;

  // body_html is real HTML from Shopify — clean out the [section] delimiters,
  // then render (fallback to a placeholder).
  const cleaned = cleanDescription(p.body_html);
  const description = (cleaned && cleaned.trim())
    ? cleaned
    : '<em class="muted">No description available.</em>';

  const showMrp = mrp != null && sellingPrice != null && mrp > sellingPrice;

  return `
  <article class="card">
    <div class="card-media">${imgTag}</div>
    <div class="card-body">
      <div class="card-index">#${index + 1}</div>
      <h2 class="product-title">${escapeHtml(p.title)}</h2>
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
function buildHtml(products) {
  const generatedAt = new Date().toLocaleString('en-IN');
  const cards = products.map((p, i) => cardHtml(p, i)).join('\n');

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
  .card-media {
    background: var(--brand-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    min-height: 220px;
  }
  .product-img {
    max-width: 100%;
    max-height: 260px;
    object-fit: contain;
  }
  .no-img {
    width: 100%;
    min-height: 200px;
    color: var(--muted);
    font-size: 14px;
  }
  .card-body { padding: 16px 18px 20px; position: relative; }
  .card-index {
    position: absolute; top: 14px; right: 16px;
    font-size: 11px; color: var(--muted); font-weight: 600;
  }
  .product-title { margin: 0 40px 8px 0; font-size: 17px; line-height: 1.3; }
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

  @media print {
    body { background: #fff; }
    .page-header {
      background: var(--brand) !important;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      page-break-after: always; break-after: page;
    }
    /* One product per page */
    .catalog {
      grid-template-columns: 1fr;
      gap: 0; padding: 0; max-width: none;
    }
    .card {
      break-inside: avoid; page-break-inside: avoid;
      page-break-after: always; break-after: page;
      border: none; border-radius: 0;
      box-shadow: none;
    }
    .card:last-child { page-break-after: auto; break-after: auto; }
    .card-media { min-height: 0; padding: 16px; }
    .product-img { max-height: 300px; max-width: 55%; }
    .card-body { padding: 20px 40px 30px; }
    .chip { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <header class="page-header">
    <h1>SehatUP Product Catalog</h1>
    <p>${products.length} products &middot; Generated ${escapeHtml(generatedAt)} &middot; To save as PDF: press Ctrl+P and choose "Save as PDF"</p>
  </header>
  <main class="catalog">
    ${cards}
  </main>
</body>
</html>`;
}

// Product titles to exclude from the catalog (case-insensitive substring match).
const EXCLUDE_TITLES = ['free sample'];

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
    const html = buildHtml(products);
    fs.writeFileSync(OUTPUT_HTML, html);
    console.log(`✅ ${OUTPUT_HTML} created.`);
    console.log('👉 Open it in your browser, then Ctrl+P → "Save as PDF".');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

start();
