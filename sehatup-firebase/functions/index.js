// index.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, cert } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { getAuth } = require("firebase-admin/auth");
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

handlebars.registerHelper("add", function (a, b) {
  return parseInt(a) + parseInt(b);
});

// ─── Diet & Lifestyle Plan Templates ─────────────────────────────────────────
const DIET_PLANS = {
  lean_to_weight_gain: {
    condition: "PCOD (Lean Type) with Hairfall, Weakness, Heavy Periods",
    subtitle: "Diet planned considering hormonal imbalance, nutritional deficiency & low body weight",
    meals: [
      {
        time: "Early Morning (7:00–8:00 AM)",
        food: "1 glass lukewarm water + 5 soaked almonds + 2 walnuts + 5–6 soaked black raisins",
        benefit: "Helps improve energy levels, supports hair growth & reduces weakness caused by heavy periods"
      },
      {
        time: "Breakfast (8:30–9:30 AM)",
        food: "Option 1: Paneer sandwich (multigrain bread)  |  Option 2: 2 eggs + 1 toast  |  Option 3: Vegetable poha with peanuts",
        benefit: "High protein + healthy fats help in weight gain, reduce hairfall & support hormonal balance"
      },
      {
        time: "Mid-Morning (11:00–12:00 PM)",
        food: "1 banana / chikoo / mango (seasonal)",
        benefit: "Supports healthy weight gain & maintains energy throughout the day"
      },
      {
        time: "Lunch (1:30–2:30 PM)",
        food: "2 multigrain roti + 1 bowl sabzi + 1 bowl dal/paneer + 1 bowl curd  |  Small portion salad before meal",
        benefit: "Balanced nutrition improves digestion, supports hormones & reduces weakness"
      },
      {
        time: "Evening Snack (5:00–6:00 PM)",
        food: "Tea (light) + peanut chaat / roasted chana  |  OR coconut water + handful makhana",
        benefit: "Maintains energy levels & reduces muscle fatigue"
      },
      {
        time: "Dinner (7:30–8:30 PM)",
        food: "2 roti + sabzi + paneer/dal",
        benefit: "No restriction on dinner quantity – focus on nourishment & recovery"
      }
    ],
    dailyAddons: {
      food: "1 tsp seeds mix (flax + pumpkin) + 1–2 tsp ghee daily",
      benefit: "Improves hormonal balance, hair health & supports weight gain"
    },
    specialFocus: {
      title: "Heavy Periods & Weakness",
      food: "Include beetroot, spinach, black raisins regularly",
      benefit: "Helps improve blood levels & reduces fatigue"
    },
    avoidFoods: [
      "Avoid junk, packaged food, excess sugar",
      "Limit tea/coffee (max 1–2 cups)",
      "Prevents further hormonal imbalance"
    ],
    hydration: "2.5–3 litres water daily",
    lifestyle: [
      "30 minutes light exercise or walk",
      "Proper sleep (7–8 hours)",
      "Avoid stress & late night eating"
    ],
    followUp: "Review after 15 days for weight and symptom improvement",
    note: "This diet is specifically designed for lean PCOD patients with weakness and heavy menstrual flow. Focus is on improving nutritional status, hormonal balance & gradual healthy weight gain."
  },

  weight_to_lean: {
    condition: "PCOD with Weight Gain, Acne, Hairfall & Irregular Periods",
    subtitle: "Diet planned considering hormonal imbalance, metabolism disturbance & digestive issues",
    meals: [
      {
        time: "Early Morning (7:00–8:00 AM)",
        food: "1 glass lukewarm water + lemon (without sugar) + 1 tsp soaked methi seeds",
        benefit: "Helps improve digestion, reduce bloating & support fat metabolism"
      },
      {
        time: "Breakfast (8:30–9:30 AM)",
        food: "Option 1: 2 besan chilla + curd  |  Option 2: Vegetable oats + seeds mix  |  Option 3: 2 eggs + 1 multigrain toast",
        benefit: "High protein breakfast helps reduce acne, hairfall & controls cravings"
      },
      {
        time: "Mid-Morning (11:00–12:00 PM)",
        food: "1 fruit (apple/guava/papaya)",
        benefit: "Maintains energy levels & prevents overeating"
      },
      {
        time: "Lunch (1:30–2:30 PM)",
        food: "2 multigrain roti + 1 bowl sabzi + 1 bowl dal/paneer + salad before meal",
        benefit: "Balanced meal supports hormonal balance & weight control"
      },
      {
        time: "Evening Snack (5:00–6:00 PM)",
        food: "Green tea / normal tea (without sugar) + roasted chana / makhana",
        benefit: "Controls cravings & supports metabolism"
      },
      {
        time: "Dinner (7:30–8:30 PM)",
        food: "1–2 roti + sabzi OR vegetable soup + paneer",
        benefit: "Light dinner helps reduce bloating & supports fat loss"
      }
    ],
    dailyAddons: {
      food: "Flax seeds – 1 tsp, Pumpkin seeds – 1 tsp, 2 walnuts",
      benefit: "Supports hormonal balance, reduces acne & hairfall"
    },
    avoidFoods: [
      "Avoid sugar, bakery, fried & packaged food",
      "Limit rice, potato, banana, mango",
      "Reduce excess tea/coffee"
    ],
    hydration: "2.5–3 litres water daily",
    lifestyle: [
      "30–40 min daily walk/exercise",
      "Proper sleep (7–8 hrs)",
      "Avoid late night eating"
    ],
    followUp: "Review after 15 days",
    note: "This diet focuses on hormonal balance, weight reduction & improvement in skin and hair health."
  },

  infertility_pcod_pcos: {
    condition: "PCOD with Irregular Periods & Infertility Concerns",
    subtitle: "Diet planned considering hormonal imbalance, ovulation support & reproductive health",
    meals: [
      {
        time: "Early Morning (7:00–8:00 AM)",
        food: "Lukewarm water + 1 tsp soaked methi seeds OR 2 walnuts",
        benefit: "Supports hormonal balance & ovulation function"
      },
      {
        time: "Breakfast (High Protein)",
        food: "Besan chilla + curd  /  Eggs + toast  /  Oats + seeds",
        benefit: "Improves egg quality & stabilizes hormones"
      },
      {
        time: "Mid-Morning",
        food: "1 fruit (apple/guava/papaya)",
        benefit: "Maintains energy & prevents hormonal fluctuations"
      },
      {
        time: "Lunch",
        food: "2 roti + sabzi + dal/paneer + salad",
        benefit: "Balanced nutrition supports reproductive system"
      },
      {
        time: "Evening Snack",
        food: "Green tea / normal tea (no sugar) + roasted chana/makhana",
        benefit: "Controls cravings & supports metabolism"
      },
      {
        time: "Dinner (Light & Early)",
        food: "1–2 roti + sabzi OR soup + paneer",
        benefit: "Improves digestion & supports hormonal recovery"
      }
    ],
    dailyAddons: {
      food: "Flax seeds, pumpkin seeds, walnuts",
      benefit: "Supports ovulation, hormone balance & fertility"
    },
    specialFocus: {
      title: "Reproductive Health",
      food: "Include leafy greens, beetroot, nuts, seeds regularly",
      benefit: "Improves blood flow & reproductive health"
    },
    avoidFoods: [
      "Sugar, junk food, packaged food, excess caffeine",
      "Prevents hormonal imbalance"
    ],
    lifestyle: [
      "30–40 min walk daily",
      "Stress management",
      "Proper sleep",
      "Regular cycle support is essential"
    ],
    followUp: "Review after 15 days"
  },

  thyroid_diabetes_pcod: {
    condition: "PCOD with Thyroid Imbalance, Sugar Tendency, Leucorrhea & Weakness",
    subtitle: "Diet planned considering hormonal imbalance, metabolism disturbance & nutritional deficiency",
    meals: [
      {
        time: "Early Morning (7:00–8:00 AM)",
        food: "Lukewarm water + 1 tsp soaked methi seeds",
        benefit: "Helps control sugar levels & supports hormonal balance"
      },
      {
        time: "Breakfast (High Protein)",
        food: "Besan chilla + curd  /  Eggs + toast  /  Vegetable oats + seeds",
        benefit: "Supports thyroid, reduces hairfall & controls cravings"
      },
      {
        time: "Mid-Morning",
        food: "1 fruit (apple/guava/papaya)",
        benefit: "Maintains steady energy levels"
      },
      {
        time: "Lunch",
        food: "2 roti + sabzi + dal/paneer + salad",
        benefit: "Improves digestion & supports hormones"
      },
      {
        time: "Evening Snack",
        food: "Tea (no sugar) + roasted chana/makhana",
        benefit: "Prevents weakness & cravings"
      },
      {
        time: "Dinner",
        food: "1–2 roti + sabzi OR soup + paneer",
        benefit: "Light dinner improves metabolism & reduces bloating"
      }
    ],
    dailyAddons: {
      food: "Flax seeds, pumpkin seeds, walnuts, black raisins",
      benefit: "Helps in hairfall, weakness & hormonal balance"
    },
    specialFocus: {
      title: "Leucorrhea & Overall Health",
      food: "Curd (daytime), coconut water, green vegetables",
      benefit: "Supports leucorrhea & overall health"
    },
    avoidFoods: [
      "Sugar, junk food, packaged food",
      "Limit tea/coffee"
    ],
    lifestyle: [
      "Daily walk",
      "Proper sleep",
      "Stress management"
    ],
    followUp: "Review after 15 days"
  },

  general_pcod_pcos: {
    condition: "PCOD with Irregular Periods (General Type)",
    subtitle: "Plan focuses on regulating hormones, improving ovulation and stabilizing insulin levels",
    understandingItems: [
      "Irregular periods are mainly due to hormonal imbalance.",
      "This plan focuses on regulating hormones, improving ovulation and stabilizing insulin levels."
    ],
    meals: [
      {
        time: "Morning Hormone Reset Routine",
        items: [
          "Warm water with soaked methi seeds (4–5 seeds, 4 times/week)",
          "2 soaked walnuts + 5 almonds",
          "10–15 min sunlight exposure for Vitamin D",
          "Light stretching or breathing exercises"
        ]
      },
      {
        time: "Breakfast (High Protein – Must)",
        items: [
          "Paneer bhurji / Eggs / Moong dal chilla",
          "Add 1 tsp flaxseed powder (estrogen balance)",
          "Avoid bread, biscuits, sugary cereals",
          "Tea/coffee without excess sugar"
        ]
      },
      {
        time: "Mid-Morning Hormone Snack",
        items: [
          "Low GI fruit: Apple / Guava / Papaya",
          "1 tsp pumpkin seeds (zinc for hormone support)",
          "Avoid fruit juices"
        ]
      },
      {
        time: "Lunch (Balanced Plate)",
        items: [
          "1–2 roti (multigrain) + sabzi + dal",
          "Include leafy greens (spinach, methi)",
          "1 bowl curd (skip if white discharge)",
          "Avoid fried/oily food"
        ]
      },
      {
        time: "Evening Cortisol Control Snack",
        items: [
          "Herbal tea (cinnamon + tulsi)",
          "Roasted chana / makhana",
          "Avoid biscuits, namkeen"
        ]
      },
      {
        time: "Dinner (Light & Early)",
        items: [
          "Dal + sabzi + 1 roti",
          "1 tsp sesame seeds (cycle regulation)",
          "Finish dinner before 8:30 PM",
          "Avoid heavy carbs at night"
        ]
      }
    ],
    advancedTips: [
      "Seed Cycling: flax + pumpkin (first half cycle), sesame + sunflower (second half)",
      "Protein in every meal improves ovulation",
      "Avoid cold foods during periods",
      "Sleep before 11 PM (melatonin-hormone link)",
      "Daily 20–30 min walk"
    ],
    lifestyle: [
      "Manage stress (yoga, breathing, journaling)",
      "Avoid late nights",
      "Stay hydrated (2–3 litres water)",
      "Consistency is key for results"
    ],
    note: "This is a general plan. Follow consistently for 6–8 weeks for visible results."
  },

  pcod_mood_anxiety_insomnia: {
    condition: "PCOD with Mood Swings, Anxiety, Overthinking & Insomnia",
    subtitle: "Diet planned considering hormonal imbalance, stress factors & nervous system support",
    meals: [
      {
        time: "Early Morning (7:00–8:00 AM)",
        food: "Lukewarm water + 2 walnuts + 4 soaked almonds",
        benefit: "Supports brain health & reduces anxiety"
      },
      {
        time: "Breakfast (High Protein + Brain Support)",
        food: "Besan chilla + curd / Eggs + toast / Oats + seeds",
        benefit: "Stabilizes mood & reduces cravings"
      },
      {
        time: "Mid-Morning",
        food: "1 fruit (banana/apple/papaya)",
        benefit: "Maintains energy & prevents irritability"
      },
      {
        time: "Lunch",
        food: "2 roti + sabzi + dal/paneer + salad",
        benefit: "Balanced meal supports hormones & mental stability"
      },
      {
        time: "Evening Snack",
        food: "Herbal tea / normal tea (no sugar) + makhana/chana",
        benefit: "Prevents anxiety spikes in evening"
      },
      {
        time: "Dinner (Light & Early)",
        food: "1–2 roti + sabzi OR soup + paneer",
        benefit: "Light dinner improves sleep quality"
      }
    ],
    dailyAddons: {
      food: "Flax seeds, pumpkin seeds, walnuts",
      benefit: "Supports hormonal balance & brain function"
    },
    specialFocus: {
      title: "Sleep Support Routine",
      food: "1 glass warm milk at night (if suits) or chamomile tea",
      benefit: "Avoid phone 30–45 mins before sleep"
    },
    avoidFoods: [
      "Caffeine excess, sugar, late night eating, junk food",
      "These worsen anxiety & sleep disturbance"
    ],
    lifestyle: [
      "30 min walk, deep breathing, proper sleep routine",
      "Stress management is essential for recovery"
    ],
    followUp: "Review after 15 days"
  }
};

