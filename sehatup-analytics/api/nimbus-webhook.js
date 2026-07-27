import crypto from 'crypto';
import { enrichAwbAndCache } from './_lib/enrich.js';
import { authHeader, hasServiceAccount } from './_lib/google-auth.js';

// Vercel Fluid compute can finish background work after the response is sent, via
// `waitUntil` from "@vercel/functions". We load it defensively: if the package isn't
// installed, we fall back to fire-and-forget (best-effort) so the webhook never crashes
// — the daily cron re-enriches anything that gets dropped either way.
async function runInBackground(promise) {
  const safe = Promise.resolve(promise).catch(
    (e) => console.error('[nimbus-webhook] enrichment failed -', e?.message || e)
  );
  try {
    const { waitUntil } = await import('@vercel/functions');
    waitUntil(safe);
  } catch (_) {
    /* package not available — let it run fire-and-forget */
  }
}

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'sehatup-f96b5';
const API_KEY    = process.env.FIREBASE_WEB_API_KEY  || '';
const SECRET     = process.env.NIMBUS_WEBHOOK_SECRET || '';

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

// Writes go through the service account, which bypasses security rules — so this keeps
// working after `allow write: if true` is removed from nimbus_tracking. The web-API-key
// path is a rollout fallback that depends on those open rules; see firestoreAuth() in
// _lib/enrich.js for the same reasoning.
async function writeToFirestore(payload) {
  let headers = { 'Content-Type': 'application/json' };
  let query = '';
  if (hasServiceAccount()) {
    headers = { ...headers, ...(await authHeader()) };
  } else if (API_KEY) {
    console.warn('[nimbus-webhook] FIREBASE_SERVICE_ACCOUNT not set — falling back to the web API key');
    query = `?key=${API_KEY}`;
  } else {
    throw new Error('Neither FIREBASE_SERVICE_ACCOUNT nor FIREBASE_WEB_API_KEY is set — cannot write to Firestore');
  }
  const doc = toFirestoreDoc({ ...payload, receivedAt: new Date().toISOString() });
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/nimbus_tracking${query}`;
  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(doc),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Firestore write error ${r.status}: ${errText.slice(0, 300)}`);
  }
}

export default async function handler(req, res) {
  // CORS — for manual testing from the browser. Nimbus → webhook is server-to-server.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hmac-Sha256');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, service: 'nimbus-webhook' });
  }

  // Vercel's @vercel/node runtime pre-parses the body into req.body. We rebuild a
  // string form for parsing + best-effort signature checking.
  const bodyStr = typeof req.body === 'string'
    ? req.body
    : (req.body ? JSON.stringify(req.body) : '');

  // Optional signature check. NOTE: because the runtime has already parsed the body,
  // we cannot reproduce the exact raw bytes Nimbus signed, so a mismatch is treated
  // as a WARNING (logged) and the event is still processed — this guarantees we never
  // silently drop a real status update. (See note in the chat about enabling strict
  // verification once Nimbus's signing scheme is confirmed.)
  if (SECRET) {
    const expected = crypto.createHmac('sha256', SECRET).update(bodyStr, 'utf8').digest('base64');
    const received = req.headers['x-hmac-sha256'] || '';
    if (expected !== received) {
      console.warn('[nimbus-webhook] HMAC mismatch (processing anyway):', {
        receivedPreview: String(received).slice(0, 12),
      });
    }
  }

  let body;
  try {
    body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(bodyStr || '{}');
  } catch (e) {
    console.error('[nimbus-webhook] JSON parse error. Body preview:', bodyStr.slice(0, 300));
    return res.status(200).json({ ok: true, warn: 'parse_error' });
  }

  console.log('[nimbus-webhook] payload:', bodyStr);
  if (!body?.awb_number) {
    return res.status(200).json({ ok: true, warn: 'missing_awb' });
  }

  // Nimbus's webhook delivery times out after only a few seconds, but the full
  // enrichment (Nimbus track + Shopify + Firestore + Google Apps Script) takes ~4s — so
  // doing it before replying made Nimbus see every delivery as a "failure" and disable
  // the webhook. Instead:
  //   1) persist the raw event (one quick write) so the live tracking timeline is safe,
  //   2) ACK 200 immediately (well under Nimbus's timeout), and
  //   3) run the slow enrichment in the background via waitUntil — Fluid compute keeps
  //      the instance alive to finish it. The daily cron (cron-sync-shipments) is the
  //      backstop if a background run is ever dropped.
  // We NEVER return 5xx to Nimbus — that's what triggered the auto-disable.
  try {
    await writeToFirestore(body);
  } catch (e) {
    console.error('[nimbus-webhook] raw write failed for AWB', body.awb_number, '-', e?.message || e);
    // Still ACK 200 so Nimbus stays enabled; the cron re-enriches active AWBs.
  }

  await runInBackground(enrichAwbAndCache(body.awb_number, body, 'nimbus-webhook'));

  return res.status(200).json({ ok: true, awb: body.awb_number });
}
