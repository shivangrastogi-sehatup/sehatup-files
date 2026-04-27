import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { FIREBASE_MODE, FIREBASE_CONFIGS } from "./config/firebaseEnvironment";

// Service caches
let appInstance = null;
export let db = null;
export let auth = null;
export let storage = null;
export let functions = null;

export const initializeFirebase = (mode = FIREBASE_MODE) => {
    // Return cached instances if already set up
    if (appInstance && db && auth) {
        return { db, auth, storage, functions };
    }

    const config = FIREBASE_CONFIGS[mode] || FIREBASE_CONFIGS.dev;
    console.log(`[Firebase] Initializing ${mode} (Hybrid Mode) for ${config.projectId}`);

    appInstance = getApps().find(app => app.name === mode) || initializeApp(config, mode);

    // Initialize Services
    db = getFirestore(appInstance);
    auth = getAuth(appInstance);
    storage = getStorage(appInstance);
    functions = getFunctions(appInstance);

    // --- Emulator Connection (Functions ONLY) ---
    // We only connect Functions to the emulator to test PDF generation locally.
    // Firestore/Auth/Storage remain on the Cloud (sehatupdev) to avoid assertion errors.
    if (mode === 'dev' || window.location.hostname === 'localhost') {
        try {
            connectFunctionsEmulator(functions, "localhost", 5001);
            console.log("[Firebase] Local Functions connected (Cloud Firestore active)");
        } catch (e) {
            console.warn("[Firebase] Functions emulator warning:", e.message);
        }
    }

    return { db, auth, storage, functions };
};

// Initialize Firebase with the default mode when the module loads
initializeFirebase(FIREBASE_MODE);

export default appInstance;