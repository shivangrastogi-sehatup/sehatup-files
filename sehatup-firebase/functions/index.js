// index.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, cert } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const os = require("os");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const handlebars = require("handlebars");
const puppeteer = require("puppeteer");
const cors = require("cors")({ origin: true });

// Helper to convert local assets to base64 for PDF injection
const getBase64 = (fileName) => {
  const filePath = path.join(__dirname, "assets", fileName);
  if (fs.existsSync(filePath)) {
    const bitmap = fs.readFileSync(filePath);
    const extension = path.extname(fileName).replace(".", "");
    return `data:image/${extension};base64,${bitmap.toString("base64")}`;
  }
  return "";
};

// Helper to resolve variant IDs from Shopify
const resolveVariantId = async (productName) => {
  try {
    const searchUrl = `https://sehatup.com/search/suggest.json?q=${encodeURIComponent(productName)}&resources[type]=product`;
    const searchRes = await axios.get(searchUrl);
    const handle = searchRes.data?.resources?.results?.products?.[0]?.handle;
    if (!handle) return null;

    const productRes = await axios.get(`https://sehatup.com/products/${handle}.js`);
    return productRes.data?.variants?.[0]?.id;
  } catch (error) {
    console.error(`[Shopify Sync] Error resolving variant ID for ${productName}:`, error.message);
    return null;
  }
};

const resolveAllVariantIds = async (products_list) => {
  if (!products_list || !Array.isArray(products_list)) return [];
  return Promise.all(products_list.map(async (p) => {
    if (!p.variantId || String(p.variantId) === 'unknown' || String(p.variantId) === 'null') {
      const id = await resolveVariantId(p.name);
      if (id) return { ...p, variantId: id };
    }
    return p;
  }));
};

// Helper to generate a Shopify cart URL
const generateCartUrl = (products, utmSource = "doctor_panel") => {
  if (!products || !Array.isArray(products) || products.length === 0) {
    return null;
  }

  const SEHATUP_URL = "https://sehatup.com";
  const items = products
    .filter((p) => {
      // Ensure we have a valid variantId
      const hasId = p.variantId && String(p.variantId) !== "unknown" && String(p.variantId) !== "null";
      return hasId;
    })
    .map((p) => `${p.variantId}:${p.qty || p.quantity || 1}`)
    .join(",");

  if (!items) {
    return null;
  }

  return `${SEHATUP_URL}/cart/${items}?storefront=true&utm_source=${utmSource}`;
};

// Check if the environment is production or development in firebase functions using the project id
let isProduction;
if (process.env.GCLOUD_PROJECT === "sehatup-f96b5") {
  isProduction = true;
} else if (process.env.GCLOUD_PROJECT === "sehatupdev") {
  isProduction = false;
}

let serviceAccount;
if (isProduction) {
  serviceAccount = require("./sehatup-f96b5-firebase-adminsdk-fbsvc-3e1ef010fd.json");
} else {
  serviceAccount = require("./sehatupdev-firebase-adminsdk-fbsvc-50c50c8be8.json");
}
const { default: axios } = require("axios");
const { Firestore, getFirestore, FieldValue } = require("firebase-admin/firestore");
const { totp } = require("otplib");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const QRCode = require('qrcode');

// Initialize Firebase Admin SDK with the correct storage bucket based on the environment

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: isProduction
    ? "sehatup-f96b5.firebasestorage.app"
    : "sehatupdev.firebasestorage.app",
});

// Read template files
const templatePath = path.join(__dirname, "templates", "rT.html");
const templateHtml = fs.readFileSync(templatePath, "utf-8");

const prescriptionTemplatePath = path.join(__dirname, "templates", "prescriptionTemplateV3.html");
const prescriptionTemplateHtml = fs.readFileSync(prescriptionTemplatePath, "utf-8");

// Register Handlebars comparison helpers
handlebars.registerHelper("lt", function (a, b) {
  return parseInt(a) < parseInt(b);
});

handlebars.registerHelper("gt", function (a, b) {
  return parseInt(a) > parseInt(b);
});

handlebars.registerHelper("eq", function (a, b) {
  return a === b;
});

handlebars.registerHelper("len", function (arr) {
  return Array.isArray(arr) ? arr.length : 0;
});

// Compile templates once at startup
const template = handlebars.compile(templateHtml);
const prescriptionTemplate = handlebars.compile(prescriptionTemplateHtml);

