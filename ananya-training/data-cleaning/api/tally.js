// GET /api/tally
// Cross-chunk standings, read in one pass over the reviews collection.
//   people: { name: { count, color } }   — examples each reviewer has signed off, totalled across every chunk
//   chunks: { file: { reviewed, excluded, done } } — per-chunk progress
//     reviewed = examples with >=1 sign-off
//     excluded = examples marked excluded
//     done     = examples that are reviewed OR excluded (union) — i.e. "handled"
import { db, REVIEWS_COLLECTION } from '../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const snap = await db.collection(REVIEWS_COLLECTION).get();
    const people = {};   // name -> { count, color }
    const chunks = {};   // file -> { reviewed, excluded, done }

    snap.forEach((doc) => {
      const data = doc.data() || {};
      const file = data.file || doc.id;
      const reviews = data.reviews || {};

      // excluded may be a map {idx:true} (new) or an array (legacy)
      const exclSet = new Set();
      if (Array.isArray(data.excluded)) data.excluded.forEach((k) => exclSet.add(String(k)));
      else if (data.excluded && typeof data.excluded === 'object') {
        Object.entries(data.excluded).forEach(([k, v]) => { if (v) exclSet.add(String(k)); });
      }

      const reviewedIdx = new Set();
      for (const [idx, signers] of Object.entries(reviews)) {
        const names = signers && typeof signers === 'object' ? Object.entries(signers) : [];
        if (names.length) reviewedIdx.add(String(idx));
        for (const [name, color] of names) {
          const p = people[name] || (people[name] = { count: 0, color: color || '#888' });
          p.count += 1;
          if (color) p.color = color;   // remember the colour they signed with
        }
      }

      const done = new Set([...reviewedIdx, ...exclSet]);
      chunks[file] = { reviewed: reviewedIdx.size, excluded: exclSet.size, done: done.size };
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ people, chunks });
  } catch (err) {
    console.error('tally GET failed:', err);
    return res.status(500).json({ error: 'tally read failed', detail: String(err) });
  }
}
