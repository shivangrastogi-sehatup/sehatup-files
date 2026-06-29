import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const FUNCTIONS_REGION = import.meta.env.VITE_FUNCTIONS_REGION || "us-central1";

export const isFirebaseConfigured =
  !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

let _app = null;
let _db = null;
let _functions = null;

function app() {
  if (!isFirebaseConfigured) return null;
  if (!_app) _app = initializeApp(firebaseConfig);
  return _app;
}

export function getDb() {
  if (!_db && app()) _db = getFirestore(app());
  return _db;
}

export function getFns() {
  if (!_functions && app()) _functions = getFunctions(app(), FUNCTIONS_REGION);
  return _functions;
}
