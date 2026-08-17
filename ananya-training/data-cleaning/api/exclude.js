// POST /api/exclude   body: { file, idx, excluded }
// Toggles whether one example is excluded. Stored as a map for fast single-write
// toggles: ananya_training_reviews/{doc}.excluded[idx] = true
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
    const { file, idx, excluded } = await readBody(req);
    if (!file || idx === undefined) {
      return res.status(400).json({ error: 'file and idx are required' });
    }
    const key = String(idx);
    const ref = db.collection(REVIEWS_COLLECTION).doc(docIdForFile(file));

    if (excluded) {
      await ref.set(
        { file, excluded: { [key]: true }, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    } else {
      try {
        await ref.update(new FieldPath('excluded', key), FieldValue.delete(),
          'updatedAt', FieldValue.serverTimestamp());
      } catch (e) { /* nothing to remove */ }
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('exclude POST failed:', err);
    return res.status(500).json({ error: 'firestore write failed', detail: String(err) });
  }
}
