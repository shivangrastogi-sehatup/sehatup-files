// Offline sanity check. Run before deploying, and after editing the prompt or the
// Rx list:  node scripts/smoke-test.mjs
//
// It hits Shopify for real (so SHOPIFY_ACCESS_TOKEN must be set) but never calls Gemini,
// which means it costs nothing and can run on every commit. What it proves:
//   - the catalog fetches and shapes
//   - every prescription product is classified as Rx
//   - no Rx price, URL or handle can reach the prompt or the card index
//   - the system prompt actually assembles from disk

import { getCatalog, catalogBlock, cardIndex } from '../api/_lib/catalog.js';
import { buildSystemPrompt, promptStats } from '../api/_lib/prompt.js';

// Every product that legally needs a doctor. If Shopify renames one and the marker list
// in catalog.js stops matching, this test is what tells you before a customer finds out.
const MUST_BE_RX = [
  'boombatti', 'control tantra', 'fourplay', 'hard yatra', 'max drive', 'rocket ras',
  'lovelinga', 'thrill drill', 'thrustrx', 'dapoxetine', 'tadalafil', 'orlistat',
  'confidence & performance booster',
];

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -> ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const products = await getCatalog();
check('catalog fetched', products.length > 0, `${products.length} active products`);

const stats = promptStats();
check('persona + policies loaded from disk', stats.personaChars > 3000 && stats.policyChars > 500,
  `persona ${stats.personaChars} chars, policies ${stats.policyChars} chars`);

// --- Rx classification -------------------------------------------------------
for (const needle of MUST_BE_RX) {
  const matches = products.filter((p) => `${p.title} ${p.handle}`.toLowerCase().includes(needle));
  if (!matches.length) {
    console.log(`SKIP  no live product matches "${needle}" (delisted?)`);
    continue;
  }
  check(`"${needle}" classified prescription-only`, matches.every((p) => p.rx),
    matches.map((p) => `${p.title}=${p.rx ? 'rx' : 'OTC'}`).join(', '));
}

// --- containment: nothing about an Rx product may leak into the prompt -------
const block = catalogBlock(products);
const cards = cardIndex(products);
const rx = products.filter((p) => p.rx);

check('no Rx handle in the card index', rx.every((p) => !cards[p.handle]));
check('no Rx URL in the prompt block', rx.every((p) => !block.includes(p.url)));
check('no Rx card marker in the prompt block', rx.every((p) => !block.includes(`[[product:${p.handle}]]`)));

// A shared price is only a leak when it sits on the Rx line itself, so check per line
// rather than searching the whole block for the number.
const rxLines = block.split('\n').filter((l) => l.includes('PRESCRIPTION ONLY'));
check('every Rx line is priceless', rxLines.every((l) => !/Rs\s*\d/.test(l)), `${rxLines.length} Rx lines`);
check('every Rx product has a line', rxLines.length === rx.length, `${rxLines.length} lines / ${rx.length} products`);

// --- OTC products stay usable ------------------------------------------------
const otc = products.filter((p) => !p.rx);
const inStockOtc = otc.filter((p) => p.inStock);
check('OTC products carry a live price', inStockOtc.every((p) => p.price > 0),
  `${inStockOtc.length} in stock of ${otc.length} OTC`);
check('every in-stock OTC product is cardable', inStockOtc.every((p) => cards[p.handle]?.variantId || cards[p.handle]?.url));

// --- prompt assembly ---------------------------------------------------------
const onProductPage = otc.find((p) => p.inStock);
const prompt = buildSystemPrompt(products, { productHandle: onProductPage?.handle, url: 'https://sehatup.com/x' });
check('prompt includes the live catalog', prompt.includes('LIVE CATALOG'));
check('prompt includes the policies', prompt.includes('POLICIES'));
check('page context resolves the product', prompt.includes(onProductPage.title));

const rxPage = rx[0];
if (rxPage) {
  const rxPrompt = buildSystemPrompt(products, { productHandle: rxPage.handle });
  check('Rx product page context still withholds the price',
    rxPrompt.includes('PRESCRIPTION ONLY') && !rxPrompt.includes(rxPage.url));
}

console.log(`\napprox prompt size: ${Math.round(prompt.length / 4)} tokens (${prompt.length} chars)`);
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