const injectDietPlan = (data) => {
  const selectedTemplate = data.prescriptionTemplate;
  if (selectedTemplate && DIET_PLANS[selectedTemplate]) {
    data.dietPlan = DIET_PLANS[selectedTemplate];
    data.hasDietPlan = true;
  } else {
    data.hasDietPlan = false;
  }
};

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
    const launchOptions = {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    };
    
    // Workaround for Windows Defender blocking downloaded Chromium locally
    if (process.env.FUNCTIONS_EMULATOR === "true" && process.platform === "win32") {
      const fs = require('fs');
      const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
      if (fs.existsSync(chromePath)) {
        launchOptions.executablePath = chromePath;
      } else if (fs.existsSync(edgePath)) {
        launchOptions.executablePath = edgePath;
      }
    }

    const browser = await puppeteer.launch(launchOptions);
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

// ─── Test: Diet + Prescription PDF ───────────────────────────────────────────
// GET /testDietPrescriptionPDF?template=lean_to_weight_gain
// Generates a full 2-page prescription: page 1 = Rx, page 2 = diet plan
// Defaults to thyroid_diabetes_pcod if no ?template= param given
exports.testDietPrescriptionPDF = onRequest(
  { timeoutSeconds: 300, memory: "2GiB", region: "us-central1" },
  async (req, res) => {
    try {
      const selectedTemplate = req.query.template || "thyroid_diabetes_pcod";

      if (!DIET_PLANS[selectedTemplate]) {
        return res.status(400).send(
          `Unknown template "${selectedTemplate}". Valid options: ${Object.keys(DIET_PLANS).join(", ")}`
        );
      }

      const docId = `DIET-TEST-${Date.now()}`;

      // Configuration for different templates to show relevant data in test
      const templateConfigs = {
        lean_to_weight_gain: {
          primaryDiagnosis: "Lean PCOD with Nutritional Deficiency & Weakness",
          clinicalFindings: "Patient has low BMI, reporting weakness and hairfall. Recommended for healthy weight gain and muscle recovery.",
          recommendedProducts: [
            {
              name: "HER MENSES (FOR RHYTHMIC RELIEF & HORMONAL HARMONY)",
              dosage: ["1", "0", "0", "1"],
              dosageType: "schedule",
              type: "CAPSULE",
              timing: "After Food",
              instruction: "Take with warm water",
              duration: "1 Month",
              quantity: 1,
              contains: "Shatavari, Ashoka, Lodhra"
            },
            {
              name: "SHILAJIT (PURE HIMALAYAN RESIN)",
              dosageValue: "Pea sized",
              dosageType: "text",
              type: "RESIN",
              timing: "With Milk",
              instruction: "Dissolve in warm milk",
              duration: "1 Month",
              quantity: 1,
              contains: "Fulvic Acid, Minerals"
            },
            {
              name: "IRON PLUS SYRUP",
              dosage: ["0", "0", "1", "0"],
              dosageType: "schedule",
              type: "SYRUP",
              timing: "After Food",
              instruction: "Take after dinner",
              duration: "1 Month",
              quantity: 1,
              contains: "Ferrum met, Natrum mur, China off"
            }
          ],
          lifestyleChanges: [
            { text: "Increase protein and healthy fats intake." },
            { text: "Strength training exercises (3 times a week)." },
            { text: "Proper sleep (7–8 hours)." }
          ],
          guidelines: [
            "Increase protein and healthy fats intake.",
            "Strength training exercises (3 times a week).",
            "Proper sleep (7–8 hours)."
          ]
        },
        thyroid_diabetes_pcod: {
          primaryDiagnosis: "PCOD with Thyroid Imbalance & Irregular Periods",
          clinicalFindings: "Hormonal imbalance detected. Elevated TSH. Irregular menstrual cycle. Mild weight gain with weakness.",
          recommendedProducts: [
            {
              name: "HER MENSES (FOR RHYTHMIC RELIEF & HORMONAL HARMONY)",
              dosage: ["1", "0", "0", "1"],
              dosageType: "schedule",
              type: "CAPSULE",
              timing: "After Food",
              instruction: "Take with warm water",
              duration: "1 Month",
              quantity: 1,
              contains: "Shatavari, Ashoka, Lodhra"
            },
            {
              name: "THYRO BALANCE DROPS",
              dosageValue: "10",
              dosageType: "drops",
              dosageFrequency: "3",
              type: "LIQUID",
              timing: "Before Meals",
              instruction: "Dilute in half cup water",
              duration: "45 Days",
              quantity: 1,
              contains: "Fucus vesiculosus, Iodum, Calcarea carb"
            },
            {
              name: "IRON PLUS SYRUP",
              dosage: ["0", "0", "1", "0"],
              dosageType: "schedule",
              type: "SYRUP",
              timing: "After Food",
              instruction: "Take after dinner",
              duration: "1 Month",
              quantity: 1,
              contains: "Ferrum met, Natrum mur, China off"
            }
          ],
          lifestyleChanges: [
            { text: "Avoid sugar and processed foods." },
            { text: "Maintain a consistent sleep schedule (7–8 hours)." },
            { text: "30 minutes of light walk daily." }
          ],
          guidelines: [
            "Avoid sugar and processed foods.",
            "Maintain a consistent sleep schedule (7–8 hours).",
            "30 minutes of light walk daily."
          ]
        }
      };

      const config = templateConfigs[selectedTemplate] || templateConfigs.thyroid_diabetes_pcod;

      const mockData = {
        patientName: "Priya Sharma",
        patientAge: "28",
        patientGender: "Female",
        prescriptionID: `RX-DIET-TEST`,
        displayId: `RX-DIET-TEST`,
        consultationDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        prescriptionTemplate: selectedTemplate,
        ...config,
        doctors: [
          {
            name: "DR. SOMYA SHARMA",
            qualification: "BHMS, Dietician\nHomeopathy & Nutrition",
            registrationNo: "REG-12345",
            signatures: []
          }
        ],
        logoBase64: getBase64("Logo.png"),
        backgroundBase64: getBase64("Background.png"),
      };

      // Build cart URL (skips unresolved variant IDs gracefully)
      mockData.cartUrl = generateCartUrl(mockData.recommendedProducts);
      mockData.cartLink = mockData.cartUrl;

      // Inject the diet plan data
      injectDietPlan(mockData);

      // QR Code
      try {
        mockData.qrCodeData = await QRCode.toDataURL(`https://sehatup.com/verify/${docId}`);
      } catch (_) {}

      // Normalize product fields for V3 template
      mockData.recommendedProducts = mockData.recommendedProducts.map((prod) => {
        let dosage = prod.dosage || ["0", "0", "0", "0"];
        while (dosage.length < 4) dosage.push("0");
        return {
          ...prod,
          dosage,
          dosageType: prod.dosageType || "schedule",
          dosageValue: prod.dosageValue || "",
          dosageFrequency: prod.dosageFrequency || "",
        };
      });

      const { downloadUrl } = await generatePDF(mockData, docId, "prescription");

      res.status(200).send(`
        <!DOCTYPE html><html>
        <head>
          <title>Diet Prescription Test</title>
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Montserrat', sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 40px; border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1); max-width: 520px; width: 90%; }
            h1 { color: #f12f46; margin: 0 0 8px; font-size: 22px; }
            .sub { color: #94a3b8; font-size: 13px; margin-bottom: 8px; }
            .template-badge { background: rgba(241,47,70,0.15); color: #f12f46; border: 1px solid rgba(241,47,70,0.3); padding: 5px 14px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; display: inline-block; margin-bottom: 24px; }
            .plans { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 28px; }
            .plan-link { text-decoration: none; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; transition: all 0.2s; }
            .plan-link:hover { background: rgba(241,47,70,0.15); color: #f12f46; border-color: rgba(241,47,70,0.3); }
            .plan-link.active { background: rgba(241,47,70,0.2); color: #f12f46; border-color: rgba(241,47,70,0.5); }
            .btn-group { display: flex; gap: 12px; justify-content: center; }
            .btn { text-decoration: none; padding: 13px 26px; border-radius: 12px; font-weight: 800; font-size: 13px; border: none; cursor: pointer; }
            .btn-primary { background: #f12f46; color: white; }
            .btn-secondary { background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); }
            .ts { margin-top: 24px; font-size: 10px; color: #475569; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="template-badge">DIET PLAN: ${selectedTemplate.toUpperCase().replace(/_/g, " ")}</div>
            <h1>2-Page Prescription Ready</h1>
            <p class="sub">Page 1: Prescription &nbsp;·&nbsp; Page 2: Diet & Lifestyle Plan</p>
            <div class="plans">
              ${Object.keys(DIET_PLANS).map(k => `
                <a href="?template=${k}" class="plan-link ${k === selectedTemplate ? 'active' : ''}">${k.replace(/_/g, ' ')}</a>
              `).join('')}
            </div>
            <div class="btn-group">
              <a href="${downloadUrl}" target="_blank" class="btn btn-primary">VIEW PDF</a>
              <a href="?template=${selectedTemplate}" class="btn btn-secondary">REGENERATE</a>
            </div>
            <div class="ts">Generated at: ${new Date().toLocaleTimeString()}</div>
          </div>
        </body></html>
      `);
    } catch (error) {
      console.error("[testDietPrescriptionPDF] Error:", error);
      res.status(500).send(`Error: ${error.message}`);
    }
  }
);

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

/* ───────────────────── customer-leads API ───────────────────── */

const CUSTOMER_LEADS_URL = "https://api.sehatup.com/api/customer-leads/";

// Whitelist of fields the customer-leads API accepts. Everything else on the
// submission — rawState, baseUrl, productImage, clinical flags, WhatsApp ids —
// is deliberately dropped. Not every quiz sets every field: the weight quizzes
// add height/weight/targetWeight/bmi, the wellness ones don't.
const LEAD_FIELDS = [
  "answers", "bmi", "concern", "dob", "futureRisks", "healthScore", "height",
  "isWhatsAppSent", "issueTitle", "lifestyleChanges", "lifestyleConditions",
  "pdfGeneratedAt", "peerAverage", "peerComparison", "phone", "possibleCauses",
  "questionnaireId", "recommendedProducts", "reportCategory", "reportDate",
  "reportDownloadUrl", "reportStoragePath", "riskClass", "riskDescription",
  "riskType", "targetWeight", "timeline", "timestamp", "userName", "weight",
];

