const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// 1. Setup Admin SDK (pointing to your live project)
const serviceAccount = require("./sehatup-f96b5-firebase-adminsdk-fbsvc-3e1ef010fd.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function triggerLiveFunction(targetDocId) {
  console.log(`\n--- STARTING LIVE TRIGGER FOR DOC: ${targetDocId} ---`);
  
  const originalDocRef = db.collection("questionnaire_submissions").doc(targetDocId);
  const snap = await originalDocRef.get();

  if (!snap.exists) {
    console.error("❌ Error: Original document not found in Firestore!");
    process.exit(1);
  }

  const originalData = snap.data();
  console.log(`Successfully fetched data for: ${originalData.userName || 'Unknown patient'}`);

  // 2. Prepare cloned data - REMOVE existing PDF links so we can detect when the new ones arrive
  const clonedData = { ...originalData };
  delete clonedData.reportDownloadUrl;
  delete clonedData.reportStoragePath;
  delete clonedData.pdfGeneratedAt;

  // 3. Create a temporary document to trigger the onCreate Cloud Function
  const tempDocId = `manual_trigger_${targetDocId}_${Date.now()}`;
  const tempDocRef = db.collection("questionnaire_submissions").doc(tempDocId);
  
  console.log(`\nStep 1: Creating temporary clone: ${tempDocId}`);
  console.log(`This will trigger the LIVE "CreatePDFOnFormSubmission" function on the production server...`);

  // Start listening BEFORE we set the data to avoid missing the event, 
  // but the 'if' condition will ignore the initial set.
  let resolved = false;
  const unsubscribe = tempDocRef.onSnapshot(async (docSnapshot) => {
    const data = docSnapshot.data();
    
    // Check if the cloud function has finished and updated the document
    // Crucially, we check if the links exist and are DIFFERENT from what we started with (which was nothing)
    if (data && data.reportDownloadUrl && !resolved) {
      resolved = true;
      console.log(`\n✅ SUCCESS: Live Cloud Function has generated the PDF!`);
      console.log(`New PDF URL: ${data.reportDownloadUrl}`);
      
      // 4. Update the original document with the newly generated PDF URLs
      console.log(`\nStep 2: Linking results back to original document: ${targetDocId}`);
      await originalDocRef.update({
        reportDownloadUrl: data.reportDownloadUrl,
        reportStoragePath: data.reportStoragePath,
        pdfGeneratedAt: data.pdfGeneratedAt || new Date(),
        lastRefixedAt: new Date()
      });
      
      // 5. Clean up the temp document
      console.log(`Step 3: Cleaning up temporary trigger document...`);
      await tempDocRef.delete();
      
      console.log(`\n🎉 DONE! The original document is now updated with the official live-generated PDF.`);
      console.log(`You can now view the updated report using the original link.`);
      
      unsubscribe();
      setTimeout(() => process.exit(0), 1000);
    }
  }, (err) => {
    console.error(`\n❌ Snapshot Error: ${err}`);
    process.exit(1);
  });
  
  // Now set the data to trigger the function
  await tempDocRef.set({
    ...clonedData,
    triggeredManually: true,
    triggeredAt: new Date().toISOString()
  });

  console.log(`\nStep 4: Waiting for the production server to respond...`);
  console.log(`(Estimated time: 10-30 seconds. Do not close this terminal.)`);
  
  // Set a timeout of 120 seconds for production safety
  setTimeout(async () => {
    if (!resolved) {
      console.error("\n❌ TIMEOUT: The live function did not respond within 120 seconds.");
      console.log("Cleaning up temp doc and exiting...");
      await tempDocRef.delete();
      unsubscribe();
      process.exit(1);
    }
  }, 120000);
}

// Target Doc ID from your request
const targetId = "vXJs9z2AtIr4BPI4aPHW";
triggerLiveFunction(targetId);
