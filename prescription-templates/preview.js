// Builds a ready-to-open preview of the prescription with each diet plan filled in.
//
//   node preview.js
//
// Then open  preview/index.html  in a browser (double-click it). Each plan has its own
// page. To save one as a PDF: open it, press Ctrl+P, choose "Save as PDF", and turn on
// "Background graphics". Edit prescription-template.html or any diet-plans/*.json, run
// the command again, and refresh the browser.
//
// The patient, doctor and medicines below are made-up sample data.

const fs = require('fs');
const path = require('path');

// Handlebars is already installed with the Firebase functions.
const handlebars = require(path.join(__dirname, '..', 'sehatup-firebase', 'functions', 'node_modules', 'handlebars'));

// The same helpers the PDF function registers (index.js).
handlebars.registerHelper('lt', (a, b) => parseInt(a) < parseInt(b));
handlebars.registerHelper('gt', (a, b) => parseInt(a) > parseInt(b));
handlebars.registerHelper('eq', (a, b) => a === b);
handlebars.registerHelper('len', (arr) => (Array.isArray(arr) ? arr.length : 0));
handlebars.registerHelper('add', (a, b) => parseInt(a) + parseInt(b));

const assets = path.join(__dirname, '..', 'sehatup-firebase', 'functions', 'assets');
const b64 = (file) => {
  const p = path.join(assets, file);
  return fs.existsSync(p) ? `data:image/${path.extname(file).slice(1)};base64,${fs.readFileSync(p).toString('base64')}` : '';
};

const render = handlebars.compile(fs.readFileSync(path.join(__dirname, 'prescription-template.html'), 'utf8'));

const sample = {
  patientName: 'Priya Sharma',
  patientAge: '28',
  patientGender: 'Female',
  prescriptionID: 'RX-SAMPLE',
  displayId: 'RX-SAMPLE',
  consultationDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  primaryDiagnosis: 'PCOD with irregular periods and weight gain',
  clinicalFindings: 'Sample finding for the preview. Irregular cycle, mild weight gain and tiredness.',
  recommendedProducts: [
    { name: 'HER MENSES', dosage: ['1', '0', '0', '1'], dosageType: 'schedule', type: 'CAPSULE', timing: 'After Food', instruction: 'Take with warm water', duration: '1 Month', quantity: 1, contains: 'Shatavari, Ashoka, Lodhra' },
    { name: 'THYRO BALANCE DROPS', dosageValue: '10', dosageType: 'drops', dosageFrequency: '3', type: 'LIQUID', timing: 'Before Meals', instruction: 'Dilute in half cup water', duration: '45 Days', quantity: 1, contains: 'Fucus vesiculosus, Iodum' },
    { name: 'IRON PLUS SYRUP', dosage: ['0', '0', '1', '0'], dosageType: 'schedule', type: 'SYRUP', timing: 'After Food', instruction: 'Take after dinner', duration: '1 Month', quantity: 1, contains: 'Ferrum met, Natrum mur' },
  ].map((p) => ({ dosageValue: '', dosageFrequency: '', ...p })),
  guidelines: ['Avoid sugar and processed foods.', 'Sleep 7 to 8 hours at a regular time.', 'Walk for 30 minutes every day.'],
  doctors: [{ name: 'DR. SAMPLE DOCTOR', qualification: 'BHMS\nHomeopathy', registrationNo: 'REG-00000', signatures: [] }],
  cartLink: 'https://sehatup.com/',
  logoBase64: b64('Logo.png'),
  backgroundBase64: b64('Background.png'),
};

const out = path.join(__dirname, 'preview');
fs.mkdirSync(out, { recursive: true });

const labels = {
  lean_to_weight_gain: 'PCOD - Lean Type (Weight Gain)',
  weight_to_lean: 'PCOD - Overweight Type (Weight Loss)',
  infertility_pcod_pcos: 'PCOD - Infertility & Irregular Periods',
  thyroid_diabetes_pcod: 'PCOD - Thyroid + Diabetes (Leucorrhea)',
  pcod_mood_anxiety_insomnia: 'PCOD - Mood Swings, Anxiety & Insomnia',
  general_pcod_pcos: 'PCOD - General (Irregular Periods)',
};