// Firestore Timestamps aren't JSON-serialisable; the API expects ISO strings.
const toIsoString = (v) => {
  if (!v) return undefined;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return typeof v === "string" ? v : undefined;
};

const buildLeadPayload = (data) => {
  const payload = {};
  for (const key of LEAD_FIELDS) {
    if (data[key] !== undefined) payload[key] = data[key];
  }
  payload.timestamp = toIsoString(data.timestamp) || new Date().toISOString();
  payload.pdfGeneratedAt = toIsoString(data.pdfGeneratedAt) || new Date().toISOString();
  // mens-wellness never sets lifestyleConditions, but the API expects the key.
  if (!Array.isArray(payload.lifestyleConditions)) payload.lifestyleConditions = [];
  return payload;
};

// Posts a completed submission to the leads API. Throws on failure — the caller
// decides whether that is fatal (it isn't, for report generation).
const postCustomerLead = async (data) => {
  const payload = buildLeadPayload(data);
  const res = await axios.post(CUSTOMER_LEADS_URL, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 20000,
  });
  return res.status;
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

    data["baseUrl"] = baseUrl;
    const { phone, userName, healthScore, concern } = data;

    // [Migration Engine] Transfer clinical data from partial_submissions if phone matches
    try {
      const db = getFirestore();
      const partialSnap = await db.collection("partial_submissions")
        .where("phone", "==", phone)
        .limit(1)
        .get();

      if (!partialSnap.empty) {
        const partialDoc = partialSnap.docs[0];
        const partialData = partialDoc.data();
        console.log(`[Migration] Found partial submission for ${phone}. Transferring prescriptions...`);

        // Transfer prescriptions subcollection
        const prescriptionsSnap = await partialDoc.ref.collection("prescriptions").get();
        const transferPromises = prescriptionsSnap.docs.map(pDoc => 
          snapshot.ref.collection("prescriptions").doc(pDoc.id).set(pDoc.data())
        );
        await Promise.all(transferPromises);

        // Merge key clinical flags/notes
        const updates = {};
        if (partialData.isConsulted) updates.isConsulted = true;
        if (partialData.isPurchased) updates.isPurchased = true;
        if (partialData.lastConsultationDiagnosis) updates.lastConsultationDiagnosis = partialData.lastConsultationDiagnosis;
        if (partialData.doctorComments) updates.doctorComments = partialData.doctorComments;
        
        if (Object.keys(updates).length > 0) {
            await snapshot.ref.update(updates);
            // Sync local data object for PDF generation
            Object.assign(data, updates);
        }

        // Atomic cleanup: Delete the partial record
        await partialDoc.ref.delete();
        console.log(`[Migration] Successfully migrated records for ${phone} and deleted partial document.`);
      }
    } catch (migrateErr) {
      console.error("[Migration] Error transferring data:", migrateErr);
    }
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
        image: item.image || `${baseUrl}/PDF-Assets/generic-image.png`,
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
      const riskMetrics = getRiskMetrics(healthScore);
      await snapshot.ref.update({
        ...riskMetrics,
        reportStoragePath: storagePath,
        reportDownloadUrl: downloadUrl,
        pdfGeneratedAt: FieldValue.serverTimestamp(),
        isWhatsAppSent: false,
      });

      console.log(`PDF can be downloaded from: ${downloadUrl}`);

      // Push the completed lead to the customer-leads API. This runs here, and
      // not in the browser, because riskClass/peerComparison/reportDownloadUrl
      // only exist once the block above has run. Non-fatal: a leads-API outage
      // must never block the WhatsApp report.
      try {
        const leadStatus = await postCustomerLead({
          ...data,
          ...riskMetrics,
          reportStoragePath: storagePath,
          reportDownloadUrl: downloadUrl,
          pdfGeneratedAt: new Date(),
          isWhatsAppSent: false,
        });
        console.log(`[Leads] Posted ${docId} to customer-leads (HTTP ${leadStatus})`);
        await snapshot.ref.update({
          leadPostStatus: `ok:${leadStatus}`,
          leadPostedAt: FieldValue.serverTimestamp(),
        });
      } catch (leadError) {
        const detail = leadError.response
          ? `HTTP ${leadError.response.status} ${JSON.stringify(leadError.response.data).slice(0, 300)}`
          : leadError.message;
        console.error(`[Leads] Failed to post ${docId}: ${detail}`);
        await snapshot.ref.update({
          leadPostStatus: `error: ${detail}`.slice(0, 400),
          leadPostedAt: FieldValue.serverTimestamp(),
        }).catch(() => { });
      }

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

    // Inject structured diet plan template if selected
    injectDietPlan(data);

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

      // Inject structured diet plan template if selected
      injectDietPlan(data);

      console.log(`[HTTP PDF] Guidelines count: ${data.guidelines.length}, hasDietPlan: ${data.hasDietPlan}`);

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
    let requestedDocId = null;

    try {
      const activeReq = await db.collection("active_whatsapp_requests").doc(phone).get();
      if (activeReq.exists) {
        const reqData = activeReq.data();
        if (reqData.timestamp) {
          const diffMs = Date.now() - reqData.timestamp.toMillis();
          // Valid for 10 minutes (600,000 ms)
          if (diffMs < 600000) {
            requestedDocId = reqData.docId;
            console.log(`Found active specific WhatsApp request for docId: ${requestedDocId}`);
          }
        }
        // Consume the request so it isn't reused indefinitely
        await activeReq.ref.delete();
      }
    } catch (e) {
      console.log("Error checking active_whatsapp_requests:", e);
    }

    let userDocSnapshot;
    
    if (requestedDocId) {
      const specificDoc = await db.collection("questionnaire_submissions").doc(requestedDocId).get();
      if (specificDoc.exists) {
        userDocSnapshot = { empty: false, docs: [specificDoc] };
      } else {
        userDocSnapshot = { empty: true };
      }
    } else {
      userDocSnapshot = await db
        .collection("questionnaire_submissions")
        .where("phone", "==", phone)
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();
    }

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
    const { phone, otp, docId } = req.body;
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
        if (docId) {
          const db = getFirestore();
          await db.collection("active_whatsapp_requests").doc(phone).set({
            docId: docId,
            timestamp: FieldValue.serverTimestamp()
          });
        }
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

// NOTE: The Nimbus shipment callables (nimbusLogin / getShipmentTracking / listShipments /
// getShipmentAnalytics / getNdrShipments) were removed — they powered the old "pull from
// Nimbus" dashboard, which is dead. Live tracking now arrives via Nimbus's webhook →
// the Vercel route /api/nimbus-webhook → Firestore `nimbus_tracking`, read by the CRM.

// ─── Delete a user from Firebase Authentication (admin-only) ─────────────────
// Callable from the client via httpsCallable(functions, "deleteAuthUser").
// The client SDK can't delete arbitrary Auth accounts, so the admin calls this.
// It verifies the caller is an admin, deletes the Auth account, and (best-effort)
// cleans up the matching Firestore users/{uid} doc + permissions so nothing is orphaned.
exports.deleteAuthUser = onCall({ region: "us-central1" }, async (request) => {
  // 1) Must be signed in.
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const callerUid = request.auth.uid;

  // 2) Caller must have the 'admin' role (checked against their Firestore profile).
  const db = getFirestore();
  const callerSnap = await db.collection("users").doc(callerUid).get();
  const callerRoles = callerSnap.exists
    ? [...(Array.isArray(callerSnap.data().roles) ? callerSnap.data().roles : []),
       ...(callerSnap.data().role ? [callerSnap.data().role] : [])]
    : [];
  if (!callerRoles.map((r) => String(r).toLowerCase()).includes("admin")) {
    throw new HttpsError("permission-denied", "Only admins can delete users.");
  }

  // 3) Validate target.
  const uid = (request.data && request.data.uid ? String(request.data.uid) : "").trim();
  if (!uid) {
    throw new HttpsError("invalid-argument", "A target user uid is required.");
  }
  if (uid === callerUid) {
    throw new HttpsError("failed-precondition", "You cannot delete your own account.");
  }

  // 4) Delete the Auth account.
  try {
    await getAuth().deleteUser(uid);
    console.log(`[deleteAuthUser] Auth account ${uid} deleted by ${callerUid}`);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      // No Auth account — fall through to clean up any leftover Firestore record.
      console.warn(`[deleteAuthUser] No Auth account for ${uid}; cleaning Firestore only.`);
    } else {
      console.error(`[deleteAuthUser] Auth delete failed for ${uid}:`, err);
      throw new HttpsError("internal", `Failed to delete Auth account: ${err.message}`);
    }
  }

  // 5) Best-effort Firestore cleanup (never fails the call).
  try {
    await db.collection("users").doc(uid).collection("permissions").doc("settings").delete();
    await db.collection("users").doc(uid).delete();
  } catch (cleanupErr) {
    console.warn(`[deleteAuthUser] Firestore cleanup warning for ${uid}:`, cleanupErr.message);
  }

  return { success: true, uid };
});

// ─── WhatsApp inbox (QuickReply.ai) ──────────────────────────────────────────
// Conversations + messages are mirrored into Firestore so the CRM can render a live
// WhatsApp inbox. QuickReply is just the gateway: it POSTs inbound messages and
// delivery statuses to the two webhooks below, and we POST outbound agent messages to
// its send-session-message API. Credentials come from QUICKREPLY_CLIENT_ID/SECRET_KEY
// (already used elsewhere). Set QUICKREPLY_WEBHOOK_TOKEN to harden the webhook URLs.
const QR_SEND_URL = "https://app.quickreply.ai/api/whatsapp/send-session-message";
// Conversation doc id = digits of the E.164 phone (Firestore-id safe; '+' dropped).
const qrConvId = (phone) => String(phone || "").replace(/[^0-9]/g, "");
const qrPreviewText = (payload = {}) => {
  switch (payload._type) {
    case "USER_TEXT": return payload.text || "";
    case "USER_FILE": return payload.caption || `[${payload.contentType || "file"}]`;
    case "USER_LIST_REPLY":
    case "USER_BUTTON_REPLY": return payload.text || payload.title || "[reply]";
    default: return payload.text || payload.caption || "";
  }
};

