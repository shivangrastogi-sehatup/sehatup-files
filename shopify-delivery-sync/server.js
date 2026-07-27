// shopify-delivery-sync — mark Shopify orders as Delivered from Nimbus tracking data.
//
// Reads the enriched shipment docs the CRM already maintains:
//   shipments/{phoneKey}/awbs/{awb}   (Firestore, project sehatup-f96b5)
// finds the ones Nimbus reports as Delivered, matches them to a Shopify order via
// `orderId` / `orderNumber`, buckets them by the SHOPIFY ORDER DATE (created_at, IST),
// and posts a fulfillment event with status "delivered".
//
// Two paths, because the store's fulfillment feed stopped on 9 May 2026:
//   A) order already has a fulfillment  → POST the delivered event only.        (default)
//   B) order has NO fulfillment         → create one (tracking = AWB, notify_customer
//                                          = false) and THEN post the event.    (opt-in)
//
// Everything is dry-run unless explicitly turned off, single-row updates are always
// available, and every applied action is appended to logs/apply-<date>.jsonl.
//
// Zero dependencies — Node 20 built-ins only.  Run:  npm start

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4310);

// ── Config ────────────────────────────────────────────────────────────────────

const FIREBASE_PROJECT = 'sehatup-f96b5';
const FIREBASE_API_KEY = 'AIzaSyBCuj9geUYV69Ievt59WO8PjJWQZ1cKDLw'; // public web key (same as CRM)
const SHOPIFY_HOST     = '0ec320-gj.myshopify.com';
const SHOPIFY_VERSION  = '2024-01';
const SHOP_TZ          = 'Asia/Kolkata';
const NIMBUS_TRACK_URL = (awb) => `https://ship.nimbuspost.com/shipping/tracking/${awb}`;

// The Shopify Admin token lives in sehatup-analytics/.env (same one the CRM proxy uses).
// A local .env in this folder wins, so the tool can be pointed elsewhere without
// touching the CRM's file.
function loadShopifyToken() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', 'sehatup-analytics', '.env'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const m = /^SHOPIFY_ACCESS_TOKEN=(.*)$/m.exec(fs.readFileSync(file, 'utf8'));
    if (m && m[1].trim()) return { token: m[1].trim(), from: file };
  }
  return { token: '', from: null };
}
const { token: SHOPIFY_TOKEN, from: TOKEN_SOURCE } = loadShopifyToken();

// ── Session (in memory only — the password is never written to disk) ──────────

const session = { idToken: null, refreshToken: null, email: null, expiresAt: 0 };

async function firebaseLogin(email, password) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `login failed (${r.status})`);
  session.idToken = j.idToken;
  session.refreshToken = j.refreshToken;
  session.email = j.email;
  session.expiresAt = Date.now() + (Number(j.expiresIn || 3600) - 120) * 1000;
  return session.email;
}

// ID tokens last an hour; a long scan can outlive one, so refresh transparently.
async function ensureToken() {
  if (!session.idToken) throw new Error('not signed in');
  if (Date.now() < session.expiresAt) return session.idToken;
  const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refreshToken)}`,
  });
  const j = await r.json();
  if (!r.ok) throw new Error('session expired — sign in again');
  session.idToken = j.id_token;
  session.refreshToken = j.refresh_token;
  session.expiresAt = Date.now() + (Number(j.expires_in || 3600) - 120) * 1000;
  return session.idToken;
}

// ── Firestore REST ────────────────────────────────────────────────────────────

function fromFsValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue'    in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue'  in v) return v.doubleValue;
  if ('stringValue'  in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue'   in v) return (v.arrayValue.values || []).map(fromFsValue);
  if ('mapValue'     in v) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) out[k] = fromFsValue(val);
    return out;
  }
  return null;
}

// Pull every doc in the `awbs` collection group, paging on __name__ (no composite
// index needed). `shipments_test/...` docs are the CRM's sandbox — always skipped.
async function fetchAllAwbDocs(onProgress) {
  const idToken = await ensureToken();
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery`;
  const PAGE = 300;
  const docs = [];
  let cursor = null;

  for (let guard = 0; guard < 200; guard++) {
    const structuredQuery = {
      from: [{ collectionId: 'awbs', allDescendants: true }],
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
      limit: PAGE,
    };
    if (cursor) structuredQuery.startAt = { values: [{ referenceValue: cursor }], before: false };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ structuredQuery }),
    });
    const rows = await r.json();
    // runQuery reports permission/index problems as an error object *inside* a 200
    // body, so checking r.ok alone would silently yield "0 documents".
    const fault = rows?.error || (Array.isArray(rows) ? rows.find((x) => x?.error)?.error : null);
    if (!r.ok || fault) throw new Error(fault?.message || `Firestore ${r.status}`);
    if (!Array.isArray(rows)) throw new Error('unexpected Firestore response');

    let got = 0;
    for (const row of rows) {
      const d = row?.document;
      if (!d) continue;
      got++;
      cursor = d.name;
      if (d.name.includes('/documents/shipments_test/')) continue;
      const data = {};
      for (const [k, v] of Object.entries(d.fields || {})) data[k] = fromFsValue(v);
      docs.push(data);
    }
    onProgress?.(docs.length);
    if (got < PAGE) break;
  }
  return docs;
}

