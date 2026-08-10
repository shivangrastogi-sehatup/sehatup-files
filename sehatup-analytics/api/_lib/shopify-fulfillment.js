// Keeps a Shopify order's Fulfillment status + Delivery status in step with Nimbus.
//
// Called from enrichAwbAndCache() — which itself runs on every Nimbus webhook push
// and on the daily cron — so a courier scan flows through automatically:
//
//   Nimbus webhook → enrich.js → syncShopifyFulfillment()
//        ├── order has no fulfillment  → create one (tracking = AWB)  → Fulfilled
//        └── post a fulfillment event  → Delivery status (shipment_status)
//
// Everything here is best-effort: it never throws, because a Shopify hiccup must not
// fail the webhook or lose the Firestore write that already succeeded.
//
// Concurrency: Nimbus replays an AWB's whole history as a burst of simultaneous webhooks,
// so this function routinely runs several times at once with identical arguments. An
// atomic Firestore claim (claim.js) keyed on (AWB, target status, Nimbus event time) lets
// exactly one of them write — without it, each concurrent run read the same pre-write
// `shipment_status`, all decided an update was needed, and the customer got one WhatsApp
// message per racing run.

import { claim, claimKey, release } from './claim.js';

const SHOPIFY_HOSTNAME    = '0ec320-gj.myshopify.com';
const SHOPIFY_API_VERSION = '2024-01';
const SHOPIFY_TOKEN       = process.env.SHOPIFY_ACCESS_TOKEN || '';

// One doc per (AWB, target status) that has been pushed to Shopify.
const CLAIM_COLLECTION = 'shopify_sync_claims';

// ── Why the claim key no longer contains the Nimbus event time ──────────────
// It used to be (AWB, target, event_time), to allow "a genuine SECOND out-for-
// delivery days later" through. That reasoning was wrong about how Nimbus behaves:
// it emits SEVERAL DIFFERENT SCANS THAT MEAN THE SAME THING — "In Transit" at hub A
// 17:34 and hub B 17:35, a delivery scan and a POD-upload scan. Each carries its own
// event_time, so each produced a different key and each posted again.
//
// Measured over 35 days before this change: 9 of the 43 shipments that reached
// delivered posted `delivered` MORE THAN ONCE (21%), and 16 of 56 fulfillments
// carried some repeated status. They were 16 minutes to 4 hours apart — sequential,
// not the concurrent bursts the claim was built for, so nothing was guarding them.
//
// Each duplicate `delivered` is a real cost: Shopify fires fulfillments/update,
// QuickReply's "Fulfillment Event Created" drip (filtered on Delivery Status =
// Delivered) enrols the customer again, and they get the same WhatsApp message again.
//
// So the key is now (AWB, target): one push per status per shipment, forever.
const REPEATABLE = new Set([
  // ...except the two that carry NEW information every time they happen. A second
  // failed delivery attempt is a real, different event the customer should see; a
  // second "delivered" never is.
  'attempted_delivery',
  'failure',
]);

// Delivery progresses in one direction. Used to refuse a late/replayed scan that
// would walk the order backwards — order #1864 went
// out_for_delivery -> delivered -> out_for_delivery -> delivered because an old
// scan arrived after a newer one. failure/attempted_delivery are absent on purpose:
// they may legitimately interrupt at any point.
const RANK = { confirmed: 1, in_transit: 2, out_for_delivery: 3, delivered: 4 };

// All three default ON except the customer email, which stays off — these updates are
// bookkeeping, often days after the fact, and must not spam customers.
const flag = (name, dflt) => {
  const v = process.env[name];
  if (v === undefined || v === '') return dflt;
  return /^(1|true|yes|on)$/i.test(v);
};
const SYNC_ENABLED       = flag('SHOPIFY_SYNC_ENABLED', true);
const CREATE_FULFILLMENT = flag('SHOPIFY_SYNC_CREATE_FULFILLMENT', true);
const NOTIFY_CUSTOMER    = flag('SHOPIFY_SYNC_NOTIFY_CUSTOMER', false);

const nimbusTrackingUrl = (awb) => `https://ship.nimbuspost.com/shipping/tracking/${awb}`;

