// Atomic "claim" primitive: create a Firestore doc only if it does not already exist.
//
// Why this exists — the duplicate-status-update bug:
//
// Nimbus does not push one webhook per NEW scan. It replays an AWB's whole event history
// as a burst of separate POSTs (observed 2026-08-03 05:03: four POSTs for AWB
// 153768760482970 inside 3 seconds, carrying event_times spanning two days). Vercel runs
// those concurrently on one instance, and enrichAwbAndCache() re-pulls the full Nimbus
// timeline on every one of them — so all four compute the SAME newest status and all four
// try to push it to Shopify.
//
// A read-then-write guard cannot stop that. The check in shopify-fulfillment.js compares
// against `shipment_status` from an order fetched BEFORE any of them wrote, so every run
// sees the same stale value and every run proceeds. The result is N fulfillment events on
// one order (and, when the order had no fulfillment yet, N fulfillments) — which Shopify
// turns into N `fulfillments/update` webhooks and QuickReply turns into N WhatsApp
// messages to the customer.
//
// Firestore's create-if-absent is atomic and settles it in one round trip: exactly one
// caller gets the doc, everyone else gets 409 ALREADY_EXISTS.
//
//   if (!(await claim(COLL, key))) return;      // someone else owns this work
//   try { ...side effect, exactly once... }
//   catch (e) { await release(COLL, key); throw e; }   // let a retry through
//
// Claim docs are tiny and never read back. They are safe to purge at any time; deleting
// one just permits the corresponding side effect to happen again.
//
// Growth is bounded by an `expireAt` field (below) plus a Firestore TTL policy, which has
// to be switched on once per collection:
//   Firebase console → Firestore → TTL → Create policy → collection `shopify_sync_claims`,
//   field `expireAt`  (then the same for `nimbus_events_seen`)
// Until that policy exists the field is simply ignored and the docs accumulate — a few
// hundred tiny docs a day, harmless but unbounded.

import { authHeader, hasServiceAccount } from './google-auth.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'sehatup-f96b5';
const API_KEY    = process.env.FIREBASE_WEB_API_KEY || '';

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// How long a claim stays meaningful. Comfortably longer than any shipment lifecycle, so
// a claim can never expire while its AWB is still moving and let a duplicate through.
const CLAIM_TTL_DAYS = 120;

// Same auth story as enrich.js: the service account is a real principal and bypasses
// security rules; the web API key is a rollout fallback that only works while
// firestore.rules still allows unauthenticated writes.
async function auth() {
  if (hasServiceAccount()) return { headers: await authHeader(), query: '' };
  if (!API_KEY) throw new Error('Neither FIREBASE_SERVICE_ACCOUNT nor FIREBASE_WEB_API_KEY is set');
  return { headers: {}, query: `key=${API_KEY}` };
}

/**
 * Build a Firestore-safe document ID from arbitrary parts.
 *
 * Nimbus statuses and event times carry spaces and colons, and document IDs may not
 * contain "/", may not be "." or "..", and may not match __.*__ — so everything is
 * flattened to [a-z0-9-] before use.
 */
export const claimKey = (...parts) =>
  parts
    .map((p) => String(p ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('__')
    .slice(0, 250) || 'empty';

/**
 * Try to take a claim.
 *
 * @returns {Promise<boolean>} true if THIS caller won it and should do the work,
 *                             false if it was already held by someone else.
 *
 * Fails OPEN: if Firestore can't be reached we return true and let the work proceed.
 * A duplicate status update is a much smaller problem than silently dropping every
 * status update the moment Firestore has a bad minute.
 */
export async function claim(collection, id, meta = {}) {
  try {
    const { headers, query } = await auth();
    const fields = {
      claimedAt: { stringValue: new Date().toISOString() },
      // Read by the Firestore TTL policy (see header). timestampValue, not a string —
      // TTL only understands real timestamps.
      expireAt: { timestampValue: new Date(Date.now() + CLAIM_TTL_DAYS * 86400_000).toISOString() },
    };
    for (const [k, v] of Object.entries(meta)) fields[k] = { stringValue: String(v ?? '') };

    const url = `${BASE}/${collection}?documentId=${encodeURIComponent(id)}${query ? `&${query}` : ''}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ fields }),
    });

    if (r.status === 409) return false; // ALREADY_EXISTS — another run owns it
    if (!r.ok) {
      console.warn('[claim] non-ok, proceeding anyway:', collection, id, r.status, (await r.text()).slice(0, 200));
      return true;
    }
    return true;
  } catch (e) {
    console.warn('[claim] failed, proceeding anyway:', collection, id, e?.message || e);
    return true;
  }
}

/**
 * Drop a claim so the work can be attempted again.
 *
 * Call this whenever the claimed side effect did NOT happen — a claim left behind by a
 * failed attempt would suppress that status for good, and the daily cron backstop would
 * never be able to repair it.
 */
export async function release(collection, id) {
  try {
    const { headers, query } = await auth();
    await fetch(`${BASE}/${collection}/${encodeURIComponent(id)}${query ? `?${query}` : ''}`, {
      method: 'DELETE',
      headers,
    });
  } catch (e) {
    console.warn('[claim] release failed (non-fatal):', collection, id, e?.message || e);
  }
}
