// Live product catalog, straight from Shopify Admin API.
//
// The store has ~32 products, which is small enough that we inject the WHOLE catalog
// into every prompt instead of giving the model a search tool. That buys two things:
//   1. The model can never quote a stale price, because the only prices it has ever
//      seen in this request are the ones Shopify returned seconds ago.
//   2. No tool-call round trip, so first token lands ~1s sooner.
//
// Prescription products are redacted HERE, server-side, not by a prompt rule. The model
// is shown the name and "PRESCRIPTION ONLY" and nothing else - no price, no URL, no
// variant id. A jailbreak cannot leak what was never put in the context window.

const SHOP_DOMAIN = process.env.SHOPIFY_DOMAIN || '0ec320-gj.myshopify.com';
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-01';
const STOREFRONT = process.env.STORE_URL || 'https://sehatup.com';
const TTL_MS = Number(process.env.CATALOG_TTL_MS || 5 * 60 * 1000);

// Anything whose title or handle contains one of these is prescription-only. Kept as
// substrings rather than exact titles because Shopify titles carry marketing tails
// ("Boombatti- Stay up late, dominate fate") that change without warning.
const RX_MARKERS = [
  // Scheduled molecules. Sildenafil was missing and that was a live leak: "Boldup - 100 mg"
  // is sildenafil citrate, a PDE5 inhibitor, and it was being served as an ordinary OTC
  // product with its price and link. Its handle is a leftover copy of a period-care combo,
  // so nothing about the URL hinted at it either.
  'tadalafil', 'dapoxetine', 'sildenafil', 'vardenafil', 'tadala', 'orlistat',
  'boldup', 'bold up',
  'boombatti', 'control tantra', 'fourplay', 'hard yatra', 'max drive',
  'rocket ras', 'lovelinga', 'thrill drill', 'thrustrx', 'thrust rx',
  'endless', 'mighty', 'hard 5', 'hard 10',
];

// Belt and braces: a product whose own description names a scheduled molecule is
// prescription-only regardless of what it is called. This is what would have caught
// Boldup on day one, and it catches the next renamed product automatically.
const RX_IN_DESCRIPTION = /\b(sildenafil|tadalafil|dapoxetine|vardenafil|orlistat)\b/i;

// Never shown to a customer. The free-sample entry is a system SKU - its own description
// says "Not for individual sale" - and quoting its Rs399 as a price would be wrong.
const HIDDEN_HANDLES = new Set(['__system_free_sample_do_not_access']);

let cache = { at: 0, products: null, error: null };

const stripHtml = (html) =>
  String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

export function isPrescription(product) {
  const hay = `${product.title || ''} ${product.handle || ''}`.toLowerCase();
  if (RX_MARKERS.some((m) => hay.includes(m))) return true;
  return RX_IN_DESCRIPTION.test(String(product.body_html || ''));
}

export function isHidden(product) {
  return HIDDEN_HANDLES.has(product.handle) ||
    /^__system/i.test(String(product.handle || ''));
}

