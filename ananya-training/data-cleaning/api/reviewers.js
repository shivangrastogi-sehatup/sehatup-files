// Reviewer colour registry — each of the fixed colours can be claimed by exactly
// one person, and everyone sees who holds which.
//   GET  /api/reviewers            -> { colors: { "#hex": "Name", ... } }
//   POST /api/reviewers  {name,color} -> claim a colour (409 if taken by someone else)
import { db, FieldValue, REVIEWERS_COLLECTION } from '../lib/firebase.js';

const COLORS = ['#3fb8a0', '#e8a33d', '#c25b4e', '#6f8fd8', '#b06ee0'];
const idFor = (c) => c.replace('#', '');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function currentColors() {
  const refs = COLORS.map((c) => db.collection(REVIEWERS_COLLECTION).doc(idFor(c)));
  const snaps = await db.getAll(...refs);
  const map = {};
  snaps.forEach((s, i) => { if (s.exists) map[COLORS[i]] = s.data().name; });
  return map;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ colors: await currentColors() });
    }
    if (req.method === 'POST') {
      const { name, color } = await readBody(req);
      if (!name || !color || !COLORS.includes(color)) {
        return res.status(400).json({ error: 'valid name and color are required' });
      }
      const trimmed = String(name).trim();

      const result = await db.runTransaction(async (tx) => {
        const refs = COLORS.map((c) => db.collection(REVIEWERS_COLLECTION).doc(idFor(c)));
        const snaps = await tx.getAll(...refs);
        const held = {};
        snaps.forEach((s, i) => { if (s.exists) held[COLORS[i]] = s.data().name; });

        // colour taken by a different person?
        if (held[color] && held[color] !== trimmed) {
          return { conflict: held[color] };
        }
        // release any other colour this person was holding
        snaps.forEach((s, i) => {
          if (s.exists && s.data().name === trimmed && COLORS[i] !== color) tx.delete(refs[i]);
        });
        tx.set(db.collection(REVIEWERS_COLLECTION).doc(idFor(color)),
          { name: trimmed, color, claimedAt: FieldValue.serverTimestamp() });
        return { ok: true };
      });

      if (result.conflict) {
        return res.status(409).json({ error: 'colour taken', takenBy: result.conflict });
      }
      return res.status(200).json({ ok: true, colors: await currentColors() });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('reviewers failed:', err);
    return res.status(500).json({ error: 'reviewers failed', detail: String(err) });
  }
}
