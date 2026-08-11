// Regression test for the duplicate Shopify status update (and the duplicate WhatsApp
// message it caused downstream).
//
// Run:  node api/_lib/shopify-fulfillment.test.mjs
//
// Nothing here touches the network: fetch is stubbed, and Firestore's create-if-absent is
// simulated faithfully with a Set that 409s on a repeated key — which is the only part of
// Firestore this fix actually depends on.
//
// Env is set before the import on purpose: shopify-fulfillment.js and claim.js read these
// at module load. FIREBASE_WEB_API_KEY keeps claim.js on its no-network auth path.

process.env.SHOPIFY_ACCESS_TOKEN  = 'test-token';
process.env.FIREBASE_WEB_API_KEY  = 'test-key';
process.env.FIREBASE_PROJECT_ID   = 'test-project';

const { syncShopifyFulfillment } = await import('./shopify-fulfillment.js');

const firestoreDocs = new Set();
let shopifyEventPosts = [];
let fulfillmentCreates = [];
// What Shopify's fulfillment EVENT LIST holds right now. Posting an event appends here,
// and the pre-write re-read (guard 4) reads it back — NOT the possibly-stale `order`
// object passed in, which is what the caller fetched minutes earlier. Modelling the two
// separately is the whole point: every duplicate in production came from judging on the
// stale copy. The events list (not shipment_status) is the source of truth, because that
// is what the customer's drip fires on.
let liveEvents = [];

const resp = (status, body = '{}') => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
  json: async () => JSON.parse(body),
  headers: { get: () => null },
});

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const method = opts.method || 'GET';

  if (u.includes('firestore.googleapis.com')) {
    if (method === 'POST') {
      const id = decodeURIComponent(new URL(u).searchParams.get('documentId') || '');
      if (firestoreDocs.has(id)) return resp(409, '{"error":{"status":"ALREADY_EXISTS"}}');
      firestoreDocs.add(id);
      return resp(200);
    }
    if (method === 'DELETE') {
      // release() puts the id in the path, not a query param.
      firestoreDocs.delete(decodeURIComponent(new URL(u).pathname.split('/').pop()));
      return resp(200);
    }
    return resp(200);
  }

  if (u.includes('myshopify.com')) {
    if (u.includes('/events.json') && method === 'POST') {
      const st = JSON.parse(opts.body).event.status;
      shopifyEventPosts.push(st);
      liveEvents.push({ id: liveEvents.length + 1, status: st });   // Shopify appends it
      return resp(200, '{"fulfillment_event":{"id":1}}');
    }
    // Guard 4 reads the event list back to see what a racing run already posted.
    if (u.includes('/events.json') && method === 'GET') {
      return resp(200, JSON.stringify({ fulfillment_events: liveEvents }));
    }
    if (u.includes('/fulfillments.json') && method === 'POST') {
      fulfillmentCreates.push(u);
      return resp(200, '{"fulfillment":{"id":555,"shipment_status":null}}');
    }
    if (u.includes('/fulfillment_orders.json')) {
      return resp(200, '{"fulfillment_orders":[{"id":77,"status":"open","supported_actions":["create_fulfillment"]}]}');
    }
    // Order re-read: no longer used by guard 4, kept benign for any other caller.
    if (/\/orders\/\d+\.json/.test(u) && method === 'GET') {
      const last = liveEvents[liveEvents.length - 1];
      return resp(200, JSON.stringify({
        order: { id: 123, fulfillments: [{ id: 999, tracking_number: 'AWB1234567', shipment_status: last ? last.status : null }] },
      }));
    }
  }
  throw new Error('unexpected fetch: ' + method + ' ' + u);
};

const reset = (live = 'in_transit') => {
  firestoreDocs.clear(); shopifyEventPosts = []; fulfillmentCreates = [];
  liveEvents = live ? [{ id: 1, status: live }] : [];
};
const orderWithFulfillment = () => ({
  id: 123,
  fulfillments: [{ id: 999, tracking_number: 'AWB1234567', shipment_status: 'in_transit' }],
});
const args = (over = {}) => ({
  order: orderWithFulfillment(),
  awb: 'AWB1234567',
  status: 'Out For Delivery',
  eventTime: '2026-08-03 10:15:00',
  courier: 'Xpressbees',
  ...over,
});

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  → ' + detail}`);
  if (!cond) failures++;
};

// 1. The actual bug: 4 concurrent runs, identical scan (Nimbus history-replay burst).
reset();
let results = await Promise.all([1, 2, 3, 4].map(() => syncShopifyFulfillment(args())));
check('burst of 4 identical scans posts exactly 1 Shopify event',
  shopifyEventPosts.length === 1, `posted ${shopifyEventPosts.length}: ${shopifyEventPosts}`);
check('exactly 1 run reports the event, 3 report duplicate_suppressed',
  results.filter((r) => r.event).length === 1 &&
  results.filter((r) => r.reason === 'duplicate_suppressed').length === 3,
  JSON.stringify(results.map((r) => r.event || r.reason)));

