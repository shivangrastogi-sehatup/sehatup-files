// Reset the reviewer colour registry — frees every claimed colour so anyone can
// pick again. Does NOT touch the actual review sign-offs (ananya_training_reviews).
// Run from ananya-training/data-cleaning/:  node reset-reviewers.mjs
import { db, REVIEWERS_COLLECTION } from './lib/firebase.js';

const snap = await db.collection(REVIEWERS_COLLECTION).get();
if (snap.empty) {
  console.log('No colours are claimed — nothing to reset.');
  process.exit(0);
}
const batch = db.batch();
snap.docs.forEach((d) => batch.delete(d.ref));
await batch.commit();
console.log(`Freed ${snap.size} colour(s): ${snap.docs.map((d) => `${d.id} (${d.data().name})`).join(', ')}`);
process.exit(0);
