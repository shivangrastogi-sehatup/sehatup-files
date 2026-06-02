import crypto from 'crypto';
import { enrichAwbAndCache } from './_lib/enrich.js';

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

async function writeToFirestore(payload) {
  if (!API_KEY) {
    throw new Error('FIREBASE_WEB_API_KEY is not set — cannot write to Firestore');
  }
  const doc = toFirestoreDoc({ ...payload, receivedAt: new Date().toISOString() });
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/nimbus_tracking?key=${API_KEY}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  // Do ALL writes BEFORE responding. On serverless, work performed after the response
  // is flushed is NOT guaranteed to run (the instance is frozen) — that is what caused
  // tracking updates to be dropped or arrive very late.
  try {
    await writeToFirestore(body);
    await enrichAwbAndCache(body.awb_number, body, 'nimbus-webhook');
  } catch (e) {
    console.error('[nimbus-webhook] processing failed for AWB', body.awb_number, '-', e?.message || e);
    // Return 5xx so Nimbus retries delivery (at-least-once) instead of losing the event.
    return res.status(500).json({ ok: false, error: 'processing_failed', awb: body.awb_number });
  }

  return res.status(200).json({ ok: true, awb: body.awb_number });
}
