# shopify-delivery-sync

Marks Shopify orders as **Delivered** using the Nimbus tracking data the CRM already
stores in Firestore.

```
Firestore  shipments/{phoneKey}/awbs/{awb}        (status / rawStatus / history[])
   │  keep the ones Nimbus reports Delivered
   │  match to a Shopify order via orderId → orderNumber → nimbusOrderRef
   ▼
Shopify    POST /orders/{id}/fulfillments/{fid}/events.json  { status: "delivered" }
```

Months are bucketed by the **Shopify order date** (`created_at`, converted to IST) —
so an order placed 30 Jun and delivered 3 Jul counts as **June**.

## This tool is now the backfill, not the mechanism

Ongoing updates are automatic. `sehatup-analytics/api/_lib/shopify-fulfillment.js` runs
inside `enrichAwbAndCache()`, which fires on every Nimbus webhook push — so new scans
reach Shopify without anyone opening this UI. Use this tool for **historical backfill**
and for **auditing**; see that module for the live path.

## Mismatch detection

An earlier build of this tool classified `"Undelivered"` as delivered — the string
contains `"delivered"`, and the negative cases were tested too late. Fixed here and in
`shopify-fulfillment.js`, and every scan now reports orders that read **Delivered in
Shopify but FAILED in Nimbus** in a red banner. The tool deliberately will **not**
auto-reverse a delivery; those need a human in Shopify admin.

## Run

```bash
cd shopify-delivery-sync
npm start
# → http://localhost:4310
```

No dependencies. Node 20+.

- **Shopify token** is read automatically from `../sehatup-analytics/.env`
  (`SHOPIFY_ACCESS_TOKEN`). Put a local `.env` here to override it.
- **Firestore** reads require auth (`firestore.rules` allows unauthenticated *writes*
  only), so sign in with your CRM account in the UI. The password is sent to the local
  server, exchanged for a Firebase ID token, and never written to disk.

## The two update paths

Fulfillments in this store stop at order `#1662` (9 May 2026), so the tool handles two
cases:

| Case | Action | Default |
|---|---|---|
| Order **has** a fulfillment | POST a `delivered` fulfillment event | on |
| Order has **no** fulfillment | create a fulfillment (tracking = AWB, `notify_customer: false`), then post the event | **off** — tick *Create missing fulfillments* |

As of the last scan: May 2026 had 29 of 112 orders fulfilled (8 already `delivered`);
June (67 orders) and July (47 orders) had **none**. Without the create step, June and
July produce no writes at all.

Creating a fulfillment marks its line items fulfilled and cannot be plainly undone
(it can only be cancelled), which is why it is opt-in and separately confirmed.

## Safety

- **Dry run is on by default.** Nothing is written until you untick it; a red banner
  shows while live mode is active.
- **Single update** — every actionable row has its own `Update` button. Use it to test
  one order before touching the rest.
- **Bulk update** — tick rows (or *Select all actionable*) then *Update selected*.
  Live bulk writes require an extra confirm that names how many fulfillments would be
  created.
- **Idempotent** — rows whose fulfillment already reads `shipment_status: delivered`
  are marked *already done* and skipped.
- `notify_customer: false` is hard-wired, so no customer is emailed weeks after the fact.
- Every applied action (success or error) is appended to `logs/apply-YYYY-MM-DD.jsonl`.
- Shopify REST is rate limited to 2 req/s; calls are serialised ~520 ms apart with
  automatic `Retry-After` backoff.

## Delivered detection

Mirrors `sehatup-analytics/api/_lib/enrich.js` — a status counts as delivered only if it
contains `delivered`, and **not** `out` (excludes "Out for delivery") and **not** `rto` /
`return to origin` (excludes "RTO Delivered"). The `happened_at` sent to Shopify is the
earliest genuine delivered event in the Nimbus `history[]`, treated as IST. If Shopify
rejects that timestamp (it predates the fulfillment), the event is retried without it.

## Known gap in the CRM (found while building this)

`sehatup-analytics/api/cron-sync-shipments.js` calls Firestore `runQuery` with only
`FIREBASE_WEB_API_KEY` and no auth header. Under the current rules that returns
`403 PERMISSION_DENIED`, so the daily backstop sync is not actually listing any AWBs.
Unrelated to this tool, but worth fixing separately.
