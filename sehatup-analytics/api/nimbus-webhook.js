import crypto from 'crypto';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'sehatup-f96b5';
const API_KEY    = process.env.FIREBASE_WEB_API_KEY  || '';
const SECRET     = process.env.NIMBUS_WEBHOOK_SECRET || '';

function toFirestoreDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) fields[k] = { nullValue: null };
    else if (typeof v === 'boolean')   fields[k] = { booleanValue: v };
    else if (typeof v === 'number')    fields[k] = { integerValue: String(v) };
    else                               fields[k] = { stringValue: String(v) };
  }
  return { fields };
}

async function writeToFirestore(payload) {
  if (!API_KEY) {
    console.error('FIREBASE_WEB_API_KEY is not set — skipping Firestore write');
    return;
  }
  const doc = toFirestoreDoc({
    awb_number:  payload.awb_number  || '',
    status:      payload.status      || '',
    event_time:  payload.event_time  || '',
    location:    payload.location    || '',
    message:     payload.message     || '',
    rto_awb:     payload.rto_awb     || '',
    receivedAt:  new Date().toISOString(),
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
      // Still return 200 so Nimbus does not disable the webhook;
      // the bad payload is simply discarded.
      return res.status(200).json({ ok: true, warn: 'signature_mismatch' });
    }
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    console.error('Body parse error:', e);
    // Return 200 — bad payload, but don't let Nimbus disable the webhook
    return res.status(200).json({ ok: true, warn: 'parse_error' });
  }

  if (!body?.awb_number) {
    console.warn('Missing awb_number in payload:', JSON.stringify(body));
    return res.status(200).json({ ok: true, warn: 'missing_awb' });
  }

  // Respond 200 to Nimbus immediately — never block on Firestore
  res.status(200).json({ ok: true });

  // Write to Firestore after the response is sent (Vercel keeps the fn alive until this returns)
  try {
    await writeToFirestore(body);
  } catch (e) {
    console.error('Async Firestore write failed:', e);
  }
}
