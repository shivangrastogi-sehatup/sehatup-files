// GET /api/reviews?file=<chunk file name>
// Returns saved state for one chunk:
//   reviews:  { idx: { name: color } }
//   excluded: [ idx ]
//   edits:    { idx: { turns, phone, editedBy, editedAt } }
import { db, REVIEWS_COLLECTION, docIdForFile } from '../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const file = req.query.file;
  if (!file) return res.status(400).json({ error: 'file query param required' });

  try {
    const snap = await db.collection(REVIEWS_COLLECTION).doc(docIdForFile(file)).get();
    const data = snap.exists ? snap.data() : {};

    // excluded may be a map {idx:true} (new) or an array (legacy) — normalize to array of numbers
    let excluded = [];
    if (Array.isArray(data.excluded)) excluded = data.excluded.map(Number);
    else if (data.excluded && typeof data.excluded === 'object') {
      excluded = Object.entries(data.excluded).filter(([, v]) => v).map(([k]) => Number(k));
    }

    return res.status(200).json({
      reviews: data.reviews || {},
      excluded,
      edits: data.edits || {},
    });
  } catch (err) {
    console.error('reviews GET failed:', err);
    return res.status(500).json({ error: 'firestore read failed', detail: String(err) });
  }
}
