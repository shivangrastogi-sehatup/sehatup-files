// POST /api/review   body: { file, idx, name, color, reviewed }
// One reviewer's sign-off on one example. Stored as a map for fast single-write
// toggles: ananya_training_reviews/{doc}.reviews[idx][name] = color
import { db, FieldValue, FieldPath, REVIEWS_COLLECTION, docIdForFile } from '../lib/firebase.js';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { file, idx, name, color, reviewed } = await readBody(req);
    if (!file || idx === undefined || !name) {
      return res.status(400).json({ error: 'file, idx and name are required' });
    }
    const key = String(idx);
    const ref = db.collection(REVIEWS_COLLECTION).doc(docIdForFile(file));

    if (reviewed) {
      // single write, no read
      await ref.set(
        { file, reviews: { [key]: { [name]: color || '#888' } }, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    } else {
      // FieldPath keeps names with dots/spaces safe; ignore if the doc/field is absent
      try {
        await ref.update(new FieldPath('reviews', key, name), FieldValue.delete(),
          'updatedAt', FieldValue.serverTimestamp());
      } catch (e) { /* nothing to remove */ }
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('review POST failed:', err);
    return res.status(500).json({ error: 'firestore write failed', detail: String(err) });
  }
}
