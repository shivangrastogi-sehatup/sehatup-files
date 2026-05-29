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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify HMAC signature if a secret is configured
  if (SECRET) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expected = Buffer.from(
      crypto.createHmac('sha256', SECRET).update(rawBody).digest()
    ).toString('base64');
    const received = req.headers['x-hmac-sha256'] || '';
    if (expected !== received) return res.status(401).json({ error: 'Invalid signature' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { awb_number, status, event_time, location, message, rto_awb } = body || {};

  if (!awb_number) return res.status(400).json({ error: 'Missing awb_number' });

  const doc = toFirestoreDoc({
    awb_number,
    status:     status     || '',
    event_time: event_time || '',
    location:   location   || '',
    message:    message    || '',
    rto_awb:    rto_awb    || '',
    receivedAt: new Date().toISOString(),
  });

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/nimbus_tracking?key=${API_KEY}`;

  try {
    const fsRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });
    if (!fsRes.ok) {
      const err = await fsRes.text();
      console.error('Firestore write error:', err);
      return res.status(500).json({ error: 'Firestore write failed' });
    }
  } catch (e) {
    console.error('Nimbus webhook error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }

  // Must return 200 within 5 seconds or Nimbus marks it failed
  return res.status(200).json({ ok: true });
}
