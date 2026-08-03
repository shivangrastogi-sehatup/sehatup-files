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
      shopifyEventPosts.push(JSON.parse(opts.body).event.status);
      return resp(200, '{"fulfillment_event":{"id":1}}');
    }
    if (u.includes('/fulfillments.json') && method === 'POST') {
      fulfillmentCreates.push(u);
      return resp(200, '{"fulfillment":{"id":555,"shipment_status":null}}');
    }
    if (u.includes('/fulfillment_orders.json')) {
      return resp(200, '{"fulfillment_orders":[{"id":77,"status":"open","supported_actions":["create_fulfillment"]}]}');
    }
  }
  throw new Error('unexpected fetch: ' + method + ' ' + u);
};

const reset = () => { firestoreDocs.clear(); shopifyEventPosts = []; fulfillmentCreates = []; };
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

// 3. A genuine second out-for-delivery on another day must still reach the customer.
reset();
await syncShopifyFulfillment(args());
await syncShopifyFulfillment(args({ eventTime: '2026-08-05 09:00:00' }));
check('a real second OFD scan on another day still posts',
  shopifyEventPosts.length === 2, `posted ${shopifyEventPosts.length}`);

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

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
