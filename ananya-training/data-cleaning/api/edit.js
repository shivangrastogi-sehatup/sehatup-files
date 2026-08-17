// POST /api/edit   body: { file, idx, turns, phone, editedBy, revert }
// Saves a corrected version of one training example (edited/added/deleted messages
// and/or a changed phone number). The stored `edits[idx]` overrides the static base.
// Pass { revert: true } to drop the edit and fall back to the original conversation.
import { db, FieldValue, REVIEWS_COLLECTION, docIdForFile } from '../lib/firebase.js';

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

const ROLES = new Set(['user', 'model']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { file, idx, turns, phone, editedBy, revert } = await readBody(req);
    if (!file || idx === undefined) {
      return res.status(400).json({ error: 'file and idx are required' });
    }
    const key = String(idx);
    const ref = db.collection(REVIEWS_COLLECTION).doc(docIdForFile(file));

    if (revert) {
      await ref.set(
        { file, edits: { [key]: FieldValue.delete() }, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return res.status(200).json({ ok: true, reverted: true });
    }

    if (!Array.isArray(turns)) {
      return res.status(400).json({ error: 'turns must be an array' });
    }
    // Sanitize: keep only valid {role, text} turns, drop empties.
    const clean = turns
      .map((t) => ({
        role: ROLES.has(t && t.role) ? t.role : 'user',
        text: String((t && t.text) ?? ''),
      }))
      .filter((t) => t.text.trim() !== '');

    const edit = {
      turns: clean,
      phone: phone === undefined ? '' : String(phone),
      editedBy: editedBy ? String(editedBy) : 'unknown',
      editedAt: FieldValue.serverTimestamp(),
    };

    await ref.set(
      { file, edits: { [key]: edit }, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return res.status(200).json({ ok: true, turns: clean, phone: edit.phone });
  } catch (err) {
    console.error('edit POST failed:', err);
    return res.status(500).json({ error: 'firestore write failed', detail: String(err) });
  }
}