// Single webhook → give THIS one URL to QuickReply. It handles BOTH:
//   • inbound user messages (these carry a `payload` with a `_type`), and
//   • message delivery-status updates (SENT/DELIVERED/READ, no payload).
// We classify by the PRESENCE OF A PAYLOAD — a real chat message always has one.
// (Status callbacks carry the state in `event`/`status`/`state` depending on the
// account; classifying on payload-presence avoids storing them as blank messages.)
exports.qrReceiveMessage = onRequest({ region: "us-central1" }, async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    const expected = process.env.QUICKREPLY_WEBHOOK_TOKEN;
    if (expected && req.query.token !== expected) {
      console.warn("[qr-webhook] Rejected — bad/missing token");
      return res.status(401).send("Unauthorized");
    }
    const b = req.body || {};
    const db = getFirestore();
    const p = b.payload;

    // ── TEMP discovery logging: capture the full HTTP envelope QuickReply sends so we can
    //    document the exact payload format (for rebuilding the flow in n8n). Logs the
    //    method, content-type, query, headers and the complete raw body for EVERY request
    //    — inbound chat messages and status callbacks alike. Remove (or trim) once the
    //    format is documented; the raw body contains WhatsApp message text / PII. ──
    console.log("[qr-webhook] ───── incoming request ─────");
    console.log("[qr-webhook] method:", req.method, "content-type:", req.get("content-type"));
    console.log("[qr-webhook] query:", JSON.stringify(req.query || {}));
    console.log("[qr-webhook] headers:", JSON.stringify(req.headers || {}));
    console.log("[qr-webhook] body:", JSON.stringify(b));
    // Classify so you can grep one log line per request type in Cloud Logging:
    //   payload present  → inbound user message (and its _type tells the message kind)
    //   no payload       → status callback (SENT / DELIVERED / READ), keyed by event
    console.log(
      "[qr-webhook] kind:",
      p ? `INBOUND _type=${p._type || "?"}` : `STATUS event=${String(b.event || b.status || b.state || "?").toUpperCase()} messageBy=${b.messageBy || "?"}`,
      "phone:", b.phone || "?",
      "id:", b.id || "?",
    );

    // ── Not an inbound chat message (no payload) → it's a status callback (SENT/
    //    DELIVERED/READ). QuickReply never sends us the TEXT of bot/agent replies, only
    //    these status events. So we use them two ways:
    //      1) if the message is one we already have → just update its delivery status;
    //      2) if it's a brand-new outbound message sent from QuickReply's side
    //         (messageBy AGENT or AUTOMATION) → store a placeholder "Agent/Bot replied"
    //         bubble so the CRM at least reflects that a reply went out (no content). ──
    if (!p || !p._type) {
      const ev = String(b.event || b.status || b.state || "").toUpperCase();
      if (b.id && b.phone) {
        const convId = qrConvId(b.phone);
        const convRef = db.collection("conversations").doc(convId);
        const msgRef = convRef.collection("messages").doc(String(b.id));
        const msgSnap = await msgRef.get();

        if (msgSnap.exists) {
          // We already stored this message (e.g. one sent from the CRM, or a prior
          // status for this same id) → just refresh its delivery status + sender meta.
          //
          // IMPORTANT: if we wrote the doc ourselves it carries senderKind ('AI' from
          // n8n's "Record AI Sent", 'HUMAN' from qrSendMessage below) and we must NOT
          // touch messageBy/agentId. QuickReply reports every outbound as
          // messageBy: "AGENT" with the shared API account's agentId, so copying those
          // in overwrites the only record of who actually sent it — and then the n8n
          // handoff check cannot tell a human agent's reply from the bot's own, so the
          // bot talks straight over the agent.
          if (ev) {
            const known = !!(msgSnap.data() || {}).senderKind;
            await msgRef.update({
              status: ev,
              statusUpdatedAt: FieldValue.serverTimestamp(),
              ...(!known && b.messageBy ? { messageBy: b.messageBy } : {}),
              ...(!known && b.agentId ? { agentId: b.agentId } : {}),
              ...(b.automationBy ? { automationBy: b.automationBy } : {}),
              ...(known && b.agentId ? { qrAgentId: b.agentId } : {}),
            }).catch(() => { /* race on a just-deleted doc — ignore */ });
          }
        } else if (ev === "SENT" && (b.messageBy === "AGENT" || b.messageBy === "AUTOMATION")) {
          // Outbound reply sent from QuickReply (human agent in their dashboard, or the
          // AI bot). We can't get the words — store a labelled placeholder so the thread
          // shows that a reply happened. Keyed by id, so DELIVERED/READ just merge in.
          // IMPORTANT: only create on the SENT event. QuickReply's status callbacks carry
          // no timestamp, so we stamp the placeholder with arrival time — and SENT arrives
          // at ~real send time. DELIVERED/READ arrive later (READ fires when the user
          // re-opens the chat), so creating from those would stamp the reply too late and
          // sort it BELOW newer customer messages (the bug we saw). Skipping them for
          // creation keeps the bot/agent bubble in its correct position in the thread.
          // No senderKind here on purpose: this branch fires for a human agent replying
          // in the QuickReply dashboard AND (as a race) for the AI's own reply when the
          // SENT callback beats n8n's "Save AI Message" write. The two are only
          // distinguishable by agentId, which is what n8n's AI_AGENT_IDS check uses.
          const isAgent = b.messageBy === "AGENT";
          const label = isAgent ? "Agent replied" : "Bot replied";
          const msgTime = Number(b.msg_time) || Date.now();
          await msgRef.set({
            id: String(b.id),
            direction: "out",
            _type: isAgent ? "AGENT_PLACEHOLDER" : "BOT_PLACEHOLDER",
            text: "",                 // QuickReply does not give us the content
            placeholder: label,       // frontend renders this italic label
            messageBy: b.messageBy,
            agentId: b.agentId || null,
            automationBy: b.automationBy || null,
            status: ev || "SENT",
            statusUpdatedAt: FieldValue.serverTimestamp(),
            msgTime,
            createdAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          // Surface on the conversation list; outbound, so do NOT bump unread. Persist the
          // phone (and name if QuickReply included it) so bot-first chats aren't identity-less.
          await convRef.set({
            phone: b.phone,
            ...(b.name ? { name: b.name } : {}),
            lastMessage: isAgent ? "👤 Agent replied" : "🤖 Bot replied",
            lastMessageAt: msgTime,
            lastMessageBy: b.messageBy,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true }).catch(() => {});
        }
        // else: status for an id we don't have and not clearly bot/agent → ignore.
      }
      return res.status(200).send("status-or-ignored");
    }

    // ── Inbound user message (payload present) ──
    if (!b.phone || !b.id) return res.status(200).send("ignored"); // ack so QR doesn't retry
    const convId = qrConvId(b.phone);
    const msgTime = Number(b.msg_time) || Date.now();
    const convRef = db.collection("conversations").doc(convId);
    const convSnap = await convRef.get();

    const conv = {
      phone: b.phone,
      lastMessage: qrPreviewText(p),
      lastMessageAt: msgTime,
      lastMessageBy: "USER",
      // WhatsApp's 24h customer-care window resets on every inbound message.
      windowExpiresAt: msgTime + 24 * 60 * 60 * 1000,
      status: "open",
      unreadCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (b.name) conv.name = b.name;
    if (b.email) conv.email = b.email;
    if (!convSnap.exists) { conv.createdAt = FieldValue.serverTimestamp(); conv.assignedTo = null; }
    await convRef.set(conv, { merge: true });

    await convRef.collection("messages").doc(String(b.id)).set({
      id: String(b.id),
      direction: "in",
      _type: p._type || "USER_TEXT",
      // text covers plain text + the selected option text for list/button replies
      text: p.text || p.caption || p.title || "",
      mediaUrl: p.path || null,
      mediaType: p.contentType || null,
      fileName: p.name || null,
      caption: p.caption || null,
      replyTo: b.reply_to || null,
      preview: p.preview || null,
      messageBy: "USER",
      status: "DELIVERED",
      msgTime,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).send("ok");
  } catch (err) {
    console.error("[qr-webhook] error:", err);
    return res.status(200).send("error-logged"); // ack anyway; logged for debugging
  }
});

// Callable → CRM composer. Sends a text as an agent within the 24h session window.
exports.qrSendMessage = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth || !request.auth.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const callerUid = request.auth.uid;
  const db = getFirestore();

  // Role gate: messaging is for telesales / operations / admin (+ legacy aliases).
  const callerSnap = await db.collection("users").doc(callerUid).get();
  const roles = callerSnap.exists
    ? [...(Array.isArray(callerSnap.data().roles) ? callerSnap.data().roles : []),
       ...(callerSnap.data().role ? [callerSnap.data().role] : [])].map((r) => String(r).toLowerCase())
    : [];
  const allowedRoles = ["telesales", "operations", "admin", "shipment_tracker", "order_creator", "logistics"];
  if (!roles.some((r) => allowedRoles.includes(r))) {
    throw new HttpsError("permission-denied", "You don't have access to messaging.");
  }

  const to = (request.data && request.data.to ? String(request.data.to) : "").trim();
  const text = (request.data && request.data.text ? String(request.data.text) : "").trim();
  if (!to) throw new HttpsError("invalid-argument", "Recipient phone is required.");
  if (!text) throw new HttpsError("invalid-argument", "Message text is required.");

  const convRef = db.collection("conversations").doc(qrConvId(to));
  const convSnap = await convRef.get();
  // 24h window: WhatsApp only allows free-form replies within 24h of the user's last
  // message; outside that a pre-approved template is required (not supported in v1).
  const windowExpiresAt = convSnap.exists ? convSnap.data().windowExpiresAt : 0;
  if (!windowExpiresAt || windowExpiresAt < Date.now()) {
    throw new HttpsError("failed-precondition", "The 24-hour reply window has expired — a template message is required (not supported yet).");
  }

  const clientId = process.env.QUICKREPLY_CLIENT_ID;
  const secretKey = process.env.QUICKREPLY_SECRET_KEY;
  if (!clientId || !secretKey) throw new HttpsError("failed-precondition", "QuickReply credentials are not configured.");

  let resp;
  try {
    resp = await axios.post(QR_SEND_URL, {
      to,
      payload: { _type: "AGENT_TEXT", text },
    }, { headers: { "client-id": clientId, "secret-key": secretKey, "Content-Type": "application/json" } });
  } catch (err) {
    const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    console.error("[qrSendMessage] QuickReply error:", detail);
    throw new HttpsError("internal", `QuickReply send failed: ${detail}`);
  }

  const data = resp.data || {};
  if (data.state && data.state !== "SENT") {
    throw new HttpsError("internal", `Message not sent: ${data.reason || data.state}`);
  }

  const now = Date.now();
  const msgId = data.id || `local_${now}_${Math.floor(Math.random() * 1e6)}`;
  await convRef.collection("messages").doc(String(msgId)).set({
    id: String(msgId),
    direction: "out",
    _type: "AGENT_TEXT",
    text,
    // A CRM reply is byte-for-byte shaped like one of the bot's own replies (out +
    // AGENT_TEXT + text), and QuickReply's status callback then rewrites messageBy to
    // "AGENT" and agentId to the shared API account for BOTH. senderKind is the durable
    // marker the n8n "Decide Process" handoff check reads to pause the bot — without it
    // the bot reads this message as one of its own and keeps replying over the agent.
    senderKind: "HUMAN",
    messageBy: "AGENT",
    agentId: callerUid,
    status: data.state || "SENT",
    msgTime: now,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await convRef.set({
    lastMessage: text,
    lastMessageAt: now,
    lastMessageBy: "AGENT",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { success: true, id: msgId, state: data.state || "SENT" };
});

// ── Customer / order context for the WhatsApp bot ────────────────────────────
// n8n calls this once per inbound message, right before it builds the Gemini prompt, so
// Ananya can answer "mera order kaha hai" from real data instead of guessing. Shopify is
// the source of truth for order + delivery status.
//
// It returns a pre-rendered `summary` string (not just raw JSON) on purpose: the wording
// of the facts is a place bugs hide, so it lives here where it can be logged and changed
// without touching the n8n Code node.
//
// GET /qrCustomerContext?phone=%2B917300978845&token=...   [&fresh=1]
const SHOPIFY_HOST = process.env.SHOPIFY_HOST || "0ec320-gj.myshopify.com";
const SHOPIFY_VERSION = process.env.SHOPIFY_VERSION || "2024-01";
const QR_CTX_TTL_MS = 10 * 60 * 1000;   // Shopify REST allows ~2 req/s; cache per phone.

async function shopifyGet(pathname) {
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) throw new Error("SHOPIFY_ACCESS_TOKEN is not configured");
  const r = await axios.get(`https://${SHOPIFY_HOST}/admin/api/${SHOPIFY_VERSION}${pathname}`, {
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    timeout: 10000,
  });
  return r.data || {};
}

// Shopify stores Indian numbers inconsistently (+917300978845 / 917300978845 /
// 7300978845 / spaced), and its search does not support a leading wildcard — so try the
// realistic forms in order rather than one "clever" query.
async function shopifyFindCustomerByPhone(p10) {
  const queries = [`phone:"+91${p10}"`, `phone:"91${p10}"`, `phone:"${p10}"`, p10];
  for (const q of queries) {
    try {
      const d = await shopifyGet(`/customers/search.json?query=${encodeURIComponent(q)}&limit=5`);
      const list = d.customers || [];
      // Confirm on the digits, never on Shopify's fuzzy match: a broad `p10` query can
      // return near-misses, and answering about someone else's order is far worse than
      // answering "let me check".
      const hit = list.find((c) => {
        const cand = [c.phone, ...(c.addresses || []).map((a) => a && a.phone)];
        return cand.some((v) => String(v || "").replace(/\D/g, "").slice(-10) === p10);
      });
      if (hit) return hit;
    } catch (e) {
      console.warn("[qrCustomerContext] customer search failed for", q, e.message);
    }
  }
  return null;
}

// Shopify has no delivery ETA, so this label is the whole truth we can offer.
function qrOrderStatusLabel(o) {
  if (o.cancelled_at) return "Cancelled";
  const fs = (o.fulfillment_status || "").toLowerCase();
  const ships = (o.fulfillments || [])
    .map((f) => String(f.shipment_status || "").toLowerCase())
    .filter(Boolean);
  const s = ships[ships.length - 1] || "";
  if (s === "delivered") return "Delivered";
  if (s === "out_for_delivery") return "Out for delivery";
  if (s === "attempted_delivery") return "Delivery attempted, not delivered";
  if (s === "failure") return "Delivery failed";
  if (s === "in_transit" || s === "confirmed" || s === "label_printed" || s === "label_purchased") return "In transit";
  if (fs === "fulfilled") return "Shipped";
  if (fs === "partial") return "Partly shipped";
  if (fs === "restocked") return "Returned/restocked";
  return "Order placed, not shipped yet";
}

// Shopify product titles carry the store's SEO suffix ("… - 20g | SehatUP"). Two reasons
// to strip it: it reads like a webpage when Ananya says it out loud, and the pipe collides
// with the field separator in the summary, so the model cannot see where `items` ends.
function qrCleanTitle(t) {
  return String(t || "")
    .replace(/\s*\|\s*sehat\s*up\s*$/i, "")
    .replace(/\s*\|\s*/g, " - ")
    .trim();
}

// Shopify's financial_status is internal vocabulary. "voided" on a cancelled order is
// noise at best and alarming at worst, so cancelled orders report no payment state.
function qrPaymentLabel(o) {
  if (o.cancelled_at) return "";
  switch (String(o.financial_status || "").toLowerCase()) {
    case "paid": return "paid";
    case "pending": return "payment pending";
    case "partially_paid": return "partly paid";
    case "refunded": return "refunded";
    case "partially_refunded": return "partly refunded";
    case "authorized": return "payment authorized";
    default: return "";
  }
}

function qrCompactOrder(o) {
  const f = (o.fulfillments || [])[(o.fulfillments || []).length - 1] || {};
  const gateways = (o.payment_gateway_names || []).join(", ");
  return {
    name: o.name || (o.order_number != null ? `#${o.order_number}` : ""),
    placedAt: o.created_at || null,
    status: qrOrderStatusLabel(o),
    cancelled: !!o.cancelled_at,
    total: Math.round(Number(o.total_price) || 0),
    paymentStatus: qrPaymentLabel(o),
    cod: /cash on delivery|\bcod\b/i.test(gateways),
    items: (o.line_items || []).map((li) => `${qrCleanTitle(li.title)}${li.quantity > 1 ? ` x${li.quantity}` : ""}`),
    courier: f.tracking_company || "",
    trackingNumber: f.tracking_number || "",
    trackingUrl: f.tracking_url || "",
  };
}

// Choose which of a customer's orders the bot gets to see. Newest-first, but the newest
// non-cancelled orders are GUARANTEED a place. A flat "newest 5" looks right and fails
// badly: an account whose five newest orders are all cancelled would tell the bot nothing
// about the live order the customer is actually asking about.
function qrPickOrders(all, liveMin = 3, max = 5) {
  const newestFirst = (a, b) => new Date(b.placedAt || 0) - new Date(a.placedAt || 0);
  const sorted = [...all].sort(newestFirst);
  const picked = sorted.filter((o) => !o.cancelled).slice(0, liveMin);
  for (const o of sorted) { if (picked.length >= max) break; if (!picked.includes(o)) picked.push(o); }
  return picked.sort(newestFirst);
}

exports.qrCustomerContext = onRequest(
  { region: "us-central1", timeoutSeconds: 30, memory: "256MiB" },
  async (req, res) => {
    // Never fail the caller: n8n runs this inline in the reply path, so an error here
    // must degrade to "no data" (the bot then says the team will check) rather than
    // block the reply.
    const out = { found: false, orderCount: 0, orders: [], summary: "", source: "none", report: { found: false } };
    try {
      const expected = process.env.QR_CONTEXT_TOKEN || process.env.QUICKREPLY_WEBHOOK_TOKEN;
      const given = req.query.token || (req.body && req.body.token);
      if (expected && given !== expected) return res.status(401).json({ ...out, error: "unauthorized" });

      const rawPhone = String(req.query.phone || (req.body && req.body.phone) || "").trim();
      const p10 = rawPhone.replace(/\D/g, "").slice(-10);
      if (p10.length !== 10) return res.status(200).json({ ...out, error: "invalid phone" });
      out.phone = rawPhone;

      const db = getFirestore();
      const cacheRef = db.collection("qr_context_cache").doc(p10);

      // ---- Latest health-report submission ----------------------------------------
      // "Hi I need help regarding my health report" almost always means: they finished the
      // questionnaire but never pressed "Get My Report on WhatsApp" on the last page, so it
      // was never delivered. The report itself exists either way - the submission is written
      // on completion and CreatePDFOnFormSubmission fills reportDownloadUrl from a trigger,
      // neither of which depends on the button. So this is a lookup, not a regeneration.
      // Wrapped separately: a missing composite index here must not break order context.
      try {
        const rs = await db.collection("questionnaire_submissions")
          .where("phone", "==", p10).orderBy("timestamp", "desc").limit(1).get();
        if (!rs.empty) {
          const d = rs.docs[0].data() || {};
          const ts = d.timestamp && d.timestamp.toMillis ? d.timestamp.toMillis() : null;
          out.report = {
            found: true,
            url: d.reportDownloadUrl || "",
            generating: !d.reportDownloadUrl,     // PDF trigger has not finished yet
            name: d.userName || "",
            submittedAt: ts,
            deliveredOnWhatsApp: !!d.isWhatsAppSent,
          };
        } else {
          out.report = { found: false };
        }
      } catch (e) {
        console.warn("[qrCustomerContext] report lookup failed:", e.message);
        out.report = { found: false, error: e.message };
      }

      // The cache exists for Shopify's ~2 req/s REST limit, so ONLY the Shopify half is
      // cached. The report is deliberately checked on every call and merged over the cached
      // payload: someone finishes the questionnaire and messages within seconds, and a
      // 10-minute-old "no report" would tell them they never filled it in.
      if (!req.query.fresh) {
        const snap = await cacheRef.get().catch(() => null);
        const c = snap && snap.exists ? snap.data() : null;
        if (c && c.at && Date.now() - c.at < QR_CTX_TTL_MS && c.payload) {
          return res.status(200).json({ ...JSON.parse(c.payload), report: out.report, source: "cache" });
        }
      }

      const customer = await shopifyFindCustomerByPhone(p10);
      if (!customer) {
        out.source = "shopify";
        out.summary = "";
        await cacheRef.set({ at: Date.now(), payload: JSON.stringify(out) }, { merge: true }).catch(() => {});
        console.log("[qrCustomerContext]", p10, "-> no Shopify customer");
        return res.status(200).json(out);
      }

      const od = await shopifyGet(`/customers/${customer.id}/orders.json?status=any&limit=25`);
      const all = (od.orders || [])
        .map(qrCompactOrder)
        .sort((a, b) => new Date(b.placedAt || 0) - new Date(a.placedAt || 0));

      const orders = qrPickOrders(all);
      const cancelledCount = all.filter((o) => o.cancelled).length;

      out.found = orders.length > 0;
      out.source = "shopify";
      out.customerName = customer.first_name || customer.last_name
        ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim()
        : "";
      out.orderCount = Number(customer.orders_count) || orders.length;
      out.orders = orders;

      if (orders.length) {
        const fmt = (iso) => {
          if (!iso) return "unknown date";
          const d = new Date(iso);
          return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
        };
        // Fields are separated by " · ", never "|" — product titles contain pipes.
        const lines = orders.map((o) => {
          const bits = [
            `${o.name || "(no number)"} placed ${fmt(o.placedAt)}`,
            o.status,
            `Rs${o.total} ${o.cod ? "COD" : "prepaid"}${o.paymentStatus ? `, ${o.paymentStatus}` : ""}`,
            `items: ${o.items.join(", ") || "n/a"}`,
          ];
          if (o.courier || o.trackingNumber) bits.push(`courier: ${o.courier || "n/a"}${o.trackingNumber ? `, AWB ${o.trackingNumber}` : ""}`);
          return `- ${bits.join(" · ")}`;
        });
        const shown = orders.length === out.orderCount
          ? `All ${out.orderCount} orders`
          : `Showing ${orders.length} of ${out.orderCount} orders`;
        out.summary = `${shown} for this customer, most recent first`
          + `${cancelledCount ? ` (${cancelledCount} of their orders are cancelled)` : ""}:\n`
          + `${lines.join("\n")}\n`
          + "No delivery date/ETA exists in our system for any order, and orders not listed above are not visible to you.";
      }

      await cacheRef.set({ at: Date.now(), payload: JSON.stringify(out) }, { merge: true }).catch(() => {});
      console.log("[qrCustomerContext]", p10, "->", orders.length, "orders |", orders.map((o) => `${o.name}:${o.status}`).join(", "));
      return res.status(200).json(out);
    } catch (err) {
      console.error("[qrCustomerContext] failed:", err.message);
      return res.status(200).json({ ...out, error: err.message });
    }
  },
);

// ── Product / price lookup for the WhatsApp bot ──────────────────────────────
// Ananya used to read prices from a hardcoded CATALOG block in the Google Doc, so every
// Shopify price change silently made her wrong. This fetches the live catalog instead.
//
// Why the whole catalog is cached and matched HERE instead of querying Shopify per message:
// Shopify's product search is a prefix search, so "shiljit" / "vajji bati" / "harmen tea"
// — exactly how customers type — match nothing. The catalog is small (tens of products), so
// we pull it once, cache it, and do the fuzzy matching locally where misspellings can be
// handled properly.
//
// GET /qrProductLookup?text=vajji%20bati%20price&token=...   [&fresh=1]
const QR_CATALOG_TTL_MS = 60 * 60 * 1000;
const QR_STORE_URL = process.env.SEHATUP_STORE_URL || "https://sehatup.com";

// Rx status is a SehatUP safety rule, NOT a Shopify field — it cannot be looked up, so it
// lives here. Getting this wrong means handing a customer a link to a prescription drug,
// which is the worst thing this endpoint could do. Matched against the product title.
// The branded kits below all ship an allopathic tablet inside, which is why they are listed
// by brand name and not by drug — the drug never appears in their Shopify title.
//
// "Confidence & Performance Booster Kit" was REMOVED from this list 2026-08-03. It is the
// Vaji Bati + Kern Drop kit (handle `p-e-e-d-integrated-kit`, product photos literally
// Vaji_Bati_Kern_Drop.webp) and ships no tablet — Vaji Bati is Ayurvedic and Kern Drops is
// homoeopathic, and both are sold individually with a price and a link. Being on this list
// made the bot refuse to price or link a Rs1099 OTC product, AND suppressed its description
// entirely (qrCondenseDescription returns '' for Rx), so it could not even be explained.
// The three sibling combos that DO carry a drug are caught by /tadalafil/ and /dapoxetine/
// via their own titles, so removing this pattern does not weaken them.
const QR_RX_PATTERNS = [
  /tadalafil/i, /dapoxetine/i, /orlistat/i, /sildenafil/i,
  /\bendless\b/i, /\bhard\s*(5|10)\b/i, /\bmighty\b/i, /boombatti/i,
  /control\s*tantra/i, /four\s*play/i, /hard\s*yatra/i, /max\s*drive/i,
  /rocket\s*ras/i, /lovelinga/i, /thrill\s*drill/i, /thrust\s*rx/i,
];
const qrIsRx = (title) => QR_RX_PATTERNS.some((re) => re.test(String(title || "")));

// How customers actually spell these on WhatsApp. Applied to the whole normalised string
// before tokenising, so multi-word aliases ("blue tea" -> hormoniherb) work too.
const QR_ALIAS_PHRASES = [
  [/\bshil?a?j(i|ee|e)?t\w*\b/g, "shilajit"],
  [/\bsilaj\w*\b/g, "shilajit"],
  [/\bvaj+i?j?\w*\b/g, "vaji"],
  [/\bbatti\b/g, "bati"],
  [/\bharmen\w*\b/g, "her menses"],
  [/\bher\s*mens\w*\b/g, "her menses"],
  [/\b(blue|period|periods)\s*tea\b/g, "hormoniherb"],
  [/\bhormoni\w*\b/g, "hormoniherb"],
  [/\bashwa\w*\b/g, "ashwagandha"],
  [/\bgarc(i|e)n\w*\b/g, "garcinia"],
  [/\bthyro\w*\b/g, "thyrostatin"],
  [/\bdiab\w*\b/g, "diaboglob"],
  [/\balo+e?zy?\b/g, "aloezy"],
  [/\bd3\s*k2\b/g, "zencal"],
  [/\bvitamin\s*d\b/g, "zencal"],
  // NOT `kern -> "kern drops"`. That alias INJECTED the generic word "drops" into every
  // query mentioning Kern, and "drops" then scored a full exact-word hit against Garcinia
  // Cambogia Drops. "kern drop chahiye" returned Garcinia as the second option, and
  // "vaji bati kern drops" pushed Vaji Bati out of the top two entirely. The alias was never
  // needed: "kern" already scores 1.0 against the title "Kern Drops" on its own.
  [/\blean\s*rout\w*\b/g, "leanroutine"],
  [/\bslim\s*tox\b/g, "slimtox"],
  [/\bhoney\s*stick\w*\b/g, "shilajit honey sticks"],
];

// Words that describe the FORM of a product, not which product it is. Every one of them
// appears in more than one Shopify title, so an exact hit on one carries no information -
// "drops" alone cannot tell Kern Drops from Garcinia Cambogia Drops. They still contribute
// to the averaged score (a query that matches the form as well as the name should rank
// higher), they just may never earn the "one distinctive word matched" boost in
// qrMatchScore, which is what let a form word masquerade as a product name.
// A second group, for the same reason but a different failure. Shopify titles carry marketing
// tails - "No more tricks & just kick", "Your All in One Tea", "Best intimate wash" - and a
// generic adjective inside one of them is not a product name either. "best"/"pure"/"daily"
// identify nothing; they only describe.
const QR_WEAK_MATCH_WORDS = new Set([
  "drops", "drop", "tablet", "tablets", "capsule", "capsules", "tea", "kit", "kits",
  "powder", "oil", "syrup", "resin", "sachet", "wash", "booster", "formula", "support",
  "best", "pure", "natural", "daily", "just", "free", "sample",
]);

// Conditions customers name INSTEAD of a product. "PCOD" appears in no Shopify title, so the
// fuzzy matcher scores it 0 against all 32 products - the single condition SehatUP treats most
// produced no product context at all.
//
// Mapped to HANDLES, never as a text alias. Rewriting the query is exactly what the old
// `kern -> "kern drops"` alias did (see QR_ALIAS_PHRASES): it injected a generic word that
// then out-scored the product the customer had actually named.
//
// The benefit wording here is the Google Doc's own CATALOG mapping, not a new medical claim.
const QR_CONDITION_PRODUCTS = [
  {
    re: /\b(pcod|pcos|poly\s*cystic|period|periods|menses|menstrual|hormonal|hormone|cramps)\b/,
    handles: ["her-menses", "hormoniherb"],
  },
];

// ...but ONLY when they are asking for something to take. Naming a condition is not a request
// for a product: persona rule 3 requires the safety check and the free-consultation offer
// FIRST, and "mujhe PCOD hai" is a disclosure, not a purchase intent. Putting two priced
// products into the prompt for it invites exactly the pitch rule 3 forbids - the same failure
// the order block hit, where five cancelled orders in the prompt got latched onto and answered
// a question nobody asked.
// So "mujhe PCOD hai" still resolves to no match, and "PCOD ke liye kaunsa product lu" does not.
const QR_CONDITION_INTENT =
  /\b(product|medicine|dawa|dawai|tablet|goli|capsule|kit|tea|churna|powder|syrup|drops?|ilaj|treatment|cure|upay|upchar|solution|chahiye|chaiye|recommend|suggest|kaunsa|konsa|kaun\s*sa|link|price|rate|lena|lu|lenge|de\s*do|dijiye|bhejo)\b/;

// Kits customers ask for by their CONTENTS, not by their name. Nobody types "Confidence &
// Performance Booster Kit"; they type "vaji bati kern drop combo". The kit therefore scored
// 0 against the words its own buyers use and could never be sold.
//
// Feeding the component names into the fuzzy matcher as title aliases was tried first and
// backfired badly: the kit then matched "vaji bati" on its own and OUTRANKED Vaji Bati
// itself, so every single-product question started returning the Rs1099 kit. Kit matching is
// therefore explicit, not fuzzy - a kit is offered only when the customer named every
// component, or named one component together with a combo word.
const QR_KITS = [
  { handle: "p-e-e-d-integrated-kit", parts: [/\bvaji\b/, /\bkern\b/] },
];
const QR_COMBO_WORDS = /\b(combo|kit|dono|donon|both|sath|saath|together|pack|package|set)\b/;

// Handles of the kits this query is actually asking for.
function qrKitHandles(text) {
  const q = qrNormalise(text);
  if (!q) return [];
  const wantsCombo = QR_COMBO_WORDS.test(q);
  return QR_KITS
    .filter((k) => {
      const hits = k.parts.filter((re) => re.test(q)).length;
      return hits === k.parts.length || (hits >= 1 && wantsCombo);
    })
    .map((k) => k.handle);
}

// Words that carry no product signal — without stripping these, "mujhe price batao"
// scores against every product that happens to share a stray letter.
// Conversational filler belongs here too, and its absence was a live bug: "Hello! Can I get
// more info for PCOD/PCOS?" put an OUT-OF-STOCK Rx MEN'S product (Hard Yatra, Rs1999) into a
// women's-health chat. The culprit was the word "more", which is an exact token hit on the
// title "No more tricks & just kick" and so earned the full 0.85 "one distinctive word"
// boost in qrMatchScore. A word that is common in English is not a product name, however
// rare it happens to be inside the catalog - so document frequency would not have caught it
// either. It has to be listed.
const QR_STOPWORDS = new Set([
  "price", "rate", "kitne", "kitna", "ka", "ki", "ke", "hai", "he", "batao", "bata",
  "do", "dijiye", "mujhe", "me", "chahiye", "chaiye", "kya", "aur", "and", "the", "of",
  "for", "cost", "kimat", "keemat", "rs", "rupees", "rupaye", "please", "plz", "ek",
  "kitni", "much", "how", "what", "is", "send", "bhejo", "bhej", "order", "karna", "karo",
  "hello", "hi", "hey", "can", "could", "get", "more", "info", "information", "about",
  "know", "need", "want", "tell", "help", "give", "some", "any", "your", "my", "regarding",
  "detail", "details", "jankari", "sawaal", "bataye", "bataiye", "puchna",
]);

function qrNormalise(s) {
  let t = String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, to] of QR_ALIAS_PHRASES) t = t.replace(re, to);
  return t.replace(/\s+/g, " ").trim();
}

function qrTokens(s, dropStopwords = true) {
  return qrNormalise(s).split(" ")
    .filter((w) => w.length > 1 && (!dropStopwords || !QR_STOPWORDS.has(w)));
}

// Levenshtein, capped — used only on short product words, so the O(n*m) is irrelevant.
function qrEditDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// 0..1 similarity between one query word and one title word.
function qrWordScore(q, t) {
  if (q === t) return 1;
  if (t.startsWith(q) || q.startsWith(t)) return 0.9;
  if (t.includes(q) && q.length >= 4) return 0.8;
  const d = qrEditDistance(q, t);
  const max = Math.max(q.length, t.length);
  const sim = 1 - d / max;
  return sim >= 0.7 ? sim * 0.85 : 0;   // below 0.7 it is a different word, not a typo
}

// Best score for a query against one product title.
function qrMatchScore(queryTokens, title) {
  const tTokens = qrTokens(title, false);
  if (!queryTokens.length || !tTokens.length) return 0;
  const normQ = queryTokens.join(" ");
  const normT = qrNormalise(title);
  if (normT === normQ) return 1;
  if (normT.includes(normQ) && normQ.length >= 4) return 0.95;
  let total = 0, hits = 0, strong = 0, exactHits = 0;
  for (const q of queryTokens) {
    let best = 0;
    for (const t of tTokens) best = Math.max(best, qrWordScore(q, t));
    if (best > 0) hits++;
    total += best;
    // One distinctive word matching exactly is a strong signal by itself. Without this,
    // the averaging below dilutes a real hit below the floor as soon as the customer adds
    // a word the title doesn't contain: "endless tablet ka price" scored 0.43 and matched
    // NOTHING, which meant the Rx rule never fired for it. Same for "blue tea period"
    // (aliased to hormoniherb) and any "<product> chahiye mujhe" phrasing.
    // 4 characters, not 5. "Mujhe vaji bati or kern drop chahiye" returned Garcinia Cambogia
    // Drops and NOT Vaji Bati: vaji/bati/kern are all 4 letters so none of them earned the
    // boost, while "drops" (5) boosted every product with Drops in its name. The customer
    // named two products by hand and got neither.
    // ...and lowering it to 4 was only half the fix, because "drops" still earned the boost.
    // A form word is not a name: it is shared by several titles, so exactly the products it
    // cannot distinguish all got 0.85 from it. With "vaji bati kern drops" that tied Garcinia
    // (drops x2) with Vaji Bati (vaji + bati) at 0.90, the cheaper-price tiebreak below put
    // Garcinia first, and the two-option reply dropped Vaji Bati off the end.
    if (q.length >= 4 && !QR_WEAK_MATCH_WORDS.has(q) && tTokens.includes(q)) { exactHits++; strong = 0.85; }
  }
  // Average over query words, then reward matching more than one of them: "vaji bati"
  // hitting both words should beat "bati" alone hitting one.
  const avg = total / queryTokens.length;
  // Matching MORE of the query's distinctive words should outrank matching one. Without this
  // "vaji bati or kern drop" ties Vaji Bati (vaji+bati) with Garcinia Cambogia Drops (drops)
  // at 0.85 and the price tiebreak picks the wrong one.
  if (strong) strong = Math.min(0.95, strong + 0.05 * (exactHits - 1));
  return Math.max(avg * (0.7 + 0.3 * (hits / queryTokens.length)), strong);
}

// ── Product description condensing ───────────────────────────────────────────
// Shopify's copy is written for a product page, not for a health advisor, and feeding it
// raw would import three things Ananya must never say. Measured over the real 34-product
// catalog: 68% of descriptions carry a "How to use / Dosage" heading, 35% an explicit dose
// ("Use one heaping of 250 mg serving daily"), 47% mg/ml quantities and 44% an absolute
// claim ("100%", "instant", "no side effects"). Median length is 2045 chars.
//
// The saving grace is that the copy is machine-delimited:
//   [description]…[/description][benefits]…[/benefits][how_to_use]…[/how_to_use]
//   (+ optional [details] / [ingredients]), present on 33 of 34 products.
// Keeping only [description] + [benefits] removes the dose problem STRUCTURALLY rather
// than by hoping a regex catches every phrasing. Measured after condensing: 0/19 OTC
// descriptions retain a dose, a claim or an mg/ml figure.
const QR_DESC_CAP = 340;
const QR_DESC_MIN = 80;          // below this the sentence filter has cut too much
// Absolute/unprovable claims - forbidden by persona rule 4. These are NOT hallucinations,
// they come from the store's own copy, so rule 4 does not stop the model repeating them.
const QR_CLAIM_WORDS = /(100\s*%|\bcure[sd]?\b|\bcuring\b|guarantee[ds]?|permanent(ly)?|\bmiracle\b|\binstant(ly)?\b|no\s+side\s+effects?|clinically\s+proven|\bsafest\b|\bfastest\b)/gi;
// Product-page puffery. Ananya is explicitly "never pushy/salesy" (rule 8), so superlatives
// break the persona even though they are harmless factually.
const QR_PUFF_WORDS = /(most\s+acclaimed|finest|premium|top-?tier|world-?class|unmatched|unrivalled|unrivaled|\bno\.?\s*1\b|#1\b|truly\s+(exclusive|unique)|\bbest\b|leading)/gi;
const QR_MGML = /\b\d+(\.\d+)?\s*(mg|mcg|ml|gm|g)\b/gi;
// Serving sizes spelled as WORDS, which slip past both the digit-based mg/ml strip and the
// output-side dose guard: Shilajit's copy ends "Avail of all the modern benefits in one
// regular scoop" - "one" and "scoop" are separated by an adjective, so the guard's
// number-then-unit pattern never fires and the serving size reaches the customer.
const QR_DOSEISH_WORDS = /\b(one|two|three|half|a|ek|do|teen|aadha)\s+(\w+\s+){0,2}(scoop|spoon|chammach|teaspoon|tablespoon|tablet|capsule|goli|drop|boond|sachet|serving|dose|khurak)s?\b|\b(daily|per\s+day|roz|rozana|twice|thrice)\b[^.!?]{0,30}\b(scoop|spoon|tablet|capsule|goli|drop|sachet|serving)s?\b/gi;

function qrDescSection(text, name) {
  const s = String(text || '');
  const open = s.search(new RegExp('\\[' + name + '\\]', 'i'));
  if (open < 0) return '';
  const after = s.slice(open).replace(new RegExp('^\\[' + name + '\\]', 'i'), '');
  const stop = after.search(/\[\/?[a-z0-9_ -]{2,30}\]/i);   // next marker of any kind
  return (stop < 0 ? after : after.slice(0, stop)).replace(/\s+/g, ' ').trim();
}

function qrCondenseDescription(title, raw) {
  if (qrIsRx(title)) return '';   // an Rx product gets no description: detail reads as endorsement
  let t = (qrDescSection(raw, 'description') + ' ' + qrDescSection(raw, 'benefits')).trim();
  // 1 of 34 products has no markers at all - fall back to the whole text with markers removed.
  if (!t) t = String(raw || '').replace(/\[\/?[a-z0-9_ -]{2,30}\]/gi, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  if (!t) return '';

  // Drop whole sentences carrying a claim or puffery - scrubbing words inline leaves
  // mangled grammar ("the natural product of Shilajit").
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
  // lastIndex MUST be reset before every .test(): these are /g regexes, so a match on one
  // sentence otherwise makes the next test start mid-string and silently miss. That bug let
  // "This product is truly exclusive and unique" through on the Shilajit description.
  const hasBad = (s) => {
    QR_CLAIM_WORDS.lastIndex = 0; QR_PUFF_WORDS.lastIndex = 0; QR_DOSEISH_WORDS.lastIndex = 0;
    return QR_CLAIM_WORDS.test(s) || QR_PUFF_WORDS.test(s) || QR_DOSEISH_WORDS.test(s);
  };
  let keep = sentences.filter((s) => !hasBad(s));
  if (keep.join(' ').trim().length < QR_DESC_MIN) {
    // The filter ate almost everything (some products are pure marketing prose). Keep the
    // sentences but scrub the offending words, so we degrade to clumsy rather than empty.
    keep = sentences.map((s) => s.replace(QR_CLAIM_WORDS, '').replace(QR_PUFF_WORDS, '').replace(QR_DOSEISH_WORDS, ''));
  }
  let out = keep.join(' ');

  out = out.replace(QR_MGML, '');
  out = out.replace(/\bShehatUP\b/gi, 'SehatUP');              // brand misspelt in their own copy
  out = out.replace(/\bless\s+hassle\s+free\b/gi, 'hassle-free'); // double negative in their copy
  // An OTC item must not be called a medicine: it collides with the OTC/Rx split (rule 5)
  // and with "never diagnose or prescribe". The lookbehind spares phrases like "conventional
  // medicine" / "allopathic medicine", where the word refers to something else entirely and
  // rewriting produced "the negative aftereffects of conventional product".
  out = out.replace(/(?<!\b(?:conventional|allopathic|modern|english|western|traditional)\s)\bmedications?\b/gi, 'product');
  out = out.replace(/(?<!\b(?:conventional|allopathic|modern|english|western|traditional)\s)\bmedicines?\b/gi, 'product');
  out = out.replace(/\s+([,.;:])/g, '$1').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  out = out.replace(/^[\s,.;:-]+/, '').trim();

  if (out.length > QR_DESC_CAP) {
    const cut = out.slice(0, QR_DESC_CAP);
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '));
    out = (lastStop > 120 ? cut.slice(0, lastStop + 1) : cut).trim();
  }
  return out;
}

async function shopifyGraphQL(query) {
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) throw new Error("SHOPIFY_ACCESS_TOKEN is not configured");
  const r = await axios.post(
    `https://${SHOPIFY_HOST}/admin/api/${SHOPIFY_VERSION}/graphql.json`,
    { query },
    { headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" }, timeout: 15000 },
  );
  const d = r.data || {};
  if (d.errors) throw new Error("Shopify GraphQL: " + JSON.stringify(d.errors).slice(0, 300));
  return d.data || {};
}

// Whole active catalog, flattened to one row per product (cheapest variant is the one we
// quote — customers ask "X ka price kya hai", not "which variant".)
async function qrFetchCatalog() {
  const data = await shopifyGraphQL(`{
    products(first: 250, query: "status:active") {
      edges { node {
        id title handle description
        variants(first: 20) { edges { node { id title price availableForSale inventoryQuantity } } }
      } }
    }
  }`);
  const out = [];
  for (const e of (data.products && data.products.edges) || []) {
    const n = e.node || {};
    const variants = ((n.variants && n.variants.edges) || []).map((v) => v.node || {});
    if (!variants.length) continue;
    const priced = variants
      .map((v) => ({
        variantId: String(v.id || "").split("/").pop(),
        variantTitle: v.title || "",
        price: Math.round(Number(v.price) || 0),
        inStock: v.availableForSale !== false,
        qty: typeof v.inventoryQuantity === "number" ? v.inventoryQuantity : null,
      }))
      .filter((v) => v.price > 0)
      .sort((a, b) => a.price - b.price);
    if (!priced.length) continue;
    const cheapest = priced[0];
    out.push({
      title: qrCleanTitle(n.title),
      rawTitle: n.title || "",
      handle: n.handle || "",
      url: n.handle ? `${QR_STORE_URL}/products/${n.handle}` : "",
      price: cheapest.price,
      variantId: cheapest.variantId,
      // In stock if ANY variant is sellable — a sold-out size shouldn't hide the product.
      inStock: priced.some((v) => v.inStock),
      variantCount: priced.length,
      isRx: qrIsRx(n.title),
      about: qrCondenseDescription(n.title, n.description),
    });
  }
  return out;
}

// Did the customer type a word that IDENTIFIES this product, as opposed to merely
// describing it? Used only to break score ties, where "cheapest wins" is the wrong rule:
// asked for "vaji bati kern drops", Vaji Bati (Rs849) and Garcinia (Rs499) tied and the
// customer was shown the one they had not named.
function qrNamedHits(queryTokens, title) {
  const tTokens = qrTokens(title, false);
  let n = 0;
  for (const q of queryTokens) {
    if (q.length >= 4 && !QR_WEAK_MATCH_WORDS.has(q) && tTokens.includes(q)) n++;
  }
  return n;
}

function qrSearchCatalog(text, catalog, limit = 3, floor = 0.55) {
  const q = qrTokens(text);
  if (!q.length) return [];
  const hits = catalog
    .map((p) => ({
      ...p,
      score: Math.round(qrMatchScore(q, p.rawTitle) * 100) / 100,
      named: qrNamedHits(q, p.rawTitle),
      isKit: false,
    }))
    .filter((p) => p.score >= floor)
    .sort((a, b) => b.score - a.score || b.named - a.named || a.price - b.price)
    .slice(0, limit);

  // Condition fallback - ONLY when the fuzzy search found nothing. A customer who names a
  // product must never have their answer diluted by condition suggestions, so this cannot
  // run alongside a real match; it exists to fill the "PCOD ke baare me batao" hole, where
  // the alternative is an empty LIVE PRODUCT DATA block.
  if (!hits.length && QR_CONDITION_INTENT.test(qrNormalise(text))) {
    const qc = qrNormalise(text);
    for (const c of QR_CONDITION_PRODUCTS) {
      if (!c.re.test(qc)) continue;
      for (const h of c.handles) {
        if (hits.some((p) => p.handle === h)) continue;
        const p = catalog.find((x) => x.handle === h);
        // Score sits just above the floor: these were inferred from a condition, not named,
        // and must never outrank a product the customer actually typed.
        if (p) hits.push({ ...p, score: 0.6, named: 0, isKit: false, byCondition: true });
      }
    }
  }

  // A matching kit rides ALONGSIDE the components, never instead of them - the customer
  // asked for the parts, so the parts must still be the answer. The kit is appended so the
  // reply can offer it as the cheaper way to get both.
  const kitHandles = qrKitHandles(text);
  for (const h of kitHandles) {
    if (hits.some((p) => p.handle === h)) continue;
    const kit = catalog.find((p) => p.handle === h);
    if (kit) hits.push({ ...kit, score: 1, named: 0, isKit: true });
  }
  return hits;
}

exports.qrProductLookup = onRequest(
  { region: "us-central1", timeoutSeconds: 30, memory: "256MiB" },
  async (req, res) => {
    // Same contract as qrCustomerContext: never fail the caller, always HTTP 200.
    const out = { found: false, matches: [], summary: "", catalogSize: 0, source: "none" };
    try {
      const expected = process.env.QR_CONTEXT_TOKEN || process.env.QUICKREPLY_WEBHOOK_TOKEN;
      const given = req.query.token || (req.body && req.body.token);
      if (expected && given !== expected) return res.status(401).json({ ...out, error: "unauthorized" });

      const text = String(req.query.text || (req.body && req.body.text) || "").trim();
      if (!text) return res.status(200).json({ ...out, error: "no text" });

      const db = getFirestore();
      const cacheRef = db.collection("qr_context_cache").doc("_catalog");
      let catalog = null;
      if (!req.query.fresh) {
        const snap = await cacheRef.get().catch(() => null);
        const c = snap && snap.exists ? snap.data() : null;
        if (c && c.at && Date.now() - c.at < QR_CATALOG_TTL_MS && c.payload) {
          catalog = JSON.parse(c.payload);
          out.source = "cache";
        }
      }
      if (!catalog) {
        catalog = await qrFetchCatalog();
        out.source = "shopify";
        await cacheRef.set({ at: Date.now(), payload: JSON.stringify(catalog) }, { merge: true }).catch(() => {});
      }
      out.catalogSize = catalog.length;

      const matches = qrSearchCatalog(text, catalog);
      out.matches = matches;
      out.found = matches.length > 0;

      if (matches.length) {
        const lines = matches.map((p) => {
          const bits = [p.title, `Rs${p.price}`];
          if (p.isRx) bits.push("PRESCRIPTION ONLY - never share the link or price");
          else {
            bits.push(p.inStock ? "in stock" : "OUT OF STOCK - do not push this");
            if (p.url) bits.push(p.url);
          }
          if (p.variantCount > 1) bits.push(`${p.variantCount} variants, price shown is the lowest`);
          // Say plainly that this one IS the other two in a box. Without it the model reads
          // three unrelated products and offers a Rs1099 item next to a Rs509 one with no
          // explanation of why anyone would take it.
          if (p.isKit) bits.push("COMBO PACK - contains the other products listed here, cheaper than buying them separately");
          let line = `- ${bits.join(" · ")}`;
          // The blurb goes on its own indented line: product names and URLs already contain
          // punctuation, and burying 250 chars of prose behind a " · " made it unreadable.
          if (p.about) line += `\n  about: ${p.about}`;
          return line;
        });
        out.summary = `Live catalog matches for what the customer wrote (prices are current, from Shopify):\n${lines.join("\n")}`;
      }

      console.log("[qrProductLookup]", JSON.stringify(text).slice(0, 60), "-> ",
        matches.map((p) => `${p.title}=${p.price}@${p.score}`).join(", ") || "no match",
        `| catalog=${catalog.length} (${out.source})`);
      return res.status(200).json(out);
    } catch (err) {
      console.error("[qrProductLookup] failed:", err.message);
      return res.status(200).json({ ...out, error: err.message });
    }
  },
);

// ── AI run flight-recorder ───────────────────────────────────────────────────
// One structured document per n8n execution, so "why didn't the bot reply to X?"
// becomes a Firestore QUERY instead of opening executions one by one in the n8n UI.
// The n8n workflow POSTs a run object from each terminal branch (Log Skipped, the
// Decide-Process bow-out, Log Success) and from an Error Trigger sub-workflow.
//
// Contract (same as qrProductLookup): logging must NEVER break the chat flow, so every
// path returns HTTP 200 except a bad token (401). The caller uses onError:continue too.
//
// Doc id = executionId when given, written with merge, so the Error Trigger's failure
// blob lands on the SAME doc as the run it belongs to (n8n's Error Trigger exposes the
// failed execution's id), and a retried branch updates one doc instead of duplicating.
//
// Auth: reuses QR_CONTEXT_TOKEN (the token qrCustomerContext / qrProductLookup already
// use) — no new secret. n8n sends ?token=@@@ exactly as it does for those two.
//
// TTL: expireAt is a Timestamp AI_RUNS_RETENTION_DAYS ahead. Enable a Firestore TTL
// policy on ai_runs.expireAt ONCE (console → Firestore → TTL) so old runs self-delete;
// until that policy exists the field is inert and nothing is pruned.
const AI_RUNS_RETENTION_DAYS = 60;
const qrClip = (v, n) => (typeof v === "string" && v.length > n ? v.slice(0, n) : v);
exports.qrLogRun = onRequest(
  { region: "us-central1", timeoutSeconds: 15, memory: "256MiB" },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(200).json({ ok: false, error: "use POST" });
      const expected = process.env.QR_CONTEXT_TOKEN || process.env.QUICKREPLY_WEBHOOK_TOKEN;
      const given = req.query.token || (req.body && req.body.token);
      if (expected && given !== expected) return res.status(401).json({ ok: false, error: "unauthorized" });

      const b = (req.body && typeof req.body === "object") ? req.body : {};
      const run = { ...b };
      delete run.token; // an auth param, not run data — do not persist it

      const phone = String(run.phone || "");
      const convId = run.convId ? String(run.convId) : qrConvId(phone);
      const nowMs = Date.now();
      const clientMs = Number(run.ts) || Number(run.msgTime) || nowMs;

      // Trim only the few fields that can be large, so one runaway prompt can't bloat the
      // doc (Firestore caps a document at ~1 MiB). Everything else passes through untouched,
      // so a new field the workflow starts sending needs no change here.
      if (run.ai && typeof run.ai === "object") {
        run.ai.reply = qrClip(run.ai.reply, 4000);
        if ("prompt" in run.ai) run.ai.prompt = qrClip(run.ai.prompt, 8000);
      }
      run.input = (run.input && typeof run.input === "object") ? run.input : {};
      if (run.input.text) run.input.text = qrClip(String(run.input.text), 2000);

      const doc = {
        ...run,
        phone,
        convId,
        outcome: String(run.outcome || "unknown"),
        reason: run.reason != null ? String(run.reason) : "",
        ts: clientMs,                             // client event time (ms) — order runs by this
        loggedAt: FieldValue.serverTimestamp(),   // when THIS write landed (authoritative)
        expireAt: Firestore.Timestamp.fromMillis(nowMs + AI_RUNS_RETENTION_DAYS * 86400000),
      };

      const db = getFirestore();
      const col = db.collection("ai_runs");
      const execId = run.executionId ? String(run.executionId) : "";
      let id;
      if (execId) {
        id = execId;
        await col.doc(id).set(doc, { merge: true });
      } else {
        const ref = await col.add(doc);
        id = ref.id;
      }
      console.log(`[qrLogRun] ${doc.outcome} phone=${phone || "?"} reason=${doc.reason || "-"} id=${id}`);
      return res.status(200).json({ ok: true, id });
    } catch (err) {
      console.error("[qrLogRun] failed:", err.message);
      return res.status(200).json({ ok: false, error: err.message });
    }
  },
);

// ── AI run reader (powers the ai_runs dashboard) ─────────────────────────────
// Read side of the flight recorder: returns ai_runs as JSON for the static dashboard
// (n8n/workflows/ai-runs-dashboard.html). CORS-open + token-gated (same QR_CONTEXT_TOKEN),
// so the page can call it from a hosted URL or a local file without touching Firestore
// security rules — the PII stays behind the token instead of behind a public read rule.
//
// INDEX-FREE by design: Firestore auto-creates single-field indexes, so an equality filter
// (phone / outcome / reason) needs no composite index; only the unfiltered "recent feed"
// path uses orderBy(ts), which the automatic ts index already covers. Secondary filters are
// applied in memory. This keeps the deploy to one function with no index step.
exports.qrRuns = onRequest(
  { region: "us-central1", timeoutSeconds: 30, memory: "256MiB" },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") return res.status(204).send("");
    try {
      // Own dedicated token so locking the dashboard (a PII read endpoint) never forces a
      // token onto the fail-open write/context endpoints. Falls back to QR_CONTEXT_TOKEN, and
      // if neither is set it stays open — same behaviour as everything else here today.
      const expected = process.env.QR_RUNS_TOKEN || process.env.QR_CONTEXT_TOKEN || process.env.QUICKREPLY_WEBHOOK_TOKEN;
      const given = req.query.token || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (expected && given !== expected) return res.status(401).json({ ok: false, error: "unauthorized", runs: [] });

      const phone    = String(req.query.phone   || "").trim();
      const outcome  = String(req.query.outcome || "").trim();
      const reason   = String(req.query.reason  || "").trim();
      const before   = Number(req.query.before) || 0;                  // cursor: return runs with ts < before
      const pageSize = Math.min(parseInt(req.query.limit, 10) || 50, 200);

      const db = getFirestore();
      const col = db.collection("ai_runs");
      const mapDoc = (d) => {
        const r = d.data() || {};
        const { expireAt, loggedAt, ...rest } = r; // drop the raw Timestamps
        return { id: d.id, ...rest, loggedAt: loggedAt && loggedAt.toDate ? loggedAt.toDate().toISOString() : null };
      };

      let runs;
      if (phone || outcome || reason) {
        // An equality filter — stay index-free (no orderBy): pull a window, then sort and
        // paginate in memory. The `before` cursor and any secondary filter apply here too.
        let q = col;
        if (phone) q = q.where("phone", "==", phone);
        else if (outcome) q = q.where("outcome", "==", outcome);
        else q = q.where("reason", "==", reason);
        runs = (await q.limit(500).get()).docs.map(mapDoc);
        if (outcome) runs = runs.filter((r) => r.outcome === outcome);
        if (reason)  runs = runs.filter((r) => r.reason === reason);
        runs.sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));
        if (before) runs = runs.filter((r) => (Number(r.ts) || 0) < before);
        runs = runs.slice(0, pageSize);
      } else {
        // Recent feed — the cursor paginates on the automatic single-field ts index (a range
        // filter + orderBy on the SAME field needs no composite index).
        let q = col.orderBy("ts", "desc");
        if (before) q = q.where("ts", "<", before);
        runs = (await q.limit(pageSize).get()).docs.map(mapDoc);
      }

      // A full page implies there may be more; hand back the last ts as the next cursor.
      const nextCursor = runs.length === pageSize ? (Number(runs[runs.length - 1].ts) || null) : null;
      return res.status(200).json({ ok: true, count: runs.length, runs, nextCursor });
    } catch (err) {
      console.error("[qrRuns] failed:", err.message);
      return res.status(200).json({ ok: false, error: err.message, runs: [] });
    }
  },
);