// Define a simple HTTP function that says hello
exports.helloWorld = onRequest(async (req, res) => {
  console.log("Hello world function executed!");

  const baseUrl = "http://127.0.0.1:5002";

  const data = {
    reportDate: "07-06-2025",
    userName: "Kavach Chandra",
    dob: "1994-12-23",
    phone: "9873411172",
    healthScore: 3,
    issueTitle: "Premature Ejaculation + Erectile Dysfunction",
    possibleCauses: [
      {
        text: "Less severe erectile dysfunction, likely vascular or psychological",
        icon: "https://sehatup-f96b5.web.app/PDF-Assets/possible-causes-icon.png",
      },
      {
        text: "Performance anxiety",
        icon: "https://sehatup-f96b5.web.app/PDF-Assets/possible-causes-icon.png",
      },
      {
        text: "Psychological triggers, poor sleep, substance use, hormonal imbalances, relationship issues",
        icon: "https://sehatup-f96b5.web.app/PDF-Assets/possible-causes-icon.png",
      },
    ],
    lifestyleChanges: [
      {
        text: "Eat foods that boost energy and hormones like almonds, pumpkin seeds, dates, and dark chocolate. ",
      },
      {
        text: "Sleep 7-8 hours regularly and avoid stress, as it affects performance.",
      },
      {
        text: "Stay active—30 minutes of walking or light exercise can help improve stamina.",
      },
      {
        text: "Avoid smoking, alcohol, and junk food—they affect blood flow and energy.",
      },
      {
        text: "Include zinc and magnesium-rich foods like seeds, leafy greens, and dry fruits.",
      },
      { text: "Maintain daily physical activity." },
      { text: "Eat home-cooked meals with less oil, salt, and sugar." },
      {
        text: "Add heart-healthy foods like walnuts, oats, garlic, and fruits.",
      },
      { text: "Avoid fried and packaged items." },
      { text: "Walk daily for 30 minutes and avoid sitting for long hours." },
      {
        text: "Cut down on fried and buttery foods.Prefer baked, grilled, or steamed items. ",
      },
      { text: "Use healthy oils like mustard, rice bran, or olive oil. " },
      { text: "Eat more fiber—like fruits with skin, dalia, and vegetables. " },
      { text: "Avoid overeating and aim for 20-30 minutes of activity daily." },
    ],
    timeline: [
      {
        month: "Month 1",
        timelineDesc:
          "Improved erection, better ejaculation control, better mood, reduced fatigue",
      },
      {
        month: "Month 2",
        timelineDesc:
          "Longer intercourse duration, sustained erection, emotional improvement",
      },
      {
        month: "Month 3",
        timelineDesc:
          "Restored sexual normalcy, better confidence levels during performance",
      },
      {
        month: "Month 6",
        timelineDesc:
          "Confident sexual function, minimized dependency on meds, better energy levels",
      },
    ],
    concern: "both",
    answers: [10, 8, 8, 0, 2],
    reportCategory: "Sexual Wellness",
    lifestyleAnswers: [5, 4],
    concern: "both",
    answers: [10, 8, 8, 0, 2],
    reportCategory: "Sexual Wellness",
    lifestyleAnswers: [5, 4],
    recommendedProducts: [
      {
        name: "Tadalafil",
        salePrice: 279,
        whyPoints: [
          { text: "Reduces Performance Anxiety, increases sexual confidence." },
          { text: "Helps prolong the time of ejaculation." },
          { text: "Men with both ED and PE often benefit from Tadalafil." },
        ],
        icon: "https://sehatup-f96b5.web.app/PDF-Assets/why-icon.png",
      },
      {
        name: "Ashwagandha",
        salePrice: 499,
        whyPoints: [
          { text: "Improve libido." },
          { text: "Enhance sexual stamina." },
          {
            text: "Supports stronger erections, helps improve endurance and energy levels, reducing fatigue during intercourse.",
          },
          {
            text: "Supports muscle strength and recovery, which can improve pelvic muscle tone indirectly.",
          },
        ],
        icon: "https://sehatup-f96b5.web.app/PDF-Assets/why-icon.png",
      },
      {
        name: "Shilajit",
        salePrice: 1349,
        whyPoints: [
          { text: "Enhances Testosterone Levels." },
          {
            text: "It improves blood flow and neuromuscular tone in the pelvic region, supporting better ejaculatory control.",
          },
          { text: "Antioxidant & Anti-inflammatory." },
          {
            text: "Shilajit's antioxidant properties protect sperm and overall sexual health.",
          },
          { text: "Controls premature arousal." },
        ],
        icon: "https://sehatup-f96b5.web.app/PDF-Assets/why-icon.png",
      },
    ],
    futureRisks: [
      {
        text: "Loss of libido.",
        icon: "https://sehatup-f96b5.web.app/PDF-Assets/future-risks-icon.png",
      },
      {
        text: "Relationship strain.",
        icon: "https://sehatup-f96b5.web.app/PDF-Assets/future-risks-icon.png",
      },
      {
        text: "Impotency.",
        icon: "https://sehatup-f96b5.web.app/PDF-Assets/future-risks-icon.png",
      },
      {
        text: "Risk of irreversible vascular and neurological damage.",
        icon: "https://sehatup-f96b5.web.app/PDF-Assets/future-risks-icon.png",
      },
      {
        text: "Chronic depression.",
        icon: "https://sehatup-f96b5.web.app/PDF-Assets/future-risks-icon.png",
      },
    ],
    timestamp: { _seconds: 1749326291, _nanoseconds: 901000000 },
    baseUrl: "http://127.0.0.1:5002",
  };

  const { healthScore, concern } = data;
  // Dynamically attach risk metrics so they match healthScore: 3
  Object.assign(data, getRiskMetrics(healthScore));
  data["healthScoreOffset"] = 1068.14 * (1 - healthScore / 100);

  console.log(`Generating test report with Score: ${healthScore}, Offset: ${data.healthScoreOffset}`);

  if (concern === "ed") {
    data["productImage"] = `ED-group.jpg`;
  }
  if (concern === "pe") {
    data["productImage"] = `PE-group.jpg`;
  }
  if (concern === "both") {
    data["productImage"] = `BOTH-group.jpg`;
  }

  console.log(`Possible cause icon link : ${data.possibleCauses[0].icon}`);

  const docId = `id_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

  const { storagePath, downloadUrl } = await generatePDF(data, docId);

  res.status(200).send({
    storagePath,
    downloadUrl,
  });
});

const htmlFromTemplate = (data, type = "report") => {
  if (type === "prescription") {
    return prescriptionTemplate(data);
  }
  return template(data);
};

const generatePDF = async (data, docId, type = "report") => {
  const isReport = type === "report";
  const prefix = isReport ? "report" : "prescription";
  const tempHtmlPath = path.join(os.tmpdir(), `${prefix}_${Date.now()}.html`);
  const tempPdfPath = path.join(os.tmpdir(), `${prefix}_${Date.now()}.pdf`);

  try {
    // Generate HTML from template
    const html = htmlFromTemplate(data, type);
    fs.writeFileSync(tempHtmlPath, html);

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
    const page = await browser.newPage();
    await page.goto(`file://${tempHtmlPath}`, {
      waitUntil: "networkidle0",
    });

    let contentHeight;
    if (isReport) {
      contentHeight = await page.evaluate(() => {
        return document.body.scrollHeight - 6.52;
      });
    } else {
      contentHeight = await page.evaluate(() => {
        return document.body.scrollHeight;
      });
    }

    await page.pdf({
      path: tempPdfPath,
      printBackground: true,
      preferCSSPageSize: true, // Force Puppeteer to respect the @page CSS rule
      width: "210mm",
      height: `${contentHeight}px`,
    });

    await browser.close();

    // Upload to Firebase Storage
    const bucket = getStorage().bucket();
    // Customize the file name to be more meaningful and unique
    const formattedName = data.patientName || data.userName || "Patient";
    const formattedDate = data.date ? data.date.replace(/\//g, '-') : new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

    // Add a small suffix from the docId to avoid any conflicts with multiple generations
    const uniqueSuffix = docId ? `_${docId.substring(docId.length - 4)}` : '';

    const baseFileName = isReport
      ? `HealthScore360Report_${formattedName}_${formattedDate}${uniqueSuffix}`
      : `${data.displayId ? data.displayId + '_' : ''}My_Prescription_${formattedName}_${formattedDate}${uniqueSuffix}`;

    const folder = isReport ? "reports_pdf" : "prescriptions_pdf";
    const fileName = `${folder}/${docId}/${baseFileName}`;

    await bucket.upload(tempPdfPath, {
      destination: `${fileName}.pdf`,
      metadata: {
        contentType: "application/pdf",
        contentDisposition: `inline; filename="${baseFileName}.pdf"`,
      },
    });

    if (isReport) {
      await bucket.upload(tempHtmlPath, {
        destination: `${fileName}.html`,
        metadata: {
          contentType: "application/html",
        },
      });
    }

    // Clean up temporary files
    fs.unlinkSync(tempHtmlPath);
    fs.unlinkSync(tempPdfPath);

    // Get the download URL
    const file = bucket.file(`${fileName}.pdf`);
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2500", // You might want to adjust this expiration date
      responseDisposition: `inline; filename="${baseFileName}.pdf"`,
    });

    return {
      storagePath: `gs://${bucket.name}/${fileName}.pdf`,
      downloadUrl: signedUrl,
    };
  } catch (error) {
    // Clean up temporary files in case of error
    if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
    if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
    throw error;
  }
};