const links = [];
const planDir = path.join(__dirname, 'diet-plans');
const keys = fs.readdirSync(planDir).filter((f) => f.endsWith('.json') && f[0] !== '_').map((f) => f.slice(0, -5));

// One page without a diet plan, then one per plan.
const pages = [{ key: 'no-diet-plan', label: 'No diet plan', plan: null }].concat(
  keys.map((k) => ({ key: k, label: labels[k] || k, plan: JSON.parse(fs.readFileSync(path.join(planDir, k + '.json'), 'utf8')) }))
);

// Template picker, top right of every page. Screen only, so it never shows in a printed PDF.
const picker = (current) =>
  `<div id="tplpick"><label for="tplsel">Template</label><select id="tplsel" onchange="location.href=this.value">` +
  pages.map((q) => `<option value="${q.key}.html"${q.key === current ? ' selected' : ''}>${q.label}</option>`).join('') +
  `</select></div>`;
// The template already starts the diet plan on a new page (page-break-before) in the PDF. A browser tab is one
// long scroll, so show that break as a grey gap with a "Page 2" label.
const pageBreakCss =
  '@media screen { div[style*="page-break-before: always"] { position: relative; margin: 28px -8mm 0 -8mm !important; border-top: 44px solid #d9dde3; padding: 12mm 10mm 4mm 10mm !important; } div[style*="page-break-before: always"]::before { content: "Page 2"; position: absolute; top: -34px; left: 0; right: 0; text-align: center; font: 600 12px system-ui, sans-serif; color: #5f5a56; } }';
const pickerCss =
  '@media screen { #tplpick { position: fixed; top: 14px; right: 18px; z-index: 10; display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 14px; background: #fff; border-radius: 10px; box-shadow: 0 4px 18px rgba(0,0,0,.18); font: 600 13px system-ui, sans-serif; color: #1d1d1d; } #tplpick select { font: 600 13px system-ui, sans-serif; padding: 7px 10px; border: 1px solid #cfd5dd; border-radius: 8px; background: #fff; color: #1d1d1d; cursor: pointer; } } @media print { #tplpick { display: none !important; } }';

for (const p of pages) {
  const data = { ...sample, prescriptionTemplate: p.plan ? p.key : '', dietPlan: p.plan || undefined, hasDietPlan: !!p.plan };
  // On screen only: show the page at the PDF's width (A4, 210mm) on a grey desk, with the page margins the PDF has (4mm page margin + the template's own 4mm).
  // Printing and Save as PDF ignore this, so they still use the template's own A4 layout.
  const html = render(data).replace('</head>', '<style>@media screen { html { background: #d9dde3 !important; } html body { width: 210mm !important; max-width: 210mm !important; margin: 24px auto !important; padding: 4mm 8mm 12mm 8mm !important; box-shadow: 0 6px 30px rgba(0,0,0,.18); } }' + pageBreakCss + pickerCss + '</style></head>').replace(/<body[^>]*>/, (m) => m + picker(p.key));
  fs.writeFileSync(path.join(out, p.key + '.html'), html);
  links.push(`<li><a href="${p.key}.html">${p.label}</a></li>`);
}

fs.writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Prescription preview</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#1d1d1d}h1{font-size:24px}li{margin:6px 0}a{color:#d81f48}p{color:#5f5a56}</style>
<h1>Prescription preview</h1><p>Sample patient and medicines. Each page is the prescription with one diet plan filled in. To save as PDF press Ctrl+P and turn on Background graphics.</p><ul>${links.join('')}</ul>`
);

console.log(`Done: ${pages.length} pages in ${out}\nOpen ${path.join(out, 'index.html')} in your browser.`);
