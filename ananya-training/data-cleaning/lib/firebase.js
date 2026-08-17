// Firebase Admin singleton for the Vercel serverless functions.
// Credentials come from the FIREBASE_SERVICE_ACCOUNT env var (full JSON string).
// For local `vercel dev`, it falls back to the service-account file in the repo.
import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';

// Strip a leading UTF-8 BOM (U+FEFF) and surrounding whitespace before parsing —
// PowerShell/Windows tooling often prepends a BOM that JSON.parse rejects.
function parseJson(text) {
  let s = text;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // drop UTF-8 BOM
  return JSON.parse(s.trim());
}

function loadCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) return parseJson(raw);

  // Local dev fallback: the gitignored service-account json in sehatup-firebase/functions
  const localPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    new URL(
      '../../../sehatup-firebase/functions/sehatupdev-firebase-adminsdk-fbsvc-50c50c8be8.json',
      import.meta.url
    ).pathname.replace(/^\/([A-Za-z]:)/, '$1'); // strip leading slash on Windows paths
  return parseJson(readFileSync(localPath, 'utf8'));
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(loadCredentials()) });
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export const FieldPath = admin.firestore.FieldPath;
export const REVIEWS_COLLECTION = 'ananya_training_reviews';
export const REVIEWERS_COLLECTION = 'ananya_reviewers';

// File names contain dots/underscores (fine for doc ids) but never slashes.
export function docIdForFile(file) {
  return String(file).replace(/\//g, '_');
}
