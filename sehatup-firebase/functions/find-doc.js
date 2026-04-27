const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./sehatupdev-firebase-adminsdk-fbsvc-50c50c8be8.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function findDoc() {
    const snapshot = await db.collection('prescriptions').limit(5).get();
    if (snapshot.empty) {
        console.log('No prescriptions found.');
        return;
    }
    snapshot.forEach(doc => {
        console.log(`Found ID: ${doc.id}`);
    });
}

findDoc().catch(console.error);
