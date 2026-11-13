const getBase64 = (fileName) => {
  const filePath = path.join(__dirname, "assets", fileName);
  if (fs.existsSync(filePath)) {
    const bitmap = fs.readFileSync(filePath);
    const extension = path.extname(fileName).replace(".", "");
    return `data:image/${extension};base64,${bitmap.toString("base64")}`;
  }
  return "";
};

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

const injectDietPlan = (data) => {
  const selectedTemplate = data.prescriptionTemplate;
  if (selectedTemplate && DIET_PLANS[selectedTemplate]) {
    data.dietPlan = DIET_PLANS[selectedTemplate];
    data.hasDietPlan = true;
  } else {
    data.hasDietPlan = false;
  }
};

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
    const html = htmlFromTemplate(data, type);
    fs.writeFileSync(tempHtmlPath, html);

    const launchOptions = {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    };

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
      preferCSSPageSize: true,
      width: "210mm",
      height: `${contentHeight}px`,
    });

    await browser.close();

    const bucket = getStorage().bucket();
    const formattedName = data.patientName || data.userName || "Patient";
    const formattedDate = data.date ? data.date.replace(/\//g, '-') : new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

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

    fs.unlinkSync(tempHtmlPath);
    fs.unlinkSync(tempPdfPath);

    const file = bucket.file(`${fileName}.pdf`);
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2500",
      responseDisposition: `inline; filename="${baseFileName}.pdf"`,
    });

    return {
      storagePath: `gs://${bucket.name}/${fileName}.pdf`,
      downloadUrl: signedUrl,
    };
  } catch (error) {
    if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
    if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
    throw error;
  }
};

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

    data["logoBase64"] = getBase64("Logo.png");
    data["signatureBase64"] = getBase64("Signature.png");
    data["backgroundBase64"] = getBase64("Background.png");

    data.date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const preset = data.preset || 'general';
    data.isGeneralPreset = preset === 'general';
    data.isWeightPreset = preset === 'weight';
    data.isPcodPreset = preset === 'pcod';
    data.isWellnessPreset = preset === 'wellness';

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

    if (data.recommendedProducts) {
      data.recommendedProducts = await resolveAllVariantIds(data.recommendedProducts);
    }
    const collectionName = data.submissionCollectionName || 'prescriptions';
    const utmSource = collectionName === 'performance_marketing' ? 'marketing_panel' : 'doctor_panel';
    data["cartUrl"] = generateCartUrl(data["recommendedProducts"], utmSource);
    data["cartLink"] = data["cartUrl"];

    const dietLines = typeof data.dietAdvice === "string" ?
      data.dietAdvice.split("\n").filter(l => l.trim()) :
      (Array.isArray(data.dietAdvice) ? data.dietAdvice : []);

    const lifestyleLines = typeof data.lifestyleAdvice === "string" ?
      data.lifestyleAdvice.split("\n").filter(l => l.trim()) :
      (Array.isArray(data.lifestyleAdvice) ? data.lifestyleAdvice : []);

    const structuredLifestyleLines = Array.isArray(data.lifestyleChanges) ?
      data.lifestyleChanges.map(item => typeof item === 'object' ? item.text : item).filter(Boolean) : [];

    data.guidelines = [...dietLines, ...lifestyleLines, ...structuredLifestyleLines];

    injectDietPlan(data);

    data.consultationDate = data.consultationDate || data.date;
    data.prescriptionID = data.prescriptionID || data.displayId || "RX-XXXX";

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

      const submissionCollection = data.submissionCollectionName || 'questionnaire_submissions';
      const patientId = data.patientId;
      if (patientId) {
        try {
          await db.collection(submissionCollection).doc(patientId).update({
            prescriptionDocId: docId,
            prescriptionDownloadUrl: downloadUrl,
            prescriptionGeneratedAt: Firestore.FieldValue.serverTimestamp(),
            cartUrl: data["cartUrl"] || null
          });

          await db.collection(submissionCollection).doc(patientId)
            .collection("prescriptions").doc(docId).update(updatePayload);

          console.log(`Submission ${patientId} and subcollection updated with prescription results.`);
        } catch (e) {
          console.warn(`Could not update submission or subcollection doc: ${e.message}`);
        }
      }

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
