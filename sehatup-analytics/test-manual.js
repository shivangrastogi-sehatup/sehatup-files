const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "dummy",
    projectId: "sehatup-c5a4d", // Replace if needed, wait, I can just use admin sdk, but let's check firebase config from codebase.
};