// ── Shopify REST ──────────────────────────────────────────────────────────────

let lastShopifyCall = 0;
// Shopify allows 2 requests/second on REST. Serialise calls ~500ms apart and honour
// Retry-After when we still get throttled.
async function shopify(pathname, { method = 'GET', body = null } = {}) {
  if (!SHOPIFY_TOKEN) throw new Error('SHOPIFY_ACCESS_TOKEN not found');
  const wait = Math.max(0, 520 - (Date.now() - lastShopifyCall));
  if (wait) await new Promise((res) => setTimeout(res, wait));

  const url = pathname.startsWith('http')
    ? pathname
    : `https://${SHOPIFY_HOST}/admin/api/${SHOPIFY_VERSION}${pathname}`;

  for (let attempt = 0; attempt < 4; attempt++) {
    lastShopifyCall = Date.now();
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
      const retry = Number(r.headers.get('retry-after') || 2);
      await new Promise((res) => setTimeout(res, retry * 1000));
      continue;
    }
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* Shopify can return HTML on 5xx */ }
    if (!r.ok) {
      const err = json?.errors ? JSON.stringify(json.errors) : text.slice(0, 300);
      throw new Error(`Shopify ${method} ${pathname} → ${r.status}: ${err}`);
    }
    return { json, link: r.headers.get('link') };
  }
  throw new Error(`Shopify ${pathname} — rate limited after 4 attempts`);
}

// Every order created in [from, to) IST, following cursor pagination.
async function fetchOrdersInRange(fromDate, toDate) {
  const fields = 'id,name,created_at,financial_status,fulfillment_status,total_price,customer,fulfillments';
  let pathname =
    `/orders.json?status=any&limit=250&fields=${fields}` +
    `&created_at_min=${encodeURIComponent(fromDate + 'T00:00:00+05:30')}` +
    `&created_at_max=${encodeURIComponent(toDate + 'T00:00:00+05:30')}`;
  const orders = [];
  while (pathname) {
    const { json, link } = await shopify(pathname);
    orders.push(...(json?.orders || []));
    const next = /<([^>]+)>;\s*rel="next"/.exec(link || '');
    pathname = next ? next[1] : null;
  }
  return orders;
}

// ── Delivery detection (mirrors sehatup-analytics/api/_lib/enrich.js) ─────────

// "RTO Delivered", "Out for delivery" and "Undelivered" must NEVER count as delivered.
// Note "Undelivered" CONTAINS the substring "delivered", so every negative case has to
// be rejected before the positive test — the same ordering enrich.js relies on.
const NEGATIVE_STATUS = /rto|return to origin|undeliver|refuse|ndr|attempt|cancel|fail/;
const isDeliveredText = (s) => {
  const t = String(s || '').toLowerCase();
  if (!t) return false;
  if (NEGATIVE_STATUS.test(t)) return false;
  return t.includes('delivered') && !t.includes('out');
};

// Earliest genuine delivered event in the Nimbus timeline → used as `happened_at`.
function deliveryInfo(doc) {
  let at = '';
  for (const ev of Array.isArray(doc.history) ? doc.history : []) {
    if (!isDeliveredText(ev.status)) continue;
    const t = ev.event_time || '';
    if (t && (!at || t < at)) at = t;
  }
  const flagged = isDeliveredText(doc.status) || isDeliveredText(doc.rawStatus);
  return { delivered: Boolean(at) || flagged, deliveredAt: at };
}

