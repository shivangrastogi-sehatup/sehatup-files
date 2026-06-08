// Enrichment pipeline: AWB → Nimbus mapi → Shopify → Firestore subcollection.
//
// Firestore layout:
//   shipments/{phone}                  → customer summary (name, email, lastOrderAt, awbCount)
//   shipments/{phone}/awbs/{awb}       → full shipment + tracking data for one AWB
//
// If Shopify has no phone for the order, the AWB is bucketed under
// `unknown_{awb}` so we never lose data.

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'sehatup-f96b5';
const API_KEY    = process.env.FIREBASE_WEB_API_KEY || '';

const SHOPIFY_HOSTNAME    = '0ec320-gj.myshopify.com';
const SHOPIFY_API_VERSION = '2024-01';
const SHOPIFY_TOKEN       = process.env.SHOPIFY_ACCESS_TOKEN || '';

// Google Apps Script web-app URL that fronts the CRM spreadsheet (same deployment
// used by /api/leads). Every enrichment upserts the shipment row into its
// "shipments" tab, keyed by AWB — making the sheet a live standalone tracker.
const SHEETS_SCRIPT_URL = process.env.SHEETS_SCRIPT_URL || process.env.DEFAULT_GSCRIPT_URL || '';

// Public Nimbus tracking page for an AWB (also used as the Referer when polling).
const nimbusTrackingUrl = (awb) => `https://ship.nimbuspost.com/shipping/tracking/${awb}`;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// ─────── Firestore REST helpers ───────

function toFsValue(v) {
  if (v === null || v === undefined)    return { nullValue: null };
  if (typeof v === 'boolean')           return { booleanValue: v };
  if (typeof v === 'number' && Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === 'number')            return { doubleValue: v };
  if (Array.isArray(v))                 return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFsValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function toFsDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFsValue(v);
  return { fields };
}

// PATCH a Firestore document at the given path. Throws on failure so the caller
// can surface the error to the diagnostic endpoint / dashboard.
async function patchFirestoreDoc(path, fields) {
  if (!API_KEY) throw new Error('FIREBASE_WEB_API_KEY environment variable missing on Vercel');
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?${mask}&key=${API_KEY}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toFsDoc(fields)),
  });
  if (!r.ok) {
    const errBody = await r.text();
    console.error('Firestore PATCH failed:', path, r.status, errBody);
    throw new Error(`Firestore PATCH ${r.status} on ${path}: ${errBody.slice(0, 400)}`);
  }
  return await r.json();
}

// Best-effort delete (used to clean up a stale `unknown_<awb>` placeholder doc once
// the AWB has been re-enriched under the customer's real phone). Never throws.
async function deleteFirestoreDoc(path) {
  if (!API_KEY) return;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?key=${API_KEY}`;
  try {
    await fetch(url, { method: 'DELETE' });
  } catch (e) {
    console.warn('Firestore DELETE failed (non-fatal):', path, e?.message || e);
  }
}

// ─────── Nimbus + Shopify lookups ───────

export async function fetchNimbusDetails(awb) {
  const url = `https://ship.nimbuspost.com/mapi/v1/shipment/track/track-awb/${awb}`;
  const r = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT,
      'Referer': `https://ship.nimbuspost.com/shipping/tracking/${awb}`,
    },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.data || j || null;
}

export async function fetchShopifyOrder(ref) {
  if (!ref || !SHOPIFY_TOKEN) return null;
  const headers = { 'X-Shopify-Access-Token': SHOPIFY_TOKEN, 'Accept': 'application/json' };
  const numeric = String(ref).replace(/[^0-9]/g, '');
  const hadHash = String(ref).startsWith('#');

  const tryName = async (name) => {
    const url = `https://${SHOPIFY_HOSTNAME}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&name=${encodeURIComponent(name)}&limit=1`;
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.orders?.[0] || null;
  };
  const tryId = async (id) => {
    const url = `https://${SHOPIFY_HOSTNAME}/admin/api/${SHOPIFY_API_VERSION}/orders/${id}.json`;
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.order || null;
  };

  if (hadHash || numeric.length < 10) {
    return (await tryName(`#${numeric}`)) || (await tryName(numeric)) || (await tryId(numeric));
  }
  return (await tryId(numeric)) || (await tryName(`#${numeric}`)) || (await tryName(numeric));
}

// ─────── Main enrichment ───────

