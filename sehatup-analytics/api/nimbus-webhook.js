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
    await enrichAwbAndCache(body.awb_number, body, 'nimbus-webhook');
  } catch (e) {
    console.error('Async post-response error:', e);
  }
}