// Nimbus sends "2026-06-14 10:22:00" with no zone — it's IST.
function toIso(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}+05:30`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const istDay = (iso) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));

// ── Scan: build the candidate list for one month ──────────────────────────────

const MONTHS = {
  '2026-05': { label: 'May 2026',  from: '2026-05-01', to: '2026-06-01' },
  '2026-06': { label: 'June 2026', from: '2026-06-01', to: '2026-07-01' },
  '2026-07': { label: 'July 2026', from: '2026-07-01', to: '2026-08-01' },
};

let awbCache = { at: 0, docs: null };

async function scan(monthKey, { refresh = false } = {}) {
  const month = MONTHS[monthKey];
  if (!month) throw new Error(`unknown month ${monthKey}`);

  // Firestore side (cached 5 min — one scan covers all three month tabs).
  if (refresh || !awbCache.docs || Date.now() - awbCache.at > 5 * 60_000) {
    awbCache = { at: Date.now(), docs: await fetchAllAwbDocs() };
  }
  const awbDocs = awbCache.docs;

  // Shopify side: every order created in the month, with its fulfillments.
  const orders = await fetchOrdersInRange(month.from, month.to);
  const byId = new Map();
  const byName = new Map();
  for (const o of orders) {
    byId.set(String(o.id), o);
    byName.set(String(o.name).replace(/^#/, ''), o);
  }

  // Match to a Shopify order: numeric id first, then "#1234", then the Excel hint.
  const findOrder = (doc) => {
    if (doc.orderId && byId.has(String(doc.orderId))) return byId.get(String(doc.orderId));
    for (const ref of [doc.orderNumber, doc.nimbusOrderRef]) {
      if (!ref) continue;
      const key = String(ref).replace(/^#/, '').trim();
      if (key && byName.has(key)) return byName.get(key);
    }
    return null;
  };
  const findFulfillment = (order, awb) => {
    const fs_ = order.fulfillments || [];
    return fs_.find((f) => String(f.tracking_number || '').trim() === String(awb).trim())
        || fs_[fs_.length - 1] || null;
  };

  const rows = [];
  const mismatches = [];
  let deliveredTotal = 0;
  let unmatched = 0;

  for (const doc of awbDocs) {
    const info = deliveryInfo(doc);
    const statusText = String(doc.status || doc.rawStatus || '').toLowerCase();
    const isNegative = NEGATIVE_STATUS.test(statusText);
    if (info.delivered) deliveredTotal++;
    if (!info.delivered && !isNegative) continue; // pending / in transit — nothing to do

    const order = findOrder(doc);
    if (!order) {
      if (info.delivered) unmatched++; // different month, or no Shopify order at all
      continue;
    }
    const match = findFulfillment(order, doc.awb);

    // Nimbus says this FAILED but Shopify says delivered. An earlier build of this tool
    // treated "Undelivered" as delivered (the substring trap), so these need a human.
    if (!info.delivered) {
      if (match?.shipment_status === 'delivered') {
        mismatches.push({
          awb: doc.awb,
          orderName: order.name,
          orderId: String(order.id),
          orderDay: istDay(order.created_at),
          nimbusStatus: doc.status || doc.rawStatus || '',
          fulfillmentId: String(match.id),
        });
      }
      continue;
    }

    let action, note;
    if (match && match.shipment_status === 'delivered') {
      action = 'skip';
      note = 'already delivered in Shopify';
    } else if (match) {
      action = 'event';
      note = `fulfillment ${match.id} · currently ${match.shipment_status || 'no status'}`;
    } else {
      action = 'create+event';
      note = 'no fulfillment in Shopify — must be created first';
    }

    rows.push({
      awb: doc.awb,
      orderId: String(order.id),
      orderName: order.name,
      orderCreatedAt: order.created_at,
      orderDay: istDay(order.created_at),
      customer: doc.customer?.name || [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ') || '',
      phone: doc.customer?.phone || '',
      amount: order.total_price ? Number(order.total_price) : null,
      financialStatus: order.financial_status || '',
      courier: doc.courier || 'Nimbus',
      deliveredAt: info.deliveredAt || '',
      deliveredAtIso: toIso(info.deliveredAt),
      fulfillmentId: match?.id ? String(match.id) : null,
      shipmentStatus: match?.shipment_status || null,
      action,
      note,
    });
  }

  rows.sort((a, b) => (a.orderCreatedAt || '').localeCompare(b.orderCreatedAt || ''));

  return {
    month: monthKey,
    monthLabel: month.label,
    scannedAwbDocs: awbDocs.length,
    deliveredTotal,
    ordersInMonth: orders.length,
    unmatched,
    counts: {
      event: rows.filter((r) => r.action === 'event').length,
      createEvent: rows.filter((r) => r.action === 'create+event').length,
      skip: rows.filter((r) => r.action === 'skip').length,
    },
    mismatches,
    rows,
  };
}

// ── Apply: create fulfillment (opt-in) + post the delivered event ─────────────

function logApply(entry) {
  const dir = path.join(__dirname, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `apply-${new Date().toISOString().slice(0, 10)}.jsonl`);
  fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

async function createFulfillment(row) {
  const { json } = await shopify(`/orders/${row.orderId}/fulfillment_orders.json`);
  const open = (json?.fulfillment_orders || []).filter(
    (fo) => fo.status === 'open' && (fo.supported_actions || []).includes('create_fulfillment')
  );
  if (!open.length) throw new Error('no open fulfillment order (nothing left to fulfill)');

  const res = await shopify('/fulfillments.json', {
    method: 'POST',
    body: {
      fulfillment: {
        line_items_by_fulfillment_order: open.map((fo) => ({ fulfillment_order_id: fo.id })),
        tracking_info: {
          number: row.awb,
          company: 'Other',
          url: NIMBUS_TRACK_URL(row.awb),
        },
        notify_customer: false, // never email the customer weeks after the fact
      },
    },
  });
  const id = res.json?.fulfillment?.id;
  if (!id) throw new Error('fulfillment created but no id returned');
  return String(id);
}

async function postDeliveredEvent(orderId, fulfillmentId, happenedAtIso) {
  const send = (withTime) =>
    shopify(`/orders/${orderId}/fulfillments/${fulfillmentId}/events.json`, {
      method: 'POST',
      body: { event: withTime ? { status: 'delivered', happened_at: withTime } : { status: 'delivered' } },
    });
  try {
    return await send(happenedAtIso || null);
  } catch (e) {
    // Shopify rejects a happened_at that predates the fulfillment — retry with "now".
    if (happenedAtIso && /happened_at|invalid/i.test(e.message)) return await send(null);
    throw e;
  }
}

async function applyRow(row, { dryRun, createMissing }) {
  const base = { awb: row.awb, order: row.orderName, orderId: row.orderId, action: row.action };

  if (row.action === 'skip') return { ...base, status: 'skipped', message: 'already delivered' };
  if (row.action === 'create+event' && !createMissing) {
    return { ...base, status: 'skipped', message: 'needs a new fulfillment — enable "create missing fulfillments"' };
  }
  if (dryRun) {
    return {
      ...base,
      status: 'dry-run',
      message: row.action === 'event'
        ? `would POST delivered event to fulfillment ${row.fulfillmentId}`
        : `would CREATE fulfillment (tracking ${row.awb}, notify_customer=false) then POST delivered event`,
    };
  }

  try {
    let fulfillmentId = row.fulfillmentId;
    let created = false;
    if (!fulfillmentId) {
      fulfillmentId = await createFulfillment(row);
      created = true;
    }
    await postDeliveredEvent(row.orderId, fulfillmentId, row.deliveredAtIso);
    const out = {
      ...base,
      status: 'ok',
      fulfillmentId,
      created,
      message: created ? 'fulfillment created + marked delivered' : 'marked delivered',
    };
    logApply(out);
    return out;
  } catch (e) {
    const out = { ...base, status: 'error', message: e.message };
    logApply(out);
    return out;
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });

const send = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === '/api/status') {
      return send(res, 200, {
        signedIn: Boolean(session.idToken),
        email: session.email,
        shopifyToken: Boolean(SHOPIFY_TOKEN),
        tokenSource: TOKEN_SOURCE,
        months: Object.entries(MONTHS).map(([k, v]) => ({ key: k, label: v.label })),
      });
    }

    if (url.pathname === '/api/login' && req.method === 'POST') {
      const { email, password } = await readBody(req);
      if (!email || !password) return send(res, 400, { error: 'email and password required' });
      const who = await firebaseLogin(email, password);
      return send(res, 200, { ok: true, email: who });
    }

    if (url.pathname === '/api/scan') {
      const result = await scan(url.searchParams.get('month') || '2026-05', {
        refresh: url.searchParams.get('refresh') === '1',
      });
      return send(res, 200, result);
    }

    if (url.pathname === '/api/apply' && req.method === 'POST') {
      const { rows = [], dryRun = true, createMissing = false } = await readBody(req);
      if (!Array.isArray(rows) || !rows.length) return send(res, 400, { error: 'no rows supplied' });
      const results = [];
      for (const row of rows) results.push(await applyRow(row, { dryRun, createMissing }));
      return send(res, 200, {
        dryRun,
        results,
        summary: {
          ok: results.filter((r) => r.status === 'ok').length,
          skipped: results.filter((r) => r.status === 'skipped').length,
          dryRun: results.filter((r) => r.status === 'dry-run').length,
          errors: results.filter((r) => r.status === 'error').length,
        },
      });
    }

    // Static files
    const file = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = path.join(__dirname, 'public', path.normalize(file).replace(/^([/\\])+/, ''));
    if (full.startsWith(path.join(__dirname, 'public')) && fs.existsSync(full)) {
      const type = full.endsWith('.html') ? 'text/html' : full.endsWith('.js') ? 'text/javascript' : 'text/plain';
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      return res.end(fs.readFileSync(full));
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n  shopify-delivery-sync  →  http://localhost:${PORT}\n`);
  console.log(`  Shopify token : ${SHOPIFY_TOKEN ? `loaded from ${TOKEN_SOURCE}` : 'NOT FOUND — set SHOPIFY_ACCESS_TOKEN'}`);
  console.log(`  Firestore     : ${FIREBASE_PROJECT} (sign in with your CRM account in the UI)\n`);
});
