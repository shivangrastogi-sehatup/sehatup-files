const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const os = require('os');
const axios = require('axios');

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

const generateCartUrl = (products, utmSource = "doctor_panel") => {
  if (!products || !Array.isArray(products) || products.length === 0) return null;
  const SEHATUP_URL = "https://sehatup.com";
  const items = products
    .filter((p) => p.variantId && String(p.variantId) !== "unknown" && String(p.variantId) !== "null")
    .map((p) => `${p.variantId}:${p.qty || p.quantity || 1}`)
    .join(",");
  if (!items) return null;
  return `${SEHATUP_URL}/cart/${items}?storefront=true&utm_source=${utmSource}`;
};

async function testV3Pdf() {
  console.log('Starting local Prescription V3 PDF test...');
  
  const templatePath = path.join(__dirname, 'templates', 'prescriptionTemplateV3.html');
  const templateHtml = fs.readFileSync(templatePath, 'utf-8');

  handlebars.registerHelper("lt", function (a, b) {
    return parseInt(a) < parseInt(b);
  });
  handlebars.registerHelper("gt", function (a, b) {
    return parseInt(a) > parseInt(b);
  });
  handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });

  const template = handlebars.compile(templateHtml);

  let medications = [
    {
      sNo: 1,
      name: "ASHWAGANDHA TABLETS",
      contains: "",
      frequency: "1-1-1-0",
      type: "TABLET",
      timing: "As directed",
      instruction: "After meals",
      duration: "1 Month",
      qty: 1
    },
    {
      sNo: 2,
      name: "PURE HIMALAYAN SHILAJIT RESIN – 20G | SEHATUP",
      contains: "",
      frequency: "2 Drops",
      dosageLabel: "10/Day",
      type: "RESIN",
      timing: "As directed",
      instruction: "After meals",
      duration: "1 Month",
      qty: 1
    },
    {
      sNo: 3,
      name: "HER MENSES (FOR RHYTHMIC RELIEF & HORMONAL HARMONY)",
      contains: "",
      frequency: "1-0-0-0",
      type: "TABLET",
      timing: "Once a day",
      instruction: "After meals",
      duration: "1 Month",
      qty: 1
    }
  ];

  console.log('Resolving Variant IDs from Shopify...');
  medications = await resolveAllVariantIds(medications);
  const cartUrl = generateCartUrl(medications, "test_panel");
  console.log(`Generated Cart URL: ${cartUrl}`);

  const data = {
    baseUrl: "https://sehatupdev.web.app",
    doctorName: "Dr. Shefali Chhichholia",
    doctorQualifications: "BHMS, MD (Homeopathy)",
    doctorRegNumber: "RX-1018",
    signatureUrl: "https://sehatupdev.web.app/PDF-Assets/Signature.png",
    patientName: "Shivang",
    patientAge: "23",
    patientGender: "Male",
    date: "31 Mar 2026",
    displayId: "RX-1018",
    diagnosisTitle: "TEST",
    diagnosisInfo: "TEST",
    cartLink: cartUrl || "https://sehatup.com/cart",
    medications: medications,
    recommendedProducts: medications, // Included for the {{#each recommendedProducts}} loop in V3
    guidelines: [
      { text: "Eat foods that boost energy and hormones like almonds, pumpkin seeds, dates, and dark chocolate" },
      { text: "Sleep 7-8 hours regularly and avoid stress, as it affects performance" },
      { text: "Stay active—30 minutes of walking or light exercise can help improve stamina" },
      { text: "Avoid smoking, alcohol, and junk food—they affect blood flow and energy" },
      { text: "Include zinc and magnesium-rich foods like seeds, leafy greens, and dry fruits" },
      { text: "Maintain daily physical activity" }
    ]
  };

  const html = template(data);
  const tempHtmlPath = path.join(__dirname, 'test_v3.html');
  const pdfOutputPath = path.join(__dirname, 'test_v3_output.pdf');

  fs.writeFileSync(tempHtmlPath, html);

  const browser = await puppeteer.launch({ 
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true 
  });
  const page = await browser.newPage();
  
  await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });

  const contentHeight = await page.evaluate(() => {
    return document.body.scrollHeight;
  });

  await page.pdf({
    path: pdfOutputPath,
    printBackground: true,
    width: "210mm",
    height: `${contentHeight}px`,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  await browser.close();
  console.log(`PDF generated at ${pdfOutputPath}`);
  console.log(`HTML preview saved at ${tempHtmlPath}`);

  // Auto-open Cart URL to verify bundle
  if (cartUrl) {
    console.log('Opening Cart URL in browser...');
    const exec = require('child_process').exec;
    exec(`start "" "${cartUrl}"`);
  }
}

testV3Pdf().catch(err => {
    console.error('Test failed:', err);
    console.error(err.stack);
    process.exit(1);
});
