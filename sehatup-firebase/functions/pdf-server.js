/**
 * pdf-server.js  (run from functions/ directory)
 * Standalone local PDF generator server.
 *
 * Run: node pdf-server.js  (from sehatupfirebase/functions/)
 * Listens on: http://localhost:5500
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Firestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const os = require('os');

// Initialize Firebase Admin with DEV credentials (sehatupdev)
const serviceAccount = require('./sehatupdev-firebase-adminsdk-fbsvc-50c50c8be8.json');
initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'sehatupdev.firebasestorage.app'
});

const db = getFirestore();

// Load and compile Handlebars template
const prescriptionTemplatePath = path.join(__dirname, 'templates', 'prescriptionTemplate.html');
const prescriptionTemplateHtml = fs.readFileSync(prescriptionTemplatePath, 'utf-8');
handlebars.registerHelper('lt', (a, b) => parseInt(a) < parseInt(b));
handlebars.registerHelper('gt', (a, b) => parseInt(a) > parseInt(b));
handlebars.registerHelper('eq', (a, b) => a === b);

// Helper: get base64 for PDF-Assets images
const getBase64 = (fileName) => {
    const publicDir = path.join(__dirname, '..', 'public', 'PDF-Assets');
    const filePath = path.join(publicDir, fileName);
    if (fs.existsSync(filePath)) {
        const bitmap = fs.readFileSync(filePath);
        const ext = path.extname(fileName).replace('.', '');
        return `data:image/${ext};base64,${bitmap.toString('base64')}`;
    }
    return '';
};

// PDF generation via Puppeteer (reads template fresh each time)
const generatePrescriptionPDF = async (data, docId) => {
    // Reload template from disk on every call so edits take effect without restart
    const freshHtml = fs.readFileSync(prescriptionTemplatePath, 'utf-8');
    const prescriptionTemplate = handlebars.compile(freshHtml);

    const tempHtmlPath = path.join(os.tmpdir(), `prescription_${Date.now()}.html`);
    const tempPdfPath = path.join(os.tmpdir(), `prescription_${Date.now()}.pdf`);

    const html = prescriptionTemplate(data);
    fs.writeFileSync(tempHtmlPath, html, 'utf-8');

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
    });
    const page = await browser.newPage();
    await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });
    const contentHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.pdf({
        path: tempPdfPath,
        width: '210mm',
        height: `${contentHeight}px`,
        printBackground: true,
        margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
    });
    await browser.close();

    // Upload to Firebase Storage
    const bucket = getStorage().bucket();
    const storagePath = `prescriptions_pdf/${docId}.pdf`;
    await bucket.upload(tempPdfPath, {
        destination: storagePath,
        metadata: { contentType: 'application/pdf' },
    });

    const [url] = await bucket.file(storagePath).getSignedUrl({
        action: 'read',
        expires: '03-09-2491',
    });

    // Clean up
    try { fs.unlinkSync(tempHtmlPath); } catch (_) { }
    try { fs.unlinkSync(tempPdfPath); } catch (_) { }

    return { storagePath, downloadUrl: url };
};

// Express server
const app = express();

// CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
});

app.get('/generatePrescriptionPDF', async (req, res) => {
    const { docId } = req.query;
    if (!docId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing docId' }));
        return;
    }

    console.log(`[PDF Server] Generating PDF for docId: ${docId}`);

    try {
        const docRef = db.collection('prescriptions').doc(docId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Prescription not found' }));
            return;
        }

        const data = docSnap.data();
        data.logoBase64 = getBase64('Logo.png');
        data.signatureBase64 = getBase64('Signature.png');
        data.date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const preset = data.preset || 'general';
        data.isGeneralPreset = preset === 'general';
        data.isWeightPreset = preset === 'weight';
        data.isPcodPreset = preset === 'pcod';
        data.isWellnessPreset = preset === 'wellness';

        data.medications = (data.recommendedProducts || []).map((prod, i) => ({
            sNo: i + 1,
            name: prod.name,
            regimen: prod.regimen || ((prod.qty && prod.qty > 1) ? `Qty: ${prod.qty}` : 'As directed'),
            duration: prod.duration || '-',
            remarks: prod.remarks || '-'
        }));

        if (typeof data.dietAdvice === 'string') {
            data.dietAdvice = data.dietAdvice.split('\n').filter(l => l.trim() !== '');
        } else {
            data.dietAdvice = data.dietAdvice || [];
        }

        if (typeof data.lifestyleAdvice === 'string') {
            data.lifestyleAdvice = data.lifestyleAdvice.split('\n').filter(l => l.trim() !== '');
        } else {
            data.lifestyleAdvice = data.lifestyleAdvice || [];
        }

        const { storagePath, downloadUrl } = await generatePrescriptionPDF(data, docId);

        // 1. Update prescriptions document
        await docRef.update({
            prescriptionStoragePath: storagePath,
            prescriptionDownloadUrl: downloadUrl,
            pdfGeneratedAt: Firestore.FieldValue.serverTimestamp(),
        });

        // 2. Write PDF URL back to the original submission so all patient data stays in one place
        const submissionCollection = data.submissionCollectionName || 'questionnaire_submissions';
        if (data.patientId) {
            try {
                await db.collection(submissionCollection).doc(data.patientId).update({
                    prescriptionDocId: docId,
                    prescriptionDownloadUrl: downloadUrl,
                    prescriptionGeneratedAt: Firestore.FieldValue.serverTimestamp(),
                });
                console.log(`[PDF Server] Submission ${data.patientId} updated with prescription URL.`);
            } catch (e) {
                console.warn(`[PDF Server] Could not update submission:`, e.message);
            }
        }

        console.log(`[PDF Server] Done! URL: ${downloadUrl.substring(0, 80)}...`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, downloadUrl }));

    } catch (err) {
        console.error('[PDF Server] Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    }
});

const PORT = 5500;
app.listen(PORT, () => {
    console.log(`\n✅ PDF Server running at http://localhost:${PORT}`);
    console.log(`   GET http://localhost:${PORT}/generatePrescriptionPDF?docId=YOUR_DOC_ID\n`);
});