function normalizePhone(p) {
  return String(p || '').replace(/\D/g, '');
}

/**
 * Decide COD vs Prepaid for a Shopify order.
 *
 * Why this is needed: when the CRM creates an order it attaches a payment
 * transaction whose gateway is "Cash on Delivery (COD)" (pending) or
 * "Standard (Prepaid)" (success). Shopify keeps the custom gateway name for a
 * SUCCESSFUL (paid) transaction — so prepaid orders read back as
 * "Standard (Prepaid)" — but it normalises a PENDING transaction's gateway to
 * the generic "manual". That's why COD orders showed up as "manual".
 *
 * So `payment_gateway_names` / `gateway` alone can't be trusted for COD. We detect
 * COD from the shipping-line title (the CRM sets "Cash on Delivery (COD)" there),
 * tags and gateways; everything else keeps Shopify's real gateway name as-is
 * (prepaid stays "Standard (Prepaid)").
 */
function derivePaymentMode(order) {
  if (!order) return '';
  const gateways = (order.payment_gateway_names || []).join(' ');
  const shipTitles = (order.shipping_lines || []).map(s => s.title || '').join(' ');
  const hay = `${gateways} ${shipTitles} ${order.tags || ''} ${order.gateway || ''}`.toLowerCase();
  if (hay.includes('cash on delivery') || /\bcod\b/.test(hay)) return 'Cash on Delivery (COD)';
  // Prepaid (and anything else): keep Shopify's real gateway name, e.g. "Standard (Prepaid)".
  if (gateways && !/^\s*manual\s*$/i.test(gateways)) return order.payment_gateway_names[0];
  if (order.financial_status === 'pending') return 'Cash on Delivery (COD)';
  return order.payment_gateway_names?.[0] || (order.financial_status === 'paid' ? 'Prepaid' : '');
}

// Normalise the raw courier status text into a clean lifecycle stage — mirrors the
// CRM Logistics dashboard so the sheet's "Status" column matches what staff see.
function classifyStatus(raw) {
  const ns = (raw || '').toLowerCase();
  if (!ns) return 'Pending';
  if (ns.includes('rto') || ns.includes('return to origin') || ns.includes('fail') ||
      ns.includes('cancel') || ns.includes('undeliver') || ns.includes('refuse')) return 'Failed/RTO';
  if (ns.includes('delivered') && !ns.includes('out')) return 'Delivered';
  if (ns.includes('out for delivery') || ns === 'out_for_delivery') return 'Out for delivery';
  if (ns.includes('exception') || ns.includes('hold') || ns.includes('delay')) return 'Exception';
  if (ns.includes('transit') || ns === 'in transit') return 'In transit';
  if (ns.includes('picked') || ns.includes('shipped') || ns.includes('dispatch') || ns.includes('manifest')) return 'Shipped';
  return raw;
}

// The earliest event_time in the timeline whose status matches a milestone — so we
// can record WHEN the parcel was shipped / out for delivery / reached / delivered.
function milestoneTime(timeline, pred) {
  let earliest = '';
  for (const ev of timeline) {
    const st = (ev.status || '').toLowerCase();
    const code = (ev.statusCode || '').toLowerCase();
    if (pred(st, code)) {
      const t = ev.event_time || '';
      if (t && (!earliest || t < earliest)) earliest = t;
    }
  }
  return earliest;
}

