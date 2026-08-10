// Did the duplicate-status fix hold?  Run this any time.
//
//   node api/_lib/check-duplicates.mjs              # last 35 days, split at the fix
//   node api/_lib/check-duplicates.mjs 2026-08-07   # split at a date you choose
//   node api/_lib/check-duplicates.mjs 2026-08-07 60  # ...and look back 60 days
//
// Reads Shopify's fulfillment EVENTS — the thing that actually drives QuickReply's
// "Fulfillment Event Created" drip trigger. One duplicate `delivered` = one extra
// enrolment = one extra WhatsApp message to the customer.
//
// Events are attributed by `created_at` — when Shopify CREATED the event, i.e. when we
// pushed it. NOT `happened_at`, which is the Nimbus scan time and is routinely
// backdated by hours: an event can have happened_at last Tuesday and created_at two
// minutes ago. Only created_at answers "did this go out before or after the fix".

import fs from 'fs';
import https from 'https';

// Full timestamp, not just a date: the fix went live mid-afternoon, so a date-only
// cutoff would credit it with pushes that went out that morning.
const FIX_DEPLOYED = process.argv[2] || '2026-08-07T14:50:00+05:30';
const LOOKBACK_DAYS = Number(process.argv[3] || 35);
const cutoffIso = new Date(FIX_DEPLOYED).toISOString();

const env = fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8');
const TOKEN = (env.match(/^SHOPIFY_ACCESS_TOKEN\s*=\s*(\S+)/m) || [])[1];
const HOST = '0ec320-gj.myshopify.com';

if (!TOKEN) {
  console.error('No SHOPIFY_ACCESS_TOKEN in sehatup-analytics/.env');
  process.exit(1);
}

const api = (p) => new Promise((res) => {
  https.get(
    { hostname: HOST, path: `/admin/api/2024-01${p}`, headers: { 'X-Shopify-Access-Token': TOKEN, Accept: 'application/json' } },
    (r) => { let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => { try { res(JSON.parse(b)); } catch { res({}); } }); },
  ).on('error', () => res({}));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Same ladder the sync uses. failure/attempted_delivery are absent on purpose —
// they may legitimately repeat and legitimately interrupt.
const RANK = { confirmed: 1, in_transit: 2, out_for_delivery: 3, delivered: 4 };

// attempted_delivery and failure may legitimately repeat — a second failed delivery is
// a real, different event. They are not counted as duplicates.
const REPEATABLE = new Set(['attempted_delivery', 'failure']);

const bucket = { before: { pushes: 0, dupes: 0, dupDelivered: 0, backwards: 0 },
                 after:  { pushes: 0, dupes: 0, dupDelivered: 0, backwards: 0 } };
const offenders = [];

const since = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString();
const orders = ((await api(`/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(since)}`)).orders || [])
  .filter((o) => (o.fulfillments || []).length);

console.log(`Shopify fulfillment events — last ${LOOKBACK_DAYS} days`);
console.log(`Cutoff: ${FIX_DEPLOYED}  (events attributed by created_at = when WE pushed them)
`);

for (const ord of orders) {
  for (const f of ord.fulfillments) {
    const events = ((await api(`/orders/${ord.id}/fulfillments/${f.id}/events.json`)).fulfillment_events || [])
      // ORDER OF PUSH, not order of scan — that is what we are auditing.
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    await sleep(110);
    if (!events.length) continue;

    // Walk the pushes in the order they went out. Each event is judged, and attributed,
    // on ITS OWN created_at — so a shipment can have pre-fix duplicates and clean
    // post-fix behaviour, and the two land in different columns.
    const seen = new Set();
    let peak = 0;
    const bad = [];
    for (const e of events) {
      const when = new Date(e.created_at).toISOString();
      const b = when >= cutoffIso ? bucket.after : bucket.before;
      b.pushes++;

      const isDupe = seen.has(e.status) && !REPEATABLE.has(e.status);
      const r = RANK[e.status] || 0;
      const isBack = r > 0 && peak > 0 && r < peak;

      if (isDupe) { b.dupes++; if (e.status === 'delivered') b.dupDelivered++; }
      if (isBack) b.backwards++;
      if ((isDupe || isBack) && when >= cutoffIso) bad.push({ e, isDupe, isBack });

      seen.add(e.status);
      if (r > peak) peak = r;
    }
    if (bad.length) offenders.push({ name: ord.name, awb: f.tracking_number, events, bad });
  }
}

const row = (label, k) => {
  const b = bucket[k];
  console.log(`  ${label.padEnd(26)} events pushed ${String(b.pushes).padStart(4)}`
    + ` | duplicate ${String(b.dupes).padStart(3)}`
    + ` | duplicate DELIVERED ${String(b.dupDelivered).padStart(3)}`
    + ` | went backwards ${String(b.backwards).padStart(2)}`);
};
row('BEFORE the fix', 'before');
row('AFTER the fix', 'after');

console.log('');
if (!bucket.after.pushes) {
  console.log('  Nothing has been pushed since the fix yet — no evidence either way.');
  console.log('  Re-run once a few shipments have moved (a day is usually enough).');
} else if (!offenders.length) {
  console.log(`  CLEAN: ${bucket.after.pushes} events pushed since the fix, 0 duplicates, 0 regressions.`);
} else {
  console.log(`  STILL DUPLICATING since the fix — ${offenders.length} fulfillment(s):`);
  for (const o of offenders) {
    console.log(`\n    ${o.name}  awb=${o.awb}`);
    o.events.forEach((e) => {
      const hit = o.bad.find((x) => x.e.id === e.id);
      const tag = hit ? (hit.isDupe ? '  <-- DUPLICATE' : '  <-- BACKWARDS') : '';
      console.log(`      pushed ${String(e.created_at).slice(0, 19)}  ${String(e.status).padEnd(17)}${tag}`);
    });
  }
}
