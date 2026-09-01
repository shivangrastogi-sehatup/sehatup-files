// node scripts/attribution.test.mjs
//
// Runs the browser attribution snippet from shopify-elements/sehatup-attribution.liquid
// against the URL shapes SehatUP actually receives, with a fake localStorage.
//
// This exists because the snippet decides what every lead's source says, and it is not
// covered by any Shopify test. The cases that matter most are the ones with NO referrer
// and NO utm - today that is 90% of leads, and getting a useful label out of a bare
// fbclid is the difference between "direct" and "meta".

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const liquid = readFileSync(
  join(here, '..', '..', 'shopify-elements', 'sehatup-attribution.liquid'), 'utf8');

const src = liquid.slice(liquid.indexOf('<script>') + 8, liquid.lastIndexOf('</script>'));

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) { console.log(`        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`); failures += 1; }
}

/** Runs the snippet as if a visitor loaded `url` having come from `referrer`. */
function visit(store, url, referrer = '') {
  const u = new URL(url);
  const win = {
    location: { search: u.search, pathname: u.pathname, href: url },
    localStorage: store,
  };
  const doc = { referrer };
  const fn = new Function('window', 'document', 'localStorage', 'URLSearchParams', 'URL', src);
  fn(win, doc, store, URLSearchParams, URL);
  return win.SehatUpAttribution;
}

function newStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const BASE = 'https://sehatup.com';

// --- source labelling -------------------------------------------------------
console.log('--- source labelling ---');

check('explicit utm_source wins',
  visit(newStore(), `${BASE}/products/shilajit?utm_source=meta&utm_medium=paid`).fields().traffic_source,
  'meta');

// The important one: a Meta ad click with no utm and no referrer, which is what an
// in-app browser actually sends. Without the fbclid rule this reads as "direct".
check('bare fbclid, no referrer -> meta',
  visit(newStore(), `${BASE}/products/shilajit?fbclid=IwAR0abc123`).fields().traffic_source,
  'meta');

check('bare gclid, no referrer -> google',
  visit(newStore(), `${BASE}/?gclid=Cj0KCQ`).fields().traffic_source, 'google');

check('gbraid (iOS Google Ads) -> google',
  visit(newStore(), `${BASE}/?gbraid=abc`).fields().traffic_source, 'google');

check('instagram referrer -> meta',
  visit(newStore(), `${BASE}/`, 'https://l.instagram.com/').fields().traffic_source, 'meta');

check('whatsapp shim referrer -> whatsapp',
  visit(newStore(), `${BASE}/`, 'https://l.wl.co/').fields().traffic_source, 'whatsapp');

check('google search referrer -> google-organic',
  visit(newStore(), `${BASE}/`, 'https://www.google.com/').fields().traffic_source, 'google-organic');

check('nothing at all -> direct',
  visit(newStore(), `${BASE}/`).fields().traffic_source, 'direct');

// --- first touch must survive browsing --------------------------------------
console.log('\n--- first touch survives the journey ---');

// The exact failure this whole snippet exists to fix: arrive on an ad, browse away,
// fill the popup on a page whose URL has no utm on it at all.
const journey = newStore();
visit(journey, `${BASE}/products/shilajit?utm_source=meta&utm_medium=paid&utm_campaign=shilajit-aug26`);
visit(journey, `${BASE}/collections/all`);
const afterBrowsing = visit(journey, `${BASE}/pages/about`).fields();

check('utm_campaign survives two more pageviews', afterBrowsing.utm_campaign, 'shilajit-aug26');
check('landing page is the FIRST page, not the last', afterBrowsing.landing_page, '/products/shilajit');
check('attributed_page records where they actually converted', afterBrowsing.attributed_page, '/pages/about');

// --- first vs last touch ----------------------------------------------------
console.log('\n--- first vs last touch are both kept ---');

const returning = newStore();
visit(returning, `${BASE}/?utm_source=meta&utm_campaign=first-ad`);
const second = visit(returning, `${BASE}/?utm_source=google&utm_campaign=second-ad`).fields();

check('first touch is not overwritten by a later campaign', second.utm_campaign, 'first-ad');
check('first traffic_source preserved', second.traffic_source, 'meta');
check('last touch records the newer campaign', second.last_utm_campaign, 'second-ad');
check('last traffic_source updated', second.last_traffic_source, 'google');

// --- internal navigation must not overwrite ---------------------------------
console.log('\n--- internal navigation is not a new source ---');

const internal = newStore();
visit(internal, `${BASE}/?utm_source=meta&utm_campaign=keepme`);
const afterInternal = visit(internal, `${BASE}/cart`, 'https://sehatup.com/products/x').fields();
check('an internal referrer does not overwrite last touch', afterInternal.last_utm_campaign, 'keepme');

// --- private mode -----------------------------------------------------------
console.log('\n--- storage unavailable ---');
const throwing = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
};
let survived = true;
try { visit(throwing, `${BASE}/?utm_source=meta`).fields(); } catch (e) { survived = false; }
check('private mode does not throw', survived, true);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
