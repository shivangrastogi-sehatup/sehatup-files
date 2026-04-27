
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("./sehatupdev-firebase-adminsdk-fbsvc-50c50c8be8.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();
const phone = "7300978845";

async function testFetch() {
  console.log(`Searching for phone: ${phone} in sehatupdev...`);
  const variations = [phone, `91${phone}`, `+91${phone}`];
  
  const snapshot = await db.collection("questionnaire_submissions")
    .where("phone", "in", variations)
    .get();

  if (snapshot.empty) {
    console.log("No submissions found for this phone.");
    return;
  }

  const docs = snapshot.docs.sort((a, b) => {
    const tA = a.data().timestamp?.seconds || 0;
    const tB = b.data().timestamp?.seconds || 0;
    return tB - tA;
  });

  const latest = docs[0];
  console.log("Latest Document found:");
  console.log("ID:", latest.id);
  console.log("Data:", JSON.stringify(latest.data(), null, 2));
  
  // Test update
  console.log("Attempting test update...");
  try {
      await latest.ref.update({
          isWhatsAppSent_TEST: true,
          testUpdateAt: FieldValue.serverTimestamp()
      });
      console.log("Update successful!");
  } catch (e) {
      console.error("Update failed:", e.message);
  }
}

testFetch();
