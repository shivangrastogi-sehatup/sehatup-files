import crypto from 'crypto';

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
  // Store the FULL payload + a receivedAt timestamp so we don't lose any field Nimbus sends
  const doc = toFirestoreDoc({
    ...payload,
    receivedAt: new Date().toISOString(),
  });
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/nimbus_tracking?key=${API_KEY}`;
  const fsRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
  if (!fsRes.ok) {
    const err = await fsRes.text();
    console.error('Firestore write error:', err);
  }
}

export default async function handler(req, res) {
  // Respond to health-check pings (GET/HEAD) immediately
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, service: 'nimbus-webhook' });
  }

  // Verify HMAC signature only if a secret is configured
  if (SECRET) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expected = Buffer.from(
      crypto.createHmac('sha256', SECRET).update(rawBody).digest()
    ).toString('base64');
    const received = req.headers['x-hmac-sha256'] || '';
    if (expected !== received) {
      console.error('HMAC mismatch — received:', received, 'expected:', expected);
      return res.status(200).json({ ok: true, warn: 'signature_mismatch' });
    }
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    console.error('Body parse error:', e);
    return res.status(200).json({ ok: true, warn: 'parse_error' });
  }

  // Log the FULL payload so we can see every field Nimbus is actually sending
  console.log('Nimbus webhook payload:', JSON.stringify(body));

  if (!body?.awb_number) {
    console.warn('Missing awb_number in payload');
    return res.status(200).json({ ok: true, warn: 'missing_awb' });
  }

  // Respond 200 to Nimbus immediately — never block on Firestore
  res.status(200).json({ ok: true });

  // Write to Firestore after the response is sent
  try {
    await writeToFirestore(body);
  } catch (e) {
    console.error('Async Firestore write failed:', e);
  }
}