// Upsert one shipment row into the Google Sheet "shipments" tab (keyed by AWB) via
// the Apps Script web app. Best-effort — never throws, so a sheet hiccup can't fail
// the webhook (the Firestore write already succeeded by this point).
async function pushShipmentToSheet(awb, updates) {
  if (!SHEETS_SCRIPT_URL) return { ok: false, skipped: 'no_script_url' };
  try {
    const r = await fetch(SHEETS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ tab: 'shipments', keyField: 'AWB', key: awb, updates, updatedBy: 'Nimbus tracker' }),
      redirect: 'follow',
    });
    const text = await r.text();
    let data = {};
    try { data = JSON.parse(text); } catch (_) { /* Apps Script may wrap in HTML on error */ }
    if (!r.ok || data.ok === false) {
      console.warn('[sheet] shipment upsert non-ok for', awb, r.status, (data.error || text || '').slice(0, 200));
      return { ok: false, status: r.status, error: data.error || 'non_ok' };
    }
    return { ok: true, row: data.row };
  } catch (e) {
    console.warn('[sheet] shipment upsert failed for', awb, e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Run the full enrichment pipeline for one AWB and write into Firestore.
 *   shipments/{phone}/awbs/{awb}  ← full enriched doc
 *   shipments/{phone}             ← customer summary doc (merged)
 *
 * Status fields (status, location, lastEventTime, etc.) get refreshed on every
 * call; customer/order info is also refreshed (cheap — Shopify is single-fetch).
 * Finally the row is mirrored into the Google Sheet "shipments" tab.
 */
export async function enrichAwbAndCache(awb, latestEvent = {}, source = 'webhook') {
  try {
    const details = await fetchNimbusDetails(awb);
    const orderNumber = details?.order_number || null;
    const orderId     = details?.order_id ? String(details.order_id) : null;
    const courier     = details?.courier_name || latestEvent.courier || 'Nimbus';

    // Full event history from Nimbus's track API (newest-first). This is the
    // authoritative timeline — webhook pushes are lossy/delayed, so we re-pull the
    // complete history on every enrichment (webhook trigger OR manual sync).
    const rawHistory = Array.isArray(details?.history) ? details.history : [];
    const history = rawHistory.map(h => ({
      status:        h.ship_status    || h.status || '',
      statusCode:    h.status_code    || '',
      courierStatus: h.courier_status || '',
      location:      h.location       || '',
      event_time:    h.event_time     || '',
      message:       h.message        || '',
    }));
    // Fold in the webhook-provided event too (it may be newer than the pull), then
    // dedupe and sort newest-first so history[0] is always the latest scan.
    if (latestEvent && (latestEvent.status || latestEvent.event_time)) {
      history.push({
        status:        latestEvent.status     || '',
        statusCode:    latestEvent.status_code || '',
        courierStatus: '',
        location:      latestEvent.location   || '',
        event_time:    latestEvent.event_time || '',
        message:       latestEvent.message    || '',
      });
    }
    const seenEv = new Set();
    const timeline = history
      .filter(ev => {
        const key = `${ev.event_time || ''}|${(ev.status || '').toLowerCase()}|${ev.message || ''}`;
        if (seenEv.has(key)) return false;
        seenEv.add(key);
        return true;
      })
      .sort((a, b) => (b.event_time || '').localeCompare(a.event_time || ''));
    const newest = timeline[0] || {};

    const order = await fetchShopifyOrder(orderNumber || orderId);
    const sh = order?.shipping_address || {};
    const fn = order?.customer?.first_name || '';
    const ln = order?.customer?.last_name  || '';

    const customer = {
      name:  order ? ((fn + ' ' + ln).trim() || sh.name || '') : '',
      phone: order ? (order.customer?.phone || sh.phone || '') : '',
      email: order?.customer?.email || order?.email || '',
    };

    const phoneKey = normalizePhone(customer.phone) || `unknown_${awb}`;

    // ─── Write the AWB document ───
    const awbDoc = {
      awb,
      phoneKey,
      orderNumber: orderNumber || '',
      orderId:     orderId     || '',
      courier,
      // Latest tracking event (derived from the newest event across pulled history + webhook)
      status:        newest.status     || latestEvent.status || details?.status || '',
      rawStatus:     newest.status     || latestEvent.status || '',
      lastLocation:  newest.location   || latestEvent.location   || '',
      lastEventTime: newest.event_time || latestEvent.event_time || '',
      lastMessage:   newest.message    || latestEvent.message    || '',
      rtoAwb:        latestEvent.rto_awb || details?.rto_awb || '',
      // Full authoritative timeline (newest-first) + count
      history:       timeline,
      eventCount:    timeline.length,
      // Customer / order details from Shopify
      customer,
      shippingAddress: {
        address: [sh.address1, sh.address2].filter(Boolean).join(', '),
        city:    sh.city     || '',
        state:   sh.province || '',
        pincode: sh.zip      || '',
      },
      items:        order?.line_items?.map(i => ({ name: i.name || i.title, qty: i.quantity })) || [],
      itemCount:    order?.line_items?.reduce((a, i) => a + (i.quantity || 0), 0) || 0,
      amount:       order ? parseFloat(order.total_price || 0) : 0,
      paymentMode:  derivePaymentMode(order),
      // Bookkeeping
      orderCreated: details?.created || (order?.created_at ? new Date(order.created_at).toLocaleString('en-IN') : ''),
      edd:          details?.edd    || '',
      enrichmentSource: source,
      updatedAt:    new Date().toISOString(),
    };
    const awbWrite = await patchFirestoreDoc(`shipments/${phoneKey}/awbs/${awb}`, awbDoc);

    // If we resolved a real customer phone, remove any stale placeholder doc written
    // under `unknown_<awb>` by an earlier enrichment (before Shopify returned a
    // customer). Otherwise the dashboard sees two docs for one AWB and the empty one
    // can hide the enriched data.
    if (!String(phoneKey).startsWith('unknown_')) {
      await deleteFirestoreDoc(`shipments/unknown_${awb}/awbs/${awb}`);
    }

    // ─── Update parent customer summary (merge) ───
    let parentWrite = null;
    if (customer.name || customer.phone || customer.email) {
      parentWrite = await patchFirestoreDoc(`shipments/${phoneKey}`, {
        phone:       customer.phone || phoneKey,
        name:        customer.name  || '',
        email:       customer.email || '',
        latestAwb:   awb,
        latestStatus: awbDoc.status,
        lastOrderAt: new Date().toISOString(),
      });
    }

    // ─── Mirror into the Google Sheet "shipments" tab (standalone tracker) ───
    // Milestone timestamps derived from the full timeline.
    const shippedAt        = milestoneTime(timeline, (st) => st.includes('picked') || st.includes('pickup') || st.includes('manifest') || st.includes('dispatch') || st.includes('shipped'));
    const inTransitAt      = milestoneTime(timeline, (st) => st.includes('transit'));
    const outForDeliveryAt = milestoneTime(timeline, (st, code) => st.includes('out for delivery') || st === 'out_for_delivery' || code === 'ofd');
    const reachedAt        = milestoneTime(timeline, (st, code) => (st.includes('reached') && st.includes('dest')) || st === 'rad' || code === 'rad');
    const deliveredAt      = milestoneTime(timeline, (st) => st.includes('delivered') && !st.includes('out') && !st.includes('rto'));
    const rtoAt            = milestoneTime(timeline, (st) => st.includes('rto') || st.includes('return to origin'));

    const sheetUpdates = {
      'Order ID':            awbDoc.orderId,
      'Order Number':        awbDoc.orderNumber,
      'Courier':             awbDoc.courier,
      'Customer Name':       customer.name,
      'Phone':               customer.phone,
      'Email':               customer.email,
      'Address':             awbDoc.shippingAddress.address,
      'City':                awbDoc.shippingAddress.city,
      'State':               awbDoc.shippingAddress.state,
      'Pincode':             awbDoc.shippingAddress.pincode,
      'Items':               awbDoc.items.map(i => `${i.qty}× ${i.name}`).join(', '),
      'Item Count':          awbDoc.itemCount,
      'Amount':              awbDoc.amount,
      'Payment':             awbDoc.paymentMode,
      'Status':              classifyStatus(awbDoc.status),
      'Raw Status':          awbDoc.rawStatus,
      'Last Location':       awbDoc.lastLocation,
      'Last Event Time':     awbDoc.lastEventTime,
      'Shipped At':          shippedAt,
      'In Transit At':       inTransitAt,
      'Out For Delivery At': outForDeliveryAt,
      'Reached At':          reachedAt,
      'Delivered At':        deliveredAt,
      'RTO At':              rtoAt,
      'RTO AWB':             awbDoc.rtoAwb,
      'Event Count':         awbDoc.eventCount,
      'Tracking URL':        nimbusTrackingUrl(awb),
      'Order Created':       awbDoc.orderCreated,
      'EDD':                 awbDoc.edd,
    };
    const sheetResult = await pushShipmentToSheet(awb, sheetUpdates);

    return {
      ok: true,
      awb,
      phoneKey,
      orderNumber,
      customerFound: !!order,
      sheetSynced: !!sheetResult.ok,
      wrote: {
        awbPath: `shipments/${phoneKey}/awbs/${awb}`,
        parentPath: parentWrite ? `shipments/${phoneKey}` : null,
        awbDocName: awbWrite?.name || null,
        sheetRow: sheetResult.row || null,
      },
    };
  } catch (e) {
    console.error('Enrichment failed for AWB', awb, e?.message || e);
    return { ok: false, awb, error: e?.message || String(e), stage: e?.stage || 'unknown' };
  }
}
