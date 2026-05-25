const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const serviceAccount = require("./sehatup-f96b5-firebase-adminsdk-fbsvc-3e1ef010fd.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// Helper to flatten nested objects, including special handling for 'answers' arrays
const flattenObject = (obj, prefix = "") => {
  let flattened = {};
  
  if (!obj) return flattened;
  
  Object.keys(obj).forEach((key) => {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (val === null || val === undefined) {
      flattened[newKey] = "";
    } else if (val && typeof val === "object" && val.toDate) {
      // Handle Firestore Timestamp
      flattened[newKey] = val.toDate().toLocaleString();
    } else if (Array.isArray(val)) {
      if (key === "answers") {
        // Special formatting for answers array which usually has {question, answer}
        val.forEach((item, index) => {
          if (item.question) {
            flattened[`Q: ${item.question}`] = typeof item.answer === 'object' ? JSON.stringify(item.answer) : item.answer;
          } else {
            flattened[`${newKey}[${index}]`] = JSON.stringify(item);
          }
        });
      } else {
        // Normal array flattening
        flattened[newKey] = val.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join(" | ");
      }
    } else if (typeof val === "object") {
      // Recursively flatten
      Object.assign(flattened, flattenObject(val, newKey));
    } else {
      flattened[newKey] = val;
    }
  });
  
  return flattened;
};

const fetchData = async (collectionName) => {
  console.log(`Fetching from ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  
  const data = [];
  snapshot.forEach(doc => {
    const docData = doc.data();
    // Special formatting for 'rawState' if it exists, since it's huge
    // We flatten the doc data
    const flattenedData = flattenObject(docData);
    
    // Put ID at the front
    data.push({
      docId: doc.id,
      ...flattenedData
    });
  });
  
  console.log(`Found ${data.length} records in ${collectionName}.`);
  return data;
};

const run = async () => {
  try {
    const partialData = await fetchData("partial_submissions");
    const completedData = await fetchData("questionnaire_submissions");
    const manualData = await fetchData("manual_submissions");
    
    // Create Excel Workbook
    const wb = XLSX.utils.book_new();
    
    // Add Sheets
    if (completedData.length > 0) {
      const wsCompleted = XLSX.utils.json_to_sheet(completedData);
      XLSX.utils.book_append_sheet(wb, wsCompleted, "Completed");
    }
    
    if (partialData.length > 0) {
      const wsPartial = XLSX.utils.json_to_sheet(partialData);
      XLSX.utils.book_append_sheet(wb, wsPartial, "Partial");
    }
    
    if (manualData.length > 0) {
      const wsManual = XLSX.utils.json_to_sheet(manualData);
      XLSX.utils.book_append_sheet(wb, wsManual, "Manual");
    }
    
    const outputPath = path.join(__dirname, "SehatUp_Database_Export.xlsx");
    XLSX.writeFile(wb, outputPath);
    
    console.log(`Export completed! File saved at: ${outputPath}`);
    process.exit(0);
  } catch (err) {
    console.error("Error exporting data:", err);
    process.exit(1);
  }
};

run();