// 2. No fulfillment yet — the worst case, which used to create one per racing run.
reset();
await Promise.all([1, 2, 3, 4].map(() => syncShopifyFulfillment(args({ order: { id: 123, fulfillments: [] } }))));
check('burst with no existing fulfillment creates exactly 1 fulfillment',
  fulfillmentCreates.length === 1, `created ${fulfillmentCreates.length}`);

// 3. CHANGED 2026-08-07. This used to assert the opposite — that a second
// out-for-delivery on another day should post again, because the claim key carried the
// Nimbus event time. Production showed that rule is what caused the duplicates: Nimbus
// emits several DIFFERENT scans meaning the SAME thing (hub A and hub B minutes apart,
// a delivery scan and a POD upload), each with its own event_time, so each posted.
// 9 of 43 delivered shipments got `delivered` twice, and each duplicate enrolled the
// customer in the drip campaign again. One push per status per shipment now.
reset();
await syncShopifyFulfillment(args());
const laterOfd = await syncShopifyFulfillment(args({ eventTime: '2026-08-05 09:00:00' }));
check('the same status on a later scan does NOT post again',
  shopifyEventPosts.length === 1,
  `posted ${shopifyEventPosts.length}: ${shopifyEventPosts} (${laterOfd.reason})`);

// 3b. ...but the two statuses that carry new information every time still repeat.
// A second failed delivery attempt is a real, different event; a second "delivered"
// never is.
reset();
await syncShopifyFulfillment(args({ status: 'Undelivered', eventTime: '2026-08-03 10:00:00' }));
await syncShopifyFulfillment(args({ status: 'Undelivered', eventTime: '2026-08-04 10:00:00' }));
check('a genuine SECOND failed delivery attempt still posts',
  shopifyEventPosts.length === 2 && shopifyEventPosts.every((s) => s === 'attempted_delivery'),
  `posted ${shopifyEventPosts.length}: ${shopifyEventPosts}`);

// 4. Same scan replayed after the claim exists (e.g. the daily cron re-running).
reset();
await syncShopifyFulfillment(args());
const second = await syncShopifyFulfillment(args());
check('cron re-running the same scan does not repost',
  shopifyEventPosts.length === 1 && second.reason === 'duplicate_suppressed',
  `posted ${shopifyEventPosts.length}, reason ${second.reason}`);

// 5. A failed Shopify push must release the claim so a retry can succeed.
reset();
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).includes('/events.json')) throw new Error('shopify exploded');
  return realFetch(url, opts);
};
const failed = await syncShopifyFulfillment(args());
globalThis.fetch = realFetch;
const retried = await syncShopifyFulfillment(args());
check('claim is released when the push fails, so the retry goes through',
  !failed.ok && retried.event === 'out_for_delivery',
  `failed=${JSON.stringify(failed)} retried=${JSON.stringify(retried)}`);

// 6. Statuses Shopify has no equivalent for must not claim or post at all.
reset();
const unmapped = await syncShopifyFulfillment(args({ status: 'pending pickup' }));
check('unmapped status ("pending pickup") posts nothing and takes no claim',
  shopifyEventPosts.length === 0 && firestoreDocs.size === 0 && unmapped.reason.startsWith('unmapped'),
  JSON.stringify(unmapped));

// 7. The pre-existing no-op guard still short-circuits without a Firestore write.
reset();
const noop = await syncShopifyFulfillment(args({
  order: { id: 123, fulfillments: [{ id: 999, tracking_number: 'AWB1234567', shipment_status: 'out_for_delivery' }] },
}));
check('already-at-target still skips without claiming',
  noop.reason === 'already_out_for_delivery' && firestoreDocs.size === 0, JSON.stringify(noop));

// ── Replays of REAL production sequences ────────────────────────────────────
// Pulled from Shopify on 2026-08-06 by listing the fulfillment events on orders that
// actually duplicated. These are not invented cases: each one shipped to a customer.

/** Feed a whole Nimbus timeline through, sequentially, as it arrived. */
async function replay(scans, startLive) {
  reset(startLive);
  let sent = '';                              // stands in for the doc's shopifyStatus
  for (const [status, eventTime] of scans) {
    const r = await syncShopifyFulfillment(args({
      status, eventTime,
      // The caller's `order` is a snapshot, deliberately stale — exactly as in enrich.js.
      order: { id: 123, fulfillments: [{ id: 999, tracking_number: 'AWB1234567', shipment_status: startLive }] },
      alreadySent: sent,
    }));
    if (r.event) sent = r.event;
  }
  return shopifyEventPosts;
}

