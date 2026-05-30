import crypto from 'crypto';
import { upsertSheetRow } from './_lib/sheets.js';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'sehatup-f96b5';
const API_KEY    = process.env.FIREBASE_WEB_API_KEY  || '';
const SECRET     = process.env.NIMBUS_WEBHOOK_SECRET || '';

const SHOPIFY_HOSTNAME = '0ec320-gj.myshopify.com';
const SHOPIFY_API_VERSION = '2024-01';
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function toFirestoreValue(v) {
  if (v === null || v === undefined)    return { nullValue: null };
  if (typeof v === 'boolean')           return { booleanValue: v };
  if (typeof v === 'number' && Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === 'number')            return { doubleValue: v };
  if (Array.isArray(v))                 return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function toFirestoreDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v);
  return { fields };
}

async function writeToFirestore(payload) {
  if (!API_KEY) {
    console.error('FIREBASE_WEB_API_KEY is not set — skipping Firestore write');
    return;
  }
  const doc = toFirestoreDoc({ ...payload, receivedAt: new Date().toISOString() });
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/nimbus_tracking?key=${API_KEY}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
  if (!r.ok) console.error('Firestore write error:', await r.text());
}

// Call Nimbus's internal tracking API to get order_number, courier_name, etc.
async function fetchNimbusDetails(awb) {
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

// Look up a Shopify order by name (e.g. "#1738") or internal numeric id.
async function fetchShopifyOrder(ref) {
  if (!ref || !SHOPIFY_TOKEN) return null;
  const headers = {
    'X-Shopify-Access-Token': SHOPIFY_TOKEN,
    'Accept': 'application/json',
  };
  const numeric = String(ref).replace(/[^0-9]/g, '');
  const hadHash = String(ref).startsWith('#');

  // Try search-by-name first when value looks like an order_number
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

// Enrich the AWB with Nimbus + Shopify data and upsert the row into the
// "shipments" tab of the Google Sheet. Status-only fields are always refreshed;
// customer info is only written if missing (avoid overwriting manual edits).
async function enrichAndCacheToSheet(awb, latestEvent) {
  try {
    const details = await fetchNimbusDetails(awb);
    const orderNumber = details?.order_number || null;
    const orderId     = details?.order_id ? String(details.order_id) : null;
    const courier     = details?.courier_name || latestEvent.courier || 'Nimbus';

    const order = await fetchShopifyOrder(orderNumber || orderId);
    const sh = order?.shipping_address || {};
    const fn = order?.customer?.first_name || '';
    const ln = order?.customer?.last_name || '';

    const updates = {
      'Order ID':       orderId  || '',
      'Order Number':   orderNumber || '',
      'Courier':        courier,
      'Customer Name':  order ? ((fn + ' ' + ln).trim() || sh.name || '') : '',
      'Phone':          order ? (order.customer?.phone || sh.phone || '') : '',
      'Email':          order?.customer?.email || order?.email || '',
      'Address':        [sh.address1, sh.address2].filter(Boolean).join(', '),
      'City':           sh.city     || '',
      'State':          sh.province || '',
      'Pincode':        sh.zip      || '',
      'Items':          order?.line_items?.map(i => `${i.name} x ${i.quantity}`).join('; ') || '',
      'Item Count':     order?.line_items?.reduce((a, i) => a + (i.quantity || 0), 0) || 0,
      'Amount':         order ? parseFloat(order.total_price || 0) : 0,
      'Payment':        order ? ((order.gateway || '').toLowerCase().includes('cash') ? 'COD' : (order.payment_gateway_names?.[0] || 'Prepaid')) : '',
      'Status':         latestEvent.status || details?.current_status || '',
      'Raw Status':     latestEvent.status || '',
      'Last Location':  latestEvent.location || '',
      'Last Event Time': latestEvent.event_time || '',
      'Order Created':  details?.created || (order?.created_at ? new Date(order.created_at).toLocaleString('en-IN') : ''),
      'EDD':            details?.edd || '',
    };

    await upsertSheetRow({
      tab: 'shipments',
      key: awb,
      keyField: 'AWB',
      updates,
      updatedBy: 'nimbus-webhook',
    });
  } catch (e) {
    console.error('Sheet enrichment failed for AWB', awb, e?.message || e);
  }
}

export default async function handler(req, res) {
  // CORS — allows manual testing from the browser. Nimbus → webhook is server-to-server
  // so CORS doesn't apply there; this is purely for dev tools.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hmac-Sha256');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, service: 'nimbus-webhook' });
  }

  if (SECRET) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expected = Buffer.from(crypto.createHmac('sha256', SECRET).update(rawBody).digest()).toString('base64');
    const received = req.headers['x-hmac-sha256'] || '';
    if (expected !== received) {
      console.error('HMAC mismatch');
      return res.status(200).json({ ok: true, warn: 'signature_mismatch' });
    }
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(200).json({ ok: true, warn: 'parse_error' });
  }

  console.log('Nimbus webhook payload:', JSON.stringify(body));
  if (!body?.awb_number) return res.status(200).json({ ok: true, warn: 'missing_awb' });

  // Respond 200 to Nimbus immediately
  res.status(200).json({ ok: true });

  // Async: Firestore write + Google Sheet enrichment (don't block Nimbus)
  try {
    await writeToFirestore(body);
    await enrichAndCacheToSheet(body.awb_number, body);
  } catch (e) {
    console.error('Async post-response error:', e);
  }
}