async function shopify(path, { method = 'GET', body = null } = {}) {
  const url = `https://${SHOPIFY_HOSTNAME}/admin/api/${SHOPIFY_API_VERSION}${path}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, {
      method,
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429) {
      await new Promise((res) => setTimeout(res, Number(r.headers.get('retry-after') || 2) * 1000));
      continue;
    }
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) { /* HTML error page */ }
    if (!r.ok) throw new Error(`Shopify ${method} ${path} → ${r.status}: ${(json?.errors ? JSON.stringify(json.errors) : text).slice(0, 250)}`);
    return json;
  }
  throw new Error(`Shopify ${path} rate limited after 3 attempts`);
}

/**
 * Nimbus status text → Shopify fulfillment event status.
 *
 * Order matters. RTO is tested FIRST because Nimbus sends "RTO Delivered" and
 * "RTO Out For Delivery", which would otherwise read as a successful delivery —
 * the same trap classifyStatus() in enrich.js guards against.
 *
 * Returns null for statuses Shopify has no equivalent for (e.g. "Pending pickup"),
 * which means "post no event".
 */
export function mapNimbusToShopifyEvent(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return null;
  // "Undelivered" CONTAINS "delivered", so every negative case must be tested before
  // the delivered case — otherwise a failed delivery reads as a successful one.
  if (s.includes('rto') || s.includes('return to origin')) return 'failure';
  if (s.includes('undeliver') || s.includes('refuse') || s.includes('ndr') || s.includes('attempt')) return 'attempted_delivery';
  if (s.includes('cancel') || s.includes('fail'))          return 'failure';
  if (s.includes('delivered') && !s.includes('out'))       return 'delivered';
  if (s.includes('out for delivery') || s === 'out_for_delivery') return 'out_for_delivery';
  // "Pending pickup" means NOT yet picked up — must be tested before the pickup case.
  if (s.includes('pending') || s.includes('not picked'))   return null;
  if (s.includes('transit') || s.includes('reached') || s.includes('bagged') || s.includes('dispatch')) return 'in_transit';
  if (s.includes('picked') || s.includes('pickup') || s.includes('manifest') || s.includes('shipped')) return 'confirmed';
  return null;
}

// Nimbus sends "2026-06-14 10:22:00" with no zone — it's IST.
function toIso(raw) {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(raw).trim());
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}+05:30`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function createFulfillment(orderId, awb, courier) {
  const { fulfillment_orders: fos = [] } = await shopify(`/orders/${orderId}/fulfillment_orders.json`);
  const open = fos.filter(
    (fo) => fo.status === 'open' && (fo.supported_actions || []).includes('create_fulfillment')
  );
  if (!open.length) return null; // nothing left to fulfil (already fulfilled or cancelled)

  const res = await shopify('/fulfillments.json', {
    method: 'POST',
    body: {
      fulfillment: {
        line_items_by_fulfillment_order: open.map((fo) => ({ fulfillment_order_id: fo.id })),
        tracking_info: { number: awb, company: courier || 'Other', url: nimbusTrackingUrl(awb) },
        notify_customer: NOTIFY_CUSTOMER,
      },
    },
  });
  return res?.fulfillment || null;
}

/**
 * Push the current Nimbus state onto the Shopify order.
 *
 * @param {object}  opts.order     the Shopify order object enrich.js already fetched
 * @param {string}  opts.awb
 * @param {string}  opts.status    newest Nimbus status text
 * @param {string}  opts.eventTime newest Nimbus event_time
 * @param {string}  opts.courier
 * @returns {object} { ok, skipped?, reason?, event?, fulfillmentId?, created?, claimKey? }
 *
 * `event` is set only when an event was actually posted — that is the signal callers
 * should log on. `reason: 'duplicate_suppressed'` means a concurrent run is handling
 * this exact scan and this one deliberately did nothing.
 */
export async function syncShopifyFulfillment({ order, awb, status, eventTime, courier, alreadySent }) {
  try {
    if (!SYNC_ENABLED)  return { ok: false, skipped: true, reason: 'sync_disabled' };
    if (!SHOPIFY_TOKEN) return { ok: false, skipped: true, reason: 'no_shopify_token' };
    if (!order?.id)     return { ok: false, skipped: true, reason: 'no_shopify_order' };

    const target = mapNimbusToShopifyEvent(status);
    if (!target) return { ok: false, skipped: true, reason: `unmapped_status:${status || 'empty'}` };

    // ── Guard 1: what did we already send for THIS shipment? ──
    // `alreadySent` is shopifyStatus off the AWB doc — the status this shipment was
    // last successfully pushed with. Costs no round trip (enrich.js already has the
    // document) and, unlike the claim, it lives with the data: it is visible when
    // debugging and it survives the claims collection being purged or TTL'd away.
    if (alreadySent && alreadySent === target && !REPEATABLE.has(target)) {
      return { ok: true, skipped: true, reason: 'already_sent', alreadySent };
    }

    // Prefer the fulfillment carrying this AWB; otherwise the most recent one.
    let fulfillments = order.fulfillments || [];
    let match =
      fulfillments.find((f) => String(f.tracking_number || '').trim() === String(awb).trim()) ||
      fulfillments[fulfillments.length - 1] ||
      null;

    // ── Cheap local guards ──
    // These only settle the case where the order we ALREADY fetched proves there is
    // nothing to do, so the common no-op costs no extra round trip. They cannot be
    // trusted to prevent duplicates: `shipment_status` here comes from an order fetched
    // before any concurrent run wrote, so racing runs all read the same stale value.
    // That job belongs to the claim below.
    const current = match ? (match.shipment_status || null) : null;
    if (match) {
      // REPEATABLE is exempt from every equality check, not just the claim: two
      // consecutive failed delivery attempts legitimately produce the same target, and
      // blocking the second would hide a real event from the customer.
      if (current === target && !REPEATABLE.has(target)) {
        return { ok: true, skipped: true, reason: 'already_' + target, fulfillmentId: String(match.id), created: false };
      }
      // Never walk a delivered parcel backwards on a late/duplicate scan. An RTO after
      // delivery is the one legitimate exception.
      if (current === 'delivered' && target !== 'failure') {
        return { ok: true, skipped: true, reason: 'already_delivered', fulfillmentId: String(match.id), created: false };
      }
      // ── Guard 2: delivery only moves forwards ──
      // Generalises the rule above to every step. A replayed out_for_delivery landing
      // after in_transit has already advanced is stale news, and posting it makes the
      // order's Delivery status flap. failure/attempted_delivery are exempt — they
      // are not "backwards", they are a different outcome and may land at any point.
      if (RANK[target] && RANK[current] && RANK[target] < RANK[current]) {
        return {
          ok: true, skipped: true, reason: `stale_status:${target}_after_${current}`,
          fulfillmentId: String(match.id), created: false,
        };
      }
    } else if (!CREATE_FULFILLMENT) {
      return { ok: false, skipped: true, reason: 'no_fulfillment_and_create_disabled' };
    }

    // ── Guard 3: the idempotency claim ──
    // Everything past this point WRITES to Shopify. Firestore's create-if-absent is
    // atomic server-side, so this settles both the concurrent case (Nimbus replay
    // bursts arriving at the same instant) and the sequential one (the same status
    // arriving hours apart on a different scan) in one round trip.
    //
    // Keyed on (AWB, target) — see the note at the top of this file for why the
    // Nimbus event time was removed. REPEATABLE statuses keep it, because each
    // failed delivery attempt is genuinely new information.
    const key = REPEATABLE.has(target)
      ? claimKey(awb, target, eventTime || new Date().toISOString().slice(0, 10))
      : claimKey(awb, target);
    if (!(await claim(CLAIM_COLLECTION, key, { awb, target, eventTime: eventTime || '', orderId: String(order.id) }))) {
      return { ok: true, skipped: true, reason: 'duplicate_suppressed', claimKey: key, fulfillmentId: match ? String(match.id) : null };
    }

    // ── Guard 4: re-read Shopify immediately before writing ──
    // `order` was fetched earlier in enrich.js — before the Nimbus pull, the Shopify
    // lookups and several Firestore writes — so by now it can be seconds to minutes
    // stale, and the local guards above judged on that stale copy. This is the only
    // check that sees what Shopify holds RIGHT NOW. It costs one GET, and only on the
    // path that was about to write anyway; every no-op returned before reaching here.
    if (match) {
      try {
        const fresh = await shopify(`/orders/${order.id}.json?fields=id,fulfillments`);
        const f = (fresh?.order?.fulfillments || []).find((x) => String(x.id) === String(match.id));
        const liveStatus = f ? (f.shipment_status || null) : null;
        if (liveStatus === target && !REPEATABLE.has(target)) {
          // Shopify already has it — leave the claim in place, it is genuinely done.
          return { ok: true, skipped: true, reason: 'already_' + target + '_live', claimKey: key, fulfillmentId: String(match.id), created: false };
        }
        if (RANK[target] && RANK[liveStatus] && RANK[target] < RANK[liveStatus]) {
          return { ok: true, skipped: true, reason: `stale_status_live:${target}_after_${liveStatus}`, claimKey: key, fulfillmentId: String(match.id), created: false };
        }
      } catch (e) {
        // A failed re-read must not block a real status update — the claim and the
        // local guards have already done most of the work.
        console.warn('[shopify-sync] pre-write re-read failed for', awb, '-', e?.message || e);
      }
    }

    let created = false;
    try {
      if (!match) {
        match = await createFulfillment(order.id, awb, courier);
        if (!match) {
          // Nothing was written, so the claim must go back — otherwise this AWB could
          // never be fulfilled for this scan, not even by the daily cron.
          await release(CLAIM_COLLECTION, key);
          return { ok: false, skipped: true, reason: 'no_open_fulfillment_order' };
        }
        created = true;
      }

      const happenedAt = toIso(eventTime);
      const post = (withTime) =>
        shopify(`/orders/${order.id}/fulfillments/${match.id}/events.json`, {
          method: 'POST',
          body: { event: withTime ? { status: target, happened_at: withTime } : { status: target } },
        });
      try {
        await post(happenedAt);
      } catch (e) {
        // Shopify rejects a happened_at that predates the fulfillment it belongs to —
        // retry letting Shopify stamp "now" rather than losing the status change.
        if (happenedAt && /happened_at|invalid/i.test(e.message)) await post(null);
        else throw e;
      }
    } catch (e) {
      // The push failed, so hand the claim back and let the next scan or the daily cron
      // try again. A claim left behind by a failed attempt would suppress this status
      // permanently.
      await release(CLAIM_COLLECTION, key);
      throw e;
    }

    return { ok: true, event: target, fulfillmentId: String(match.id), created, from: current, claimKey: key };
  } catch (e) {
    console.error('[shopify-sync] failed for AWB', awb, '-', e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}