// Order #1872 — 7 events went out; in_transit, out_for_delivery and delivered all twice.
const p1872 = await replay([
  ['Shipped',          '2026-08-01 13:37:00'],
  ['In Transit',       '2026-08-01 17:34:17'],
  ['In Transit',       '2026-08-01 17:35:21'],
  ['Out For Delivery', '2026-08-03 09:09:59'],
  ['Out For Delivery', '2026-08-03 09:11:59'],
  ['Delivered',        '2026-08-03 12:49:59'],
  ['Delivered',        '2026-08-03 13:07:11'],
], null);
check('#1872 replay: 7 scans -> 4 events, each status once',
  JSON.stringify(p1872) === JSON.stringify(['confirmed', 'in_transit', 'out_for_delivery', 'delivered']),
  JSON.stringify(p1872));
check('#1872 replay: delivered posted exactly once (was twice)',
  p1872.filter((s) => s === 'delivered').length === 1, JSON.stringify(p1872));

// Order #1864 — the regression: an OLD out_for_delivery arrived AFTER delivered.
const p1864 = await replay([
  ['Out For Delivery', '2026-08-03 10:57:38'],
  ['Delivered',        '2026-08-03 12:23:39'],
  ['Out For Delivery', '2026-08-03 12:41:55'],
  ['Delivered',        '2026-08-03 16:10:00'],
], null);
check('#1864 replay: status never walks backwards after delivered',
  JSON.stringify(p1864) === JSON.stringify(['out_for_delivery', 'delivered']),
  JSON.stringify(p1864));

// Order #1868 — in_transit, out_for_delivery and delivered each twice, hours apart.
const p1868 = await replay([
  ['In Transit',       '2026-07-31 12:44:28'],
  ['In Transit',       '2026-07-31 14:34:34'],
  ['Out For Delivery', '2026-08-03 09:38:41'],
  ['Out For Delivery', '2026-08-03 10:17:03'],
  ['Delivered',        '2026-08-03 13:49:31'],
  ['Delivered',        '2026-08-03 14:05:23'],
], null);
check('#1868 replay: 6 scans -> 3 events',
  JSON.stringify(p1868) === JSON.stringify(['in_transit', 'out_for_delivery', 'delivered']),
  JSON.stringify(p1868));

// ── The two new guards, in isolation ────────────────────────────────────────

// alreadySent short-circuits before any Firestore or Shopify call at all.
reset();
const seen = await syncShopifyFulfillment(args({ status: 'Delivered', alreadySent: 'delivered' }));
check('alreadySent=delivered skips with no claim and no network write',
  seen.reason === 'already_sent' && shopifyEventPosts.length === 0 && firestoreDocs.size === 0,
  JSON.stringify(seen));

// The rank guard, judged on the STALE order object.
reset();
const backwards = await syncShopifyFulfillment(args({
  status: 'In Transit',
  order: { id: 123, fulfillments: [{ id: 999, tracking_number: 'AWB1234567', shipment_status: 'out_for_delivery' }] },
}));
check('in_transit after out_for_delivery is refused as stale',
  String(backwards.reason).startsWith('stale_status:') && shopifyEventPosts.length === 0,
  JSON.stringify(backwards));

// A failure may still interrupt at any point — RTO after delivery is legitimate.
reset('delivered');
const rto = await syncShopifyFulfillment(args({
  status: 'RTO Delivered',
  order: { id: 123, fulfillments: [{ id: 999, tracking_number: 'AWB1234567', shipment_status: 'delivered' }] },
}));
check('RTO after delivered still posts (failure is not "backwards")',
  rto.event === 'failure', JSON.stringify(rto));

// Guard 4: the caller's order says in_transit, but Shopify already moved on.
reset('delivered');
const stale = await syncShopifyFulfillment(args({ status: 'Delivered' }));
check('pre-write re-read catches a stale caller snapshot',
  String(stale.reason).includes('live') && shopifyEventPosts.length === 0,
  JSON.stringify(stale));

// Guard 4 — the real 2026-08-11 production leak: a burst that slips PAST the claim.
// When the Firestore claim write hiccups, claim() FAILS OPEN (returns true) and both
// racing scans reach the write path — this is how in_transit / out_for_delivery
// duplicates still went out minutes apart after the first fix. The events-list re-read
// is the backstop that now stops the second one. shipment_status could not: it does not
// reliably mirror a just-posted intermediate event, which is exactly why only the
// intermediate statuses kept duplicating while `delivered` was already clean.
reset();
const realFetchFO = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).includes('firestore.googleapis.com') && (opts.method || 'GET') === 'POST') {
    return resp(500, '{"error":{"status":"INTERNAL"}}');   // claim write refused → claim() fails open
  }
  return realFetchFO(url, opts);
};
await syncShopifyFulfillment(args());                    // first OFD scan posts
const leaked = await syncShopifyFulfillment(args());     // second OFD scan, claim no longer guards it
globalThis.fetch = realFetchFO;
check('events-list re-read stops a duplicate when the claim fails open',
  shopifyEventPosts.length === 1 && String(leaked.reason).includes('live'),
  `posted ${shopifyEventPosts.length}: ${shopifyEventPosts} (${leaked.reason})`);

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