exports.testPrescriptionPDF = onRequest(async (req, res) => {
  try {
    const docId = `TEST-${Date.now()}`;
    const mockData = {
      patientName: "Shivang",
      patientAge: "25",
      patientGender: "Female",
      prescriptionID: "RX-TEST-1031",
      consultationDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      primaryDiagnosis: "General Assessment & Hormonal Balance",
      clinicalFindings: "Patient reported minor fatigue and requested wellness optimization.",
      recommendedProducts: [
        {
          variantId: "4044680601076201931",
          name: "HER MENSES (FOR RHYTHMIC RELIEF & HORMONAL HARMONY)",
          dosage: ["1", "0", "0", "0"],
          dosageType: "schedule",
          type: "CAPSULE",
          timing: "Once a day",
          instruction: "Orally, After Food",
          duration: "1 Month",
          quantity: 1
        },
        {
          variantId: "4044680601076201932",
          name: "ALOEZY ( INTIMATE FOAM WASH) | BEST INTIMATE WASH FOR WOMENS",
          dosageValue: "2 pumps",
          dosageType: "text",
          type: "APPLICATION",
          timing: "As directed",
          instruction: "Apply as directed",
          duration: "1 Month",
          quantity: 2
        },
        {
          variantId: "4044680601076201933",
          name: "KERN DROPS - PACK OF 1 @509",
          dosageValue: "5",
          dosageType: "drops",
          dosageFrequency: "2",
          type: "LIQUID",
          timing: "As directed",
          instruction: "After meals",
          duration: "1 Month",
          quantity: 1
        }
      ],
      dietAdvice: "Include more fiber-rich green vegetables in every meal. Drink at least 3 liters of water daily.",
      lifestyleChanges: [
        { text: "Maintain a consistent sleep schedule (7-8 hours)." },
        { text: "Drink at least 3 liters of water daily." },
        { text: "Perform 30 minutes of light physical activity/yoga." },
        { text: "Avoid processed sugars and high-sodium foods." },
        { text: "Include more fiber-rich green vegetables in every meal." },
        { text: "Practice deep breathing exercises for stress management." }
      ],
      guidelines: [
        "Maintain a consistent sleep schedule (7-8 hours).",
        "Drink at least 3 liters of water daily.",
        "Perform 30 minutes of light physical activity/yoga.",
        "Avoid processed sugars and high-sodium foods.",
        "Include more fiber-rich green vegetables in every meal.",
        "Practice deep breathing exercises for stress management."
      ],
      doctors: [
        {
          name: "MS. DEVIKA CHUGH",
          qualification: "Counselling Psychologist\nPsychologist",
          signatures: []
        },
        {
          name: "DR. SHEFALI CHHICHOLIA",
          qualification: "BHMS, MD\nHomeopathy",
          signatures: []
        },
        {
          name: "DR. JAYANT KUMAR",
          qualification: "BAMS\nAyurveda",
          signatures: []
        }
      ],
      logoBase64: getBase64("Logo.png"),
      backgroundBase64: getBase64("Background.png"),
    };
    mockData.cartUrl = generateCartUrl(mockData.recommendedProducts);
    mockData.qrCodeData = await QRCode.toDataURL(`https://sehatup.com/verify/${docId}`);
    const { downloadUrl } = await generatePDF(mockData, docId, "prescription");
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription Test UI</title>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Montserrat', sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 40px; border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1); max-width: 500px; }
          h1 { color: #f12f46; margin-bottom: 10px; margin-top: 0; font-size: 24px; }
          p { color: #94a3b8; margin-bottom: 30px; font-size: 14px; line-height: 1.5; }
          .btn-group { display: flex; gap: 15px; justify-content: center; }
          .btn { text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px; transition: all 0.2s; cursor: pointer; border: none; }
          .btn-primary { background: #f12f46; color: white; }
          .btn-primary:hover { background: #d62539; transform: translateY(-2px); box-shadow: 0 8px 15px rgba(241, 47, 70, 0.3); }
          .btn-secondary { background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
          .btn-secondary:hover { background: rgba(148, 163, 184, 0.1); color: white; }
          .badge { background: #10b98120; color: #10b981; padding: 5px 12px; border-radius: 100px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; display: inline-block; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">Success</div>
          <h1>Prescription Ready</h1>
          <p>Your local test prescription (ID: ${docId}) has been generated using the V3 template.</p>
          <div class="btn-group">
            <a href="${downloadUrl}" target="_blank" class="btn btn-primary">VIEW PDF</a>
            <button onclick="window.location.reload()" class="btn btn-secondary">REGENERATE</button>
          </div>
          <div style="margin-top: 30px; font-size: 11px; color: #475569; font-weight: 600;">
            Generated at: ${new Date().toLocaleTimeString()}
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

const sendReportOnWhatsApp = async (name, phone, reportUrl) => {
  const tenantId = process.env.TENANT_ID;
  const accessToken = process.env.WATI_ACCESS_TOKEN;
  // Construct the WhatsApp API URL
  const url = `https://live-mt-server.wati.io/${tenantId}/api/v2/sendTemplateMessage?whatsappNumber=91${phone}`;

  try {
    // Prepare headers with the access token for authentication
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    const template_name = "send_report_2";
    const data = {
      template_name: `${template_name}`,
      broadcast_name: "report",
      parameters: [
        {
          name: "name",
          value: `${name}`,
        },
        {
          name: "report_url",
          value: reportUrl,
        },
      ],
    };

    // Log the request details for debugging
    const reposone = await axios.post(url, data, { headers });
    // Log the response from the WhatsApp API
    const res = reposone.data;
    if (
      res.result === true &&
      res.error === null &&
      res.receivers[0].isValidWhatsAppNumber
    ) {
      const { localMessageId } = res.receivers[0];
      console.log(`WhatsApp Message sent with id : ${localMessageId}`);
      return { localMessageId, success: true };
    } else {
      throw new Error(
        `Some error occured on WATI.\nThe response is: ${JSON.parse(res)}`
      );
    }
  } catch (error) {
    console.error(`Some error occured : ${error}`);
    throw error;
  }
};

const getRiskMetrics = (healthScore) => {
  let peerComparisonPercentage = 0;
  let peerAverage = 0;
  if (healthScore <= 30) {
    // critical
    peerComparisonPercentage = 80;
    peerAverage = 85;
    return {
      riskDescription:
        "Your score is very low, which means your body is under severe stress. This could be due to ongoing health issues like hormonal imbalance, chronic fatigue, metabolic dysfunction, or emotional burnout. It signals that your health is declining rapidly and may already be affecting your daily life or long-term well-being.",
      riskType: "Critical Risk",
      riskClass: "critical",
      peerComparison: `Your score is lower than ${peerComparisonPercentage}% of people in your age group.`,
      peerAverage,
    };
  }
  if (healthScore > 30 && healthScore <= 60) {
    // high risk
    peerComparisonPercentage = 60;
    peerAverage = 85;
    return {
      riskDescription:
        "Your score indicates that you are in a high-risk zone. Your body is showing multiple signs of imbalance — whether it’s poor sleep, low energy, mood swings, weight issues, or early symptoms of lifestyle-related diseases. These issues are serious and can worsen quickly if ignored.",
      riskType: "High Risk",
      riskClass: "high",
      peerComparison: `Your score is lower than ${peerComparisonPercentage}% of people in your age group.`,
      peerAverage,
    };
  }
  if (healthScore > 60 && healthScore <= 84) {
    // moderate risk
    peerComparisonPercentage = 20;
    peerAverage = 90;
    return {
      riskDescription:
        "Your score suggests that your health is somewhat compromised. There may not be major symptoms now, but your system is under pressure. Signs like reduced stamina, mild stress, hormonal shifts, or disturbed digestion could be early warnings of deeper issues ahead.",
      riskType: "Moderate Risk",
      riskClass: "moderate",
      peerComparison: `Your score is lower than ${peerComparisonPercentage}% of people in your age group.`,
      peerAverage,
    };
  }
  if (healthScore >= 85) {
    peerAverage = healthScore + 5;
    // low risk
    return {
      riskDescription:
        "Your score shows that your health is well-managed and balanced. There are no significant warning signs, and your habits are supporting your well-being. You’re in a strong position to maintain this state and prevent future health problems.",
      riskType: "Low Risk",
      riskClass: "low",
      peerComparison: `Your score is at par with most of the people in your age group`,
      peerAverage,
    };
  }
};

exports.CreatePDFOnFormSubmission = onDocumentCreated(
  {
    document: "questionnaire_submissions/{docId}",
    timeoutSeconds: 300,
    memory: "4GiB",
    region: "us-central1",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }
    let data = snapshot.data();

    const baseUrl = isProduction
      ? "https://sehatup-f96b5.web.app"
      : "https://sehatupdev.web.app";

    // If environment is dev, then exit from the function without generating the PDF
    if (!isProduction) {
      // return;
    }

    data["baseUrl"] = baseUrl;
    const { phone, userName, healthScore, concern } = data;
    data = { ...data, ...getRiskMetrics(healthScore) };
    // Pre-calculate SVG stroke-dashoffset for the PDF (r=170, C=1068.14)
    data["healthScoreOffset"] = 1068.14 * (1 - healthScore / 100);
    data["possibleCauses"] = (data["possibleCauses"] || []).map((item) => {
      return {
        ...item,
        icon: `${baseUrl}/PDF-Assets/possible-causes-icon.png`,
      };
    });
    data["futureRisks"] = (data["futureRisks"] || []).map((item) => {
      return {
        ...item,
        icon: `${baseUrl}/PDF-Assets/future-risks-icon.png`,
      };
    });

    data["recommendedProducts"] = (data["recommendedProducts"] || []).map((item) => {
      return {
        ...item,
        icon: `${baseUrl}/PDF-Assets/why-icon.png`,
        image: item.image || `${baseUrl}/PDF-Assets/generic-product.png`,
      };
    });

    // Resolve missing variant IDs
    if (data["recommendedProducts"] && Array.isArray(data["recommendedProducts"])) {
      data["recommendedProducts"] = await resolveAllVariantIds(data["recommendedProducts"]);
    }

    // Generate Cart URL for the report
    const utmSource = data.collectionName === 'performance_marketing' ? 'marketing_panel' : 'report_link';
    data["cartUrl"] = generateCartUrl(data["recommendedProducts"], utmSource);
    data["cartLink"] = data["cartUrl"]; // Map for template

    // Dynamic Timeline Icon

    // Dynamic Timeline Icon
    let timelineIcon = "8.png";
    data["timelineIconUrl"] = `${baseUrl}/PDF-Assets/${timelineIcon}`;

    if (concern === "ed") {
      data["productImage"] = "ED-group.jpg";
    }
    if (concern === "pe") {
      data["productImage"] = "PE-group.jpg";
    }
    if (concern === "both") {
      data["productImage"] = "BOTH-group.jpg";
    }
    if (concern === "Male Weight Management") {
      data["productImage"] = "generic-image.jpg";
    }
    if (concern === "Female Weight Management") {
      data["productImage"] = "generic-image.jpg";
    }
    if (concern === "Female Wellness") {
      data["productImage"] = "generic-image.jpg";
    }
    if (concern === "Women's Weight Management" || concern === "Womens Weight Management") {
      data["productImage"] = "BOTH-group.jpg"; // Using a group image for now
    }

    // Get the document ID from the event context
    const docId = event.params.docId;
    try {
      const { storagePath, downloadUrl } = await generatePDF(data, docId);

      // Update the document with both the storage path and download URL
      await snapshot.ref.update({
        ...getRiskMetrics(healthScore),
        reportStoragePath: storagePath,
        reportDownloadUrl: downloadUrl,
        pdfGeneratedAt: FieldValue.serverTimestamp(),
        isWhatsAppSent: false,
      });

      console.log(`PDF can be downloaded from: ${downloadUrl}`);

      // Send WhatsApp message to user with the report
      try {
        console.log(`[WhatsApp] Sending report to ${phone} (${userName})`);
        const whatsAppResponse = await sendReportOnWhatsApp(
          userName,
          phone,
          downloadUrl
        );

        if (whatsAppResponse && whatsAppResponse.success) {
          // Update the document with WhatsApp message details
          await snapshot.ref.update({
            isWhatsAppSent: true,
            localMessageId: whatsAppResponse.localMessageId,
            wAMessageSentAt: FieldValue.serverTimestamp(),
          });

          // 2. Update the whatsapp_requests sub-collection status
          const requests = await snapshot.ref.collection("whatsapp_requests")
            .where("status", "==", "pending")
            .limit(1)
            .get();

          if (!requests.empty) {
            await requests.docs[0].ref.update({
              status: "sent",
              sentAt: FieldValue.serverTimestamp(),
              platform: "automated_report"
            });
            console.log(`[WhatsApp] Sub-collection request updated properly.`);
          }
          console.log(`[WhatsApp] Status updated in Firestore: ${whatsAppResponse.localMessageId}`);
        }
      } catch (waError) {
        console.error("[WhatsApp] Failed to send automated report:", waError.message);
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  }
);

exports.CreatePrescriptionPDFOnTrigger = onDocumentCreated(
  {
    document: "prescriptions/{docId}",
    timeoutSeconds: 300,
    memory: "4GiB",
    region: "us-central1",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }
    const data = snapshot.data();

    const baseUrl = isProduction
      ? "https://sehatup-f96b5.web.app"
      : "https://sehatupdev.web.app";

    data["baseUrl"] = baseUrl;
    const docId = event.params.docId;

    // Inject base64 assets for reliable PDF generation
    data["logoBase64"] = getBase64("Logo.png");
    data["signatureBase64"] = getBase64("Signature.png");
    data["backgroundBase64"] = getBase64("Background.png");

    // Format Date
    data.date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Handle Presets Booleans
    const preset = data.preset || 'general';
    data.isGeneralPreset = preset === 'general';
    data.isWeightPreset = preset === 'weight';
    data.isPcodPreset = preset === 'pcod';
    data.isWellnessPreset = preset === 'wellness';

    // Map recommendedProducts for V3 Template and resolve missing variantIds
    if (data.recommendedProducts && Array.isArray(data.recommendedProducts)) {
      data.recommendedProducts = data.recommendedProducts.map((prod) => {
        // Dosage array for schedule type (ensure it is 4 elements)
        let dosage = prod.dosage || ["0", "0", "0", "0"];
        if (typeof dosage === "string") {
          dosage = dosage.split("-").map(d => d.trim());
        }
        while (dosage.length < 4) dosage.push("0");

        const finalQty = prod.qty || prod.quantity || 1;
        return {
          ...prod,
          qty: finalQty,
          quantity: finalQty,
          dosage,
          dosageType: prod.dosageType || "schedule",
          type: prod.type || prod.detailsHeader?.split("|")?.[0]?.trim() || "TABLET",
          timing: prod.timing || prod.detailsHeader?.split("|")?.[1]?.trim() || "As directed",
          instruction: prod.instruction || prod.detailsSubtext || "As directed",
          duration: prod.duration || `${prod.durationQty || "1"} ${prod.durationUnit || "Month"}${prod.durationQty > 1 ? "s" : ""}`,
          contains: prod.contains || ""
        };
      });
    }

    // Generate Cart URL for the prescription
    if (data.recommendedProducts) {
      data.recommendedProducts = await resolveAllVariantIds(data.recommendedProducts);
    }
    const collectionName = data.submissionCollectionName || 'prescriptions';
    const utmSource = collectionName === 'performance_marketing' ? 'marketing_panel' : 'doctor_panel';
    data["cartUrl"] = generateCartUrl(data["recommendedProducts"], utmSource);
    data["cartLink"] = data["cartUrl"]; // Map for template

    // Process Guidelines (Unified Advice)
    // Handle legacy/test fields
    const dietLines = typeof data.dietAdvice === "string" ?
      data.dietAdvice.split("\n").filter(l => l.trim()) :
      (Array.isArray(data.dietAdvice) ? data.dietAdvice : []);

    const lifestyleLines = typeof data.lifestyleAdvice === "string" ?
      data.lifestyleAdvice.split("\n").filter(l => l.trim()) :
      (Array.isArray(data.lifestyleAdvice) ? data.lifestyleAdvice : []);

    // Handle real dashboard field (lifestyleChanges is [{text: '...'}])
    const structuredLifestyleLines = Array.isArray(data.lifestyleChanges) ?
      data.lifestyleChanges.map(item => typeof item === 'object' ? item.text : item).filter(Boolean) : [];

    data.guidelines = [...dietLines, ...lifestyleLines, ...structuredLifestyleLines];

    // Ensure necessary fields for V3 layout

    // Ensure necessary fields for V3 layout
    data.consultationDate = data.consultationDate || data.date;
    data.prescriptionID = data.prescriptionID || data.displayId || "RX-XXXX";

    // Generate QR Code for Digital Authenticity
    try {
      const qrData = data.prescriptionDownloadUrl || `https://www.sehatup.com/prescriptions/${docId}`;
      data.qrCodeData = await QRCode.toDataURL(qrData);
    } catch (qrErr) {
      console.warn("QR Generation failed:", qrErr);
    }

    try {
      const { storagePath, downloadUrl } = await generatePDF(
        data,
        docId,
        "prescription"
      );

      // 1. Update the main prescription document
      const updatePayload = {
        prescriptionStoragePath: storagePath,
        prescriptionDownloadUrl: downloadUrl,
        pdfGeneratedAt: Firestore.FieldValue.serverTimestamp(),
        cartUrl: data["cartUrl"] || null,
        cartLink: data["cartLink"] || null,
        recommendedProducts: data["recommendedProducts"] || []
      };
      await snapshot.ref.update(updatePayload);

      const db = getFirestore();

      // 2. Write PDF URL back to the original submission doc
      const submissionCollection = data.submissionCollectionName || 'questionnaire_submissions';
      const patientId = data.patientId;
      if (patientId) {
        try {
          await db.collection(submissionCollection).doc(patientId).update({
            prescriptionDocId: docId,
            prescriptionDownloadUrl: downloadUrl,
            prescriptionGeneratedAt: Firestore.FieldValue.serverTimestamp(),
            cartUrl: data["cartUrl"] || null // Add cartUrl here too
          });

          // 3. Update the replicated doc in the patient's subcollection
          await db.collection(submissionCollection).doc(patientId)
            .collection("prescriptions").doc(docId).update(updatePayload);

          console.log(`Submission ${patientId} and subcollection updated with prescription results.`);
        } catch (e) {
          console.warn(`Could not update submission or subcollection doc: ${e.message}`);
        }
      }

      // 4. Update the replicated doc in the doctor's my_prescriptions collection
      const doctorUid = data.doctorUid;
      if (doctorUid) {
        try {
          await db.collection("users").doc(doctorUid)
            .collection("my_prescriptions").doc(docId).update(updatePayload);
          console.log(`Doctor ${doctorUid} record updated with prescription results.`);
        } catch (e) {
          console.warn(`Could not update doctor record: ${e.message}`);
        }
      }

      console.log(`Prescription PDF can be downloaded from: ${downloadUrl}`);
    } catch (error) {
      console.error("Error generating Prescription PDF:", error);
      throw error;
    }
  }
);

exports.generatePrescriptionPDF_HTTP = onRequest(
  {
    timeoutSeconds: 300,
    memory: "4GiB",
    region: "us-central1"
  },
  async (req, res) => {
    // Manually handle CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const docId = req.query.docId;
      if (!docId) {
        return res.status(400).send({ error: "Missing docId parameter" });
      }

      const db = getFirestore();
      const docRef = db.collection("prescriptions").doc(docId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return res.status(404).send({ error: "Prescription not found" });
      }

      const data = docSnap.data();
      const baseUrl = isProduction
        ? "https://sehatup-f96b5.web.app"
        : "https://sehatupdev.web.app";

      data["baseUrl"] = baseUrl;
      data["logoBase64"] = getBase64("Logo.png");
      data["signatureBase64"] = getBase64("Signature.png");
      data["backgroundBase64"] = getBase64("Background.png");
      data.date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const preset = data.preset || 'general';
      data.isGeneralPreset = preset === 'general';
      data.isWeightPreset = preset === 'weight';
      data.isPcodPreset = preset === 'pcod';
      data.isWellnessPreset = preset === 'wellness';

      // Map recommendedProducts for V3 Template and resolve missing variantIds
      if (data.recommendedProducts && Array.isArray(data.recommendedProducts)) {
        data.recommendedProducts = data.recommendedProducts.map((prod) => {
          let dosage = prod.dosage || ["0", "0", "0", "0"];
          if (typeof dosage === "string") {
            dosage = dosage.split("-").map(d => d.trim());
          }
          while (dosage.length < 4) dosage.push("0");

          const finalQty = prod.qty || prod.quantity || 1;
          return {
            ...prod,
            qty: finalQty,
            quantity: finalQty,
            dosage,
            dosageType: prod.dosageType || "schedule",
            type: prod.type || prod.detailsHeader?.split("|")?.[0]?.trim() || "TABLET",
            timing: prod.timing || prod.detailsHeader?.split("|")?.[1]?.trim() || "As directed",
            instruction: prod.instruction || prod.detailsSubtext || "As directed",
            duration: prod.duration || `${prod.durationQty || "1"} ${prod.durationUnit || "Month"}${prod.durationQty > 1 ? "s" : ""}`,
            contains: prod.contains || ""
          };
        });
      }

      // Generate Cart URL for the prescription
      if (data.recommendedProducts) {
        data.recommendedProducts = await resolveAllVariantIds(data.recommendedProducts);
      }
      const utmSource = data.submissionCollectionName === 'performance_marketing' ? 'marketing_panel' : 'doctor_panel';
      data["cartUrl"] = generateCartUrl(data["recommendedProducts"], utmSource);
      data["cartLink"] = data["cartUrl"]; // Map for template

      // Process Guidelines (Unified Advice)
      const dietLines = typeof data.dietAdvice === "string" ?
        data.dietAdvice.split("\n").filter(l => l.trim()) :
        (Array.isArray(data.dietAdvice) ? data.dietAdvice : []);

      const lifestyleLines = typeof data.lifestyleAdvice === "string" ?
        data.lifestyleAdvice.split("\n").filter(l => l.trim()) :
        (Array.isArray(data.lifestyleAdvice) ? data.lifestyleAdvice : []);

      // Handle real dashboard field (lifestyleChanges is [{text: '...'}])
      const structuredLifestyleLines = Array.isArray(data.lifestyleChanges) ?
        data.lifestyleChanges.map(item => typeof item === 'object' ? item.text : item).filter(Boolean) : [];

      data.guidelines = [...dietLines, ...lifestyleLines, ...structuredLifestyleLines];

      console.log(`[HTTP PDF] Guidelines count: ${data.guidelines.length}`);

      data.consultationDate = data.consultationDate || data.date;

      data.consultationDate = data.consultationDate || data.date;
      data.prescriptionID = data.prescriptionID || data.displayId || "RX-XXXX";

      // QR Code
      try {
        const qrData = data.prescriptionDownloadUrl || `${baseUrl}/prescriptions/${docId}`;
        data.qrCodeData = await QRCode.toDataURL(qrData);
      } catch (qrErr) {
        console.warn("QR Generation failed:", qrErr);
      }

      const { storagePath, downloadUrl } = await generatePDF(data, docId, "prescription");

      // Update both the prescriptions record AND the user's history record
      const updatePayload = {
        prescriptionStoragePath: storagePath,
        prescriptionDownloadUrl: downloadUrl,
        pdfGeneratedAt: Firestore.FieldValue.serverTimestamp(),
        cartUrl: data["cartUrl"] || null,
        cartLink: data["cartLink"] || null,
        recommendedProducts: data["recommendedProducts"] || []
      };
      await docRef.update(updatePayload);

      // Find and update the history record in the doctor's collection
      const historyQuery = await db
        .collectionGroup("my_prescriptions")
        .where("patientId", "==", data.patientId || "")
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();

      if (!historyQuery.empty) {
        await historyQuery.docs[0].ref.update(updatePayload);
      }

      // Propagate to patient's subcollection too (for consistency)
      const submissionCollection = data.submissionCollectionName || 'questionnaire_submissions';
      const patientId = data.patientId;
      if (patientId) {
        try {
          await db.collection(submissionCollection).doc(patientId).update({
            prescriptionDownloadUrl: downloadUrl,
            cartUrl: data["cartUrl"] || null
          });
          await db.collection(submissionCollection).doc(patientId)
            .collection("prescriptions").doc(docId).update(updatePayload);
        } catch (e) {
          console.warn(`[HTTP PDF] Could not propagate to patient subcollection: ${e.message}`);
        }
      }

      return res.status(200).send({ success: true, downloadUrl });
    } catch (error) {
      console.error("HTTP PDF Generation Error:", error);
      return res.status(500).send({ error: error.message });
    }
  }
);

exports.getLatestReportByPhoneNumber = onRequest(
  {
    timeoutSeconds: 300,
    memory: "4GiB",
    region: "asia-south2",
  },
  async (req, res) => {
    const phone = req.path.replace("/", "");
    console.log(`${Date.now()}: Phone number: ${phone}`);
    //check if phone is exactly a 10 digit number via regex
    if (!/^\d{10}$/.test(phone)) {
      return res
        .status(200)
        .send({ success: false, error: "Invalid phone number" });
    }

    const db = getFirestore();
    const userDocSnapshot = await db
      .collection("questionnaire_submissions")
      .where("phone", "==", phone)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    if (userDocSnapshot.empty) {
      return res.status(200).send({ success: false, error: "No report found" });
    }

    const doc = userDocSnapshot.docs[0];
    let { reportDownloadUrl, userName, phone: dbPhone } = doc.data();

    if (!reportDownloadUrl) {
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts && !reportDownloadUrl) {
        console.log(`Polling for report... Attempt ${attempts + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const latestDoc = await doc.ref.get();
        if (latestDoc.exists) {
          reportDownloadUrl = latestDoc.data().reportDownloadUrl;
        }
        attempts++;
      }
    }

    if (reportDownloadUrl) {
      // 1. Update the parent document status
      await doc.ref.update({
        isWhatsAppSent: true,
        wAMessageSentAt: FieldValue.serverTimestamp(),
      });

      // 2. Update the whatsapp_requests sub-collection status
      const requests = await doc.ref.collection("whatsapp_requests")
        .where("status", "==", "pending")
        .limit(1)
        .get();

      if (!requests.empty) {
        await requests.docs[0].ref.update({
          status: "sent",
          sentAt: FieldValue.serverTimestamp(),
          platform: "quickreply"
        });
      }

      return res.status(200).send({
        success: true,
        report_url: reportDownloadUrl,
        name: userName || "User",
        phone: dbPhone || phone
      });
    } else {
      return res.status(200).send({
        success: false,
        status: "processing",
        message: "Report is being generated. Please try again in 10 seconds."
      });
    }
  }
);

exports.getReportByPhoneForTest = onRequest(
  {
    timeoutSeconds: 300,
    memory: "1GiB",
    region: "asia-south2",
  },
  async (req, res) => {
    const phone = req.path.replace("/", "");
    console.log(`[TEST] Fetching real report for: ${phone}`);

    const db = getFirestore();
    const userDocSnapshot = await db
      .collection("questionnaire_submissions")
      .where("phone", "==", phone)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    if (userDocSnapshot.empty) {
      return res.status(200).send({ success: false, error: "No report found in development" });
    }

    const doc = userDocSnapshot.docs[0];
    let { reportDownloadUrl, userName, phone: dbPhone } = doc.data();

    if (reportDownloadUrl) {
      // 1. Update the parent document status (for testing the flag change)
      await doc.ref.update({
        isWhatsAppSent: true,
        wAMessageSentAt: FieldValue.serverTimestamp(),
      });

      // 2. Update the whatsapp_requests sub-collection status
      const requests = await doc.ref.collection("whatsapp_requests")
        .where("status", "==", "pending")
        .limit(1)
        .get();

      if (!requests.empty) {
        await requests.docs[0].ref.update({
          status: "sent",
          sentAt: FieldValue.serverTimestamp(),
          platform: "quickreply_test"
        });
      }

      return res.status(200).send({
        success: true,
        report_url: reportDownloadUrl,
        name: userName || "Test User",
        phone: dbPhone || phone
      });
    } else {
      return res.status(200).send({
        success: false,
        status: "processing",
        message: "Report is still being generated. Please wait."
      });
    }
  }
);



// send otp to whatsapp via quickreply.ai whatsapp template
const sendOTPToWhatsApp = async (phone, otp) => {
  let data = JSON.stringify({
    params: [`${otp}`],
    to: `+91${phone}`,
    button_params: [`${otp}`],
  });

  let templateId = "68592d88decc5cf006b673d1_wt";

  let config = {
    method: "POST",
    url: `https://app.quickreply.ai/api/whatsapp/send-template?templateId=${templateId}`,
    headers: {
      "client-id": process.env.QUICKREPLY_CLIENT_ID,
      "secret-key": process.env.QUICKREPLY_SECRET_KEY,
      "Content-Type": "application/json",
    },
    data: data,
  };

  const response = await axios.request(config);

  if (response.status === 200) {
    return { success: true, data: response.data };
  } else {
    return { success: false, error: response.data };
  }
};

exports.generateOTP = onRequest(
  {
    timeoutSeconds: 300,
    memory: "1GiB",
    region: "asia-south2",
    cors: true,
  },
  async (req, res) => {
    //Check if the request is a POST request
    if (req.method !== "POST") {
      return res
        .status(405)
        .send({ success: false, error: "Method not allowed" });
    }
    //Check if the request body contains a phone number
    const { phone } = req.body;
    if (!phone) {
      return res
        .status(400)
        .send({ success: false, error: "Phone number is required" });
    }
    //Check if the phone number is exactly a 10 digit number
    if (!/^\d{10}$/.test(phone)) {
      return res
        .status(400)
        .send({ success: false, error: "Invalid phone number" });
    }
    //Generate OTP using otplib
    const secret = `${process.env.TOTP_SECRET}_${phone}`;
    totp.options = {
      digits: 6,
      step: 60,
      window: 2,
    };
    const otp = totp.generate(secret);
    //Send OTP to whatsapp
    const whatsAppResponse = await sendOTPToWhatsApp(phone, otp);
    // const whatsAppResponse = { success: true };
    if (whatsAppResponse.success) {
      return res.status(200).send({ success: true, otp: otp });
    } else {
      return res
        .status(200)
        .send({ success: false, error: whatsAppResponse.error });
    }
  }
);

exports.verifyOTP = onRequest(
  {
    timeoutSeconds: 300,
    memory: "1GiB",
    region: "asia-south2",
    cors: true,
  },
  async (req, res) => {
    const { phone, otp } = req.body;
    //Check if the request is a POST request
    if (req.method !== "POST") {
      return res
        .status(405)
        .send({ success: false, error: "Method not allowed" });
    }
    //Check if the request body contains a phone number and otp
    if (!phone || !otp) {
      return res
        .status(400)
        .send({ success: false, error: "Phone number and OTP are required" });
    }
    //check if otp is exactly 6 digits
    if (otp.length !== 6) {
      return res
        .status(400)
        .send({ success: false, error: "OTP must be exactly 6 digits" });
    }
    //Verify OTP using otplib
    const secret = `${process.env.TOTP_SECRET}_${phone}`;
    try {
      totp.options = {
        digits: 6,
        step: 60,
        window: 2,
      };
      const isValid = totp.check(otp, secret);
      if (isValid) {
        return res
          .status(200)
          .send({ success: true, message: "OTP verified successfully" });
      } else {
        return res.status(200).send({ success: false, error: "Invalid OTP" });
      }
    } catch (error) {
      console.log(`error: ${error}`);
      return res.status(200).send({ success: false, error: "Invalid OTP" });
    }
  }
);

exports.triggerEventForPartialSub = onRequest(
  {
    timeoutSeconds: 300,
    memory: "256MiB",
    region: "us-central1",
    timeoutSeconds: 300,
    cors: true,
  },
  async (req, res) => {
    const db = getFirestore();

    // get current timestamp in firestore timestamp format
    const currentTimestamp = Firestore.Timestamp.now();
    // convert oneHourAgo to firestore timestamp format
    const oneHourAgoTimestamp = Firestore.Timestamp.fromMillis(
      currentTimestamp.toDate().getTime() - 3600000
    );
    // get documents from partial_submissions collection such that the timestamp is greater than 1 hour ago and reminderSent is false
    const partialSubmissions = await db
      .collection("partial_submissions")
      .where("timestamp", "<", oneHourAgoTimestamp)
      .where("reminderSent", "==", false)
      .get();
    // get phone numbers and name from partial_submissions in an array
    let userData = partialSubmissions.docs.map((doc) => {
      return {
        phoneNumber: doc.data().phone,
        name: doc.data().name,
        docId: doc.id,
        reportCategory: doc.data().reportCategory,
      };
    });

    const docIdMap = {};
    for (const { phoneNumber, docId } of userData) {
      if (!docIdMap[phoneNumber]) {
        docIdMap[phoneNumber] = [];
      }
      docIdMap[phoneNumber].push(docId);
    }
    //remove duplicates from userData on the basis of phoneNumber and reportCategory.
    userData = userData.filter(
      (item, index, self) =>
        index === self.findIndex((t) => t.phoneNumber === item.phoneNumber)
    );

    for (const { phoneNumber, name } of userData) {
      try {
        // mark the document as completed in the partial_submissions collection
        docIdMap[phoneNumber].forEach(async (docId) => {
          await db.collection("partial_submissions").doc(docId).set(
            {
              reminderSent: true,
              reminderSentAt: Firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        });
      } catch (error) {
        console.log(`error: ${error}`);
      }
    }

    return res.status(200).send({
      success: true,
      message: `Event triggered successfully.`,
      userData,
      docIdMap,
    });
  }
);
// return phone numbers from partial submissions collection in firebase firestore
exports.triggerEventForPartialSubmissions = onSchedule(
  {
    // cron expression for every 1 hour between 09:00 AM and 09:00 PM
    schedule: "0 09-21 * * *",
    timeZone: "Asia/Kolkata",
    memory: "256MiB",
    region: "us-central1",
    timeoutSeconds: 300,
  },
  async (event) => {
    const db = getFirestore();

    // get current timestamp in firestore timestamp format
    const currentTimestamp = Firestore.Timestamp.now();
    // convert oneHourAgo to firestore timestamp format
    const oneHourAgoTimestamp = Firestore.Timestamp.fromMillis(
      currentTimestamp.toDate().getTime() - 3600000
    );
    // get documents from partial_submissions collection such that the timestamp is greater than 1 hour ago and reminderSent is false
    const partialSubmissions = await db
      .collection("partial_submissions")
      .where("timestamp", "<", oneHourAgoTimestamp)
      .where("reminderSent", "==", false)
      .get();
    // get phone numbers and name from partial_submissions in an array
    let userData = partialSubmissions.docs.map((doc) => {
      return {
        phoneNumber: doc.data().phone,
        name: doc.data().name,
        docId: doc.id,
        reportCategory: doc.data().reportCategory,
      };
    });

    // Create a json object where the key is phoneNumber and the value is an array of docIds
    const docIdMap = {};
    for (const { phoneNumber, docId } of userData) {
      if (!docIdMap[phoneNumber]) {
        docIdMap[phoneNumber] = [];
      }
      docIdMap[phoneNumber].push(docId);
    }

    //remove duplicates from userData on the basis of phoneNumber
    userData = userData.filter(
      (item, index, self) =>
        index === self.findIndex((t) => t.phoneNumber === item.phoneNumber)
    );

    console.log(`userData: ${JSON.stringify(userData)}`);

    for (const { phoneNumber, name } of userData) {
      try {
        //create headers with content-type application/json
        const headers = {
          "Content-Type": "application/json",
        };
        // create body with phoneNumber and name
        const body = {
          phone: `+91${phoneNumber}`,
          name: name,
          status: "dropped_off",
        };
        // send a post request to the url https://api.quickreply.ai/webhook/company/GgbHGAprcvQx26qKL_c/key/2RDGFsQLwBEiX8aHT with the body and headers and log the response
        const response = await axios.post(
          "https://api.quickreply.ai/webhook/company/GgbHGAprcvQx26qKL_c/key/2RDGFsQLwBEiX8aHT",
          body,
          { headers }
        );
        console.log(`response: ${JSON.stringify(response.data)}`);

        // mark all the document as completed in the partial_submissions collection
        docIdMap[phoneNumber].forEach(async (docId) => {
          await db.collection("partial_submissions").doc(docId).set(
            {
              reminderSent: true,
              reminderSentAt: Firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        });
      } catch (error) {
        console.log(`error: ${error}`);
      }
    }
  }
);