// ── QuickReply Tester clear ──────────────────────────────────────────────────
// Wipes a phone's qr_conversations/{phone}/events so the bot starts a fresh
// conversation (the n8n "Build AI Prompt" node feeds recent events back to the
// model, so stale history must be cleared between tests). Same optional
// QR_TESTER_KEY gate as qrTestSend.
exports.qrTestClear = onCall({ region: "us-central1" }, async (request) => {
  const expectedKey = process.env.QR_TESTER_KEY;
  if (expectedKey) {
    const provided = request.data && request.data.testerKey ? String(request.data.testerKey) : "";
    if (provided !== expectedKey) throw new HttpsError("permission-denied", "Invalid tester key.");
  }

  const to = (request.data && request.data.to ? String(request.data.to) : "").trim();
  if (!to) throw new HttpsError("invalid-argument", "Recipient phone is required.");

  const db = getFirestore();
  const convId = qrConvId(to);
  const messagesRef = db.collection("conversations").doc(convId).collection("messages");

  let deleted = 0;
  // delete in batches of 300 until the subcollection is empty
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await messagesRef.limit(300).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 300) break;
  }

  // Delete the parent conversation doc too, so the bot starts a truly fresh chat
  // (resets lastMessage / windowExpiresAt / unreadCount / assignment).
  await db.collection("conversations").doc(convId).delete().catch(() => {});

  return { success: true, deleted };
});

