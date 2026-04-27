// src/config/firebaseEnvironment.js - MODIFIED
const DB_MODE_KEY = 'sehatup_db_mode';
const CODE_DEFAULT_MODE = 'live';

export let FIREBASE_MODE = localStorage.getItem(DB_MODE_KEY) || CODE_DEFAULT_MODE;

export const setFirebaseMode = (newMode) => {
    if (FIREBASE_CONFIGS[newMode]) {
        FIREBASE_MODE = newMode;
        // 🔑 FIX: Save the new mode to localStorage immediately 🔑
        localStorage.setItem(DB_MODE_KEY, newMode);
        return true;
    }
    return false;
};

export const FIREBASE_CONFIGS = {
    dev: {
        apiKey: "AIzaSyCr7hpZ8_Qye66RC2LyyWwQ8pXs7Jw1cPg",
        authDomain: "sehatupdev.firebaseapp.com",
        projectId: "sehatupdev",
        storageBucket: "sehatupdev.firebasestorage.app",
        messagingSenderId: "367894412167",
        appId: "1:367894412167:web:e8e19660246ff976cfb122"
    },
    live: {
        // sehatup config (Replace placeholders with your actual live config)
        apiKey: "AIzaSyBCuj9geUYV69Ievt59WO8PjJWQZ1cKDLw",
        authDomain: "sehatup-f96b5.firebaseapp.com",
        projectId: "sehatup-f96b5",
        storageBucket: "sehatup-f96b5.firebasestorage.app",
        messagingSenderId: "886569695434",
        appId: "1:886569695434:web:4932dca7625c98972a5c33",
        measurementId: "G-X2274KKWE4"
    }
};