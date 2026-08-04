/**
 * productSearchAPI.js
 * The one place the CRM turns what an operator typed into a list of Shopify products.
 *
 * Consumed by the OrderCreate add-bar and the PrescriptionEditor medicine search (both in
 * NewUI.jsx). Keep it that way — those two used to carry private copies of this logic and
 * both copies carried the same matching bugs.
 */

import { useEffect, useState } from 'react';

export const PRODUCT_SEARCH_MIN_CHARS = 2;
export const PRODUCT_SEARCH_DEBOUNCE_MS = 250;

// Shopify caps what it returns before we get to rank it, so a small page meant a generic
// first word ("sehatup", "tablets") spent the whole budget on the wrong products and the
// real match never arrived — which felt like "the search can't find it".
const PRODUCT_SEARCH_PAGE_SIZE = 50;

// Shopify's search grammar gives meaning to a handful of characters: `-` negates a term,
// `:` splits field from value, parentheses group. A product name containing one of those
// (searching "sugar-free") either errored the query or silently searched for something
// else, and both paths surfaced as "No products match". Nothing typed into a product box
// is ever meant as an operator, so reduce the input to bare words and the grammar — along
// with any need to escape quotes — stops being reachable.
export const searchTokens = (value) => String(value || '').toLowerCase().match(/[a-z0-9]+/g) || [];

// Fold any text into a plain space-separated word stream, so "Pack of 2 (Combo)" and
// "pack-of-2-combo" compare equal.
export const normalizeSearchText = (value) => searchTokens(value).join(' ');

// True when some word in `haystack` starts with `token` — both must already be normalized.
const hasWordStartingWith = (haystack, token) =>
  haystack.startsWith(token) || haystack.includes(` ${token}`);

/**
 * Rank a product against the typed tokens. Higher is better; 0 is still a keeper.
 *
 * Shopify searches fields this query never asks for — tags, vendor, product_type, barcode.
 * The old code re-filtered the response against title/handle/variant/sku with an
 * every-token AND, so a product Shopify had matched on its tag was thrown away and the
 * operator was told "No products match" for a term Shopify resolved just fine. A local
 * pass that knows strictly less than the server did can only lose good rows, so this one
 * sorts instead of rejects: what we can corroborate floats up, the rest still gets shown.
 */
const scoreProduct = (product, tokens, normalizedTerm) => {
  const title = normalizeSearchText(product.title);
  const handle = normalizeSearchText(product.handle);
  const variantText = normalizeSearchText(
    (product.variants || []).flatMap(variant => [variant.title, variant.sku]).join(' ')
  );

  let score = 0;
  if (title === normalizedTerm) score += 1000;
  else if (title.startsWith(normalizedTerm)) score += 500;
  else if (title.includes(normalizedTerm)) score += 250;

  for (const token of tokens) {
    if (hasWordStartingWith(title, token)) score += 40;
    else if (title.includes(token)) score += 20;          // mid-word, e.g. "wagandha"
    else if (hasWordStartingWith(variantText, token)) score += 10;
    else if (handle.includes(token)) score += 5;
    // No local hit: Shopify matched this on a field we did not fetch. Nothing to add to
    // the score, but not a reason to drop the row either.
  }
  return score;
};

const toProduct = (node) => ({
  id: parseInt(node.id.split('/').pop(), 10) || node.id,
  title: node.title,
  handle: node.handle,
  image: node.featuredImage?.url || null,
  variants: (node.variants?.edges || []).map(({ node: variant }) => ({
    id: parseInt(variant.id.split('/').pop(), 10) || variant.id,
    title: variant.title,
    sku: variant.sku || '',
    // Price in paise (e.g. 199900 for Rs. 1,999) — callers divide by 100 to display.
    price: Math.round(parseFloat(variant.price) * 100),
  })),
});

/**
 * Search Shopify products by term, best match first.
 *
 * @param {string} term            Raw text from the search box.
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] Aborts the request; rejects with AbortError.
 * @returns {Promise<Array>} Products with at least one variant, ranked.
 */
export const searchProducts = async (term, { signal } = {}) => {
  const tokens = searchTokens(term);
  if (!tokens.length) return [];

  // Shopify supports a TRAILING wildcard on a term, and only there. Appending a single `*`
  // to the whole string wildcarded the last word and left every earlier word as an exact
  // whole-word match — so "ashwagandha tab" worked but "ashwa tablets" found nothing, and
  // the only reliable way through was to type a full word. Wildcard every term instead.
  const shopifyQuery = tokens.map(token => `${token}*`).join(' ');

  const query = `{
    products(first: ${PRODUCT_SEARCH_PAGE_SIZE}, query: "${shopifyQuery}") {
      edges {
        node {
          id
          title
          handle
          featuredImage { url }
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                price
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch('/shopify-v2/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });
  const data = await res.json();

  if (data.errors) {
    console.error('[Product search] GraphQL errors:', data.errors);
    return [];
  }

  const normalizedTerm = tokens.join(' ');
  return (data?.data?.products?.edges || [])
    .map(edge => toProduct(edge.node))
    // A product with no variant has nothing that can be put on an order or a prescription.
    .filter(product => product.variants.length > 0)
    .map((product, index) => ({ product, index, score: scoreProduct(product, tokens, normalizedTerm) }))
    // Shopify's own relevance order is the tie-break, so equal-scoring rows keep it.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.product);
};

/**
 * Debounced product search bound to a text value.
 *
 * @param {string} term The live value of the search input.
 * @returns {{ results: Array, isSearching: boolean }}
 */
export const useProductSearch = (term) => {
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const trimmed = String(term || '').trim();

  useEffect(() => {
    if (trimmed.length < PRODUCT_SEARCH_MIN_CHARS) {
      setResults([]);
      setIsSearching(false);
      return undefined;
    }

    // Flagged from the first keystroke rather than from when the request starts —
    // otherwise the panel sat blank for the whole debounce, which read as a dead search
    // box, and "No products match" flashed before the request had even been sent.
    setIsSearching(true);

    // A debounce cancels the pending timer, never a request already in flight. Typing
    // "ashw", pausing, then finishing "ashwagandha" left two live requests, and when the
    // first landed last it overwrote the newer list with the older one. React runs this
    // cleanup before the next effect, so the superseded request is always aborted first.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchProducts(trimmed, { signal: controller.signal })
        .then(products => { if (!controller.signal.aborted) setResults(products); })
        .catch(err => {
          if (err.name === 'AbortError') return;   // superseded; the newer request owns the UI
          console.error('[Product search] failed:', err);
          if (!controller.signal.aborted) setResults([]);
        })
        .finally(() => { if (!controller.signal.aborted) setIsSearching(false); });
    }, PRODUCT_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  return { results, isSearching };
};

/**
 * Toggle variant selection for cart
 * @param {Object} selectedVariants - Current selected variants map
 * @param {Object} variant - Variant to toggle
 * @param {Object} product - Parent product object
 * @returns {Object} Updated variants map
 */
export const toggleVariantSelection = (selectedVariants, variant, product) => {
    const n = { ...selectedVariants };
    if (n[variant.id]) {
        delete n[variant.id];
    } else {
        n[variant.id] = { ...variant, productTitle: product.title };
    }
    return n;
};

/**
 * Toggle all variants of a product
 * @param {Object} selectedVariants - Current selected variants map
 * @param {Object} product - Product whose variants to toggle
 * @param {boolean} checked - Whether to check or uncheck all
 * @returns {Object} Updated variants map
 */
export const toggleAllVariants = (selectedVariants, product, checked) => {
    const n = { ...selectedVariants };
    product.variants.forEach(v => {
        if (checked) {
            n[v.id] = { ...v, productTitle: product.title };
        } else {
            delete n[v.id];
        }
    });
    return n;
};