async function fetchAllProducts() {
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) throw new Error('SHOPIFY_ACCESS_TOKEN is not set');

  const out = [];
  let url = `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/products.json?limit=250&status=active`;

  // Shopify caps a page at 250 and hands back the next cursor in the Link header.
  // The store is far under that today, but paginating costs three lines and stops
  // this silently truncating the day the catalog grows.
  while (url) {
    const r = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    });
    if (!r.ok) throw new Error(`Shopify ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const body = await r.json();
    out.push(...(body.products || []));

    const link = r.headers.get('link') || '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return out;
}

function withWidth(src, width) {
  if (!src) return '';
  try {
    const u = new URL(src);
    u.searchParams.set('width', String(width));
    return u.toString();
  } catch (_) {
    return src;   // not a URL we understand - hand it back untouched
  }
}

function shape(p) {
  // Cheapest in-stock variant is what a shopper actually pays, so that is the price we
  // quote. Falling back to variants[0] keeps sold-out products quotable as "out of stock"
  // rather than crashing on undefined.
  const variants = p.variants || [];
  const available = variants.filter((v) => v.inventory_quantity > 0 || v.inventory_policy === 'continue');
  const pick = available.sort((a, b) => Number(a.price) - Number(b.price))[0] || variants[0] || {};

  const price = Number(pick.price || 0);
  const mrp = Number(pick.compare_at_price || 0);

  return {
    id: String(p.id),
    handle: p.handle,
    title: String(p.title || '').trim(),
    url: `${STOREFRONT}/products/${p.handle}`,
    // Shopify serves originals at 1080px+; the card thumbnail is 62 CSS px. Asking the
    // CDN to resize saves roughly 100x the bytes on a mobile connection, which is most of
    // this audience. Shopify's image CDN honours ?width= on any file URL.
    image: withWidth(p.image?.src || p.images?.[0]?.src || '', 160),
    price,
    mrp: mrp > price ? mrp : 0,
    discountPct: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0,
    variantId: String(pick.id || ''),
    inStock: available.length > 0,
    variantCount: variants.length,
    about: stripHtml(p.body_html).slice(0, 320),
    tags: String(p.product_type || ''),
    rx: isPrescription(p),
  };
}

/** Whole live catalog, memoised per warm lambda for CATALOG_TTL_MS. */
export async function getCatalog() {
  if (cache.products && Date.now() - cache.at < TTL_MS) return cache.products;
  try {
    const products = (await fetchAllProducts()).filter((p) => !isHidden(p)).map(shape);
    cache = { at: Date.now(), products, error: null };
    return products;
  } catch (e) {
    // A Shopify blip should degrade the bot to "team will confirm the price", not 500
    // the whole chat. Serve stale rather than nothing if we ever had a good fetch.
    cache.error = e.message;
    if (cache.products) return cache.products;
    throw e;
  }
}

// Kits, and what each one is made of. Members are taken from the store's own product
// descriptions, not guessed, so the saving quoted below is real. A kit whose contents
// cannot be verified is still listed - it just gets no savings line rather than a made-up
// one. Keys and members are handles.
const COMBOS = {
  'her-menses-hormoniherb-combo-natural-period-care-hormonal-wellness': {
    members: ['harmen', 'tea-for-period-cramps'],
    who: 'women with PCOD, PCOS, irregular or painful periods',
  },
  'shaktisurge': {
    members: ['pure-himalayan-shilajit-resin-20g', 'ashwagandha-tablets'],
    who: 'anyone wanting daily energy, strength, better sleep and less stress',
  },
  'daily-energy-stamina-support-kit-copy': {
    members: ['sehatup-shilajit-honey-sticks', 'ashwagandha-tablets'],
    who: 'the same need as the resin kit, in an easier daily format',
  },
  'macho-metabolism': {
    members: ['garcenia-cambogia-drops', 'slimtox-energy-tea'],
    who: 'women on a weight-loss plan',
  },
  'calm-curve-control': {
    members: ['garcenia-cambogia-drops', 'leanroutine'],
    who: 'men on a weight-loss plan',
  },
  'p-e-e-d-integrated-kit': {
    members: [],   // description names Kern Drops but not the full contents - do not guess
    who: 'men dealing with both premature ejaculation and erection trouble',
  },
};

/**
 * Kits priced against the sum of their parts, using today's live prices.
 * Returns only kits that are in stock and actually cheaper.
 */
export function comboBlock(products) {
  const byHandle = Object.fromEntries(products.map((p) => [p.handle, p]));
  const lines = [];

  for (const [handle, meta] of Object.entries(COMBOS)) {
    const kit = byHandle[handle];
    if (!kit || kit.rx || !kit.inStock) continue;

    const parts = meta.members.map((h) => byHandle[h]).filter(Boolean);
    const separate = parts.reduce((sum, p) => sum + p.price, 0);
    const saving = separate - kit.price;

    let line = `- ${kit.title} - Rs${kit.price}. For ${meta.who}. card: [[product:${kit.handle}]]`;
    if (parts.length === meta.members.length && meta.members.length && saving > 0) {
      line += `\n  contains: ${parts.map((p) => p.title).join(' + ')}` +
              `\n  bought separately that is Rs${separate}, so the kit saves Rs${saving}.`;
    } else if (parts.length === meta.members.length && meta.members.length) {
      line += `\n  contains: ${parts.map((p) => p.title).join(' + ')}`;
    }
    lines.push(line);
  }

  if (!lines.length) return '';
  return (
    'KITS AND COMBOS (prefer these - see the COMBO RULE in your instructions):\n' +
    lines.join('\n')
  );
}

/** The block that goes into the system prompt. Rx rows carry no price and no link. */
export function catalogBlock(products) {
  const otc = products.filter((p) => !p.rx);
  const rx = products.filter((p) => p.rx);

  const lines = otc.map((p) => {
    const stock = p.inStock ? `Rs${p.price}` : 'OUT OF STOCK - do not send this link';
    const mrp = p.inStock && p.mrp ? ` (MRP Rs${p.mrp}, ${p.discountPct}% off)` : '';
    return [
      `- ${p.title}`,
      `  price: ${stock}${mrp}`,
      `  card: [[product:${p.handle}]]`,
      `  about: ${p.about || 'no description on the store'}`,
    ].join('\n');
  });

  const rxLines = rx.map((p) => `- ${p.title} - PRESCRIPTION ONLY. You have no price and no link for this.`);

  return (
    'LIVE CATALOG (read from Shopify seconds ago - these are the ONLY prices that exist):\n' +
    lines.join('\n') +
    (rxLines.length ? '\n\nPRESCRIPTION-ONLY PRODUCTS (never price, never link, never card):\n' + rxLines.join('\n') : '')
  );
}

/** Handle -> card payload the widget renders. Rx handles are never returned. */
export function cardIndex(products) {
  const index = {};
  for (const p of products) {
    if (p.rx) continue;
    index[p.handle] = {
      handle: p.handle,
      title: p.title,
      url: p.url,
      image: p.image,
      price: p.price,
      mrp: p.mrp,
      discountPct: p.discountPct,
      variantId: p.variantId,
      inStock: p.inStock,
      variantCount: p.variantCount,
    };
  }
  return index;
}