// ── QuickReply External CRM Integration ──────────────────────────────────────
// QuickReply pushes contact create/fetch/update events here in near-real-time, so a
// contact's curated name (e.g. an agent renames "sharmarinkey697" → "Rinkey Sharma", or
// names a previously-unnamed number) stays in sync with our `conversations`. The message
// webhook only ever sends the name as it was AT message time, so this sync is the only way
// to receive later edits. lead_id we return is the conversation id (phone digits).
// Configure with QuickReply support (help@quickreply.ai):
//   Create:  POST <fnUrl>/create
//   Fetch:   POST <fnUrl>/fetch        (GET with query also works)
//   Update:  POST <fnUrl>/update/<lead_id>
//   Header:  Auth-Key: <QUICKREPLY_CRM_AUTH_KEY>
exports.qrCrm = onRequest({ region: "us-central1" }, async (req, res) => {
  try {
    const expected = process.env.QUICKREPLY_CRM_AUTH_KEY;
    const provided = req.get("Auth-Key") || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (expected && provided !== expected) return res.status(401).json({ error: "Unauthorized" });

    const db = getFirestore();
    const body = req.body || {};
    const q = req.query || {};
    const segs = String(req.path || "").split("/").filter(Boolean); // e.g. ["create"] or ["update","<id>"]
    const action = (segs[0] || "").toLowerCase();
    const phone = body.phone || q.phone || "";
    const email = body.email || q.email || "";
    const leadId = body.lead_id || q.lead_id || segs[1] || "";
    const convIdFromPhone = phone ? qrConvId(phone) : "";

    const upsert = (convId, data) => db.collection("conversations").doc(convId).set({
      phone: data.phone || phone || "",
      ...(data.name ? { name: String(data.name) } : {}),
      ...(data.email ? { email: String(data.email) } : {}),
      ...(data.custom_fields ? { leadFields: data.custom_fields } : {}),
      crmSyncedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Fetch (dedupe lookup) — QuickReply may call this before create/update.
    if (action === "fetch") {
      let snap = null;
      if (leadId) snap = await db.collection("conversations").doc(leadId).get();
      else if (convIdFromPhone) snap = await db.collection("conversations").doc(convIdFromPhone).get();
      else if (email) { const qs = await db.collection("conversations").where("email", "==", email).limit(1).get(); snap = qs.empty ? null : qs.docs[0]; }
      if (!snap || !snap.exists) return res.status(404).json({ error: "Not found" });
      const d = snap.data();
      return res.status(200).json({ lead_id: snap.id, lead_fields: { phone: d.phone || "", name: d.name || "", email: d.email || "", custom_fields: d.leadFields || {} } });
    }
    // Everything else — the bare URL, /create or /update — upserts the contact by phone (or
    // lead_id). QuickReply only integrates ONE endpoint, so this single handler covers both
    // create and update events: whatever they POST with phone + name updates the conversation.
    const convId = leadId || convIdFromPhone;
    if (!convId) return res.status(400).json({ error: "phone or lead_id required" });
    await upsert(convId, body);
    return res.status(200).json({ lead_id: convId, status: "OK" });
  } catch (e) {
    console.error("[qrCrm] error", e);
    return res.status(500).json({ error: e.message || "error" });
  }
});

