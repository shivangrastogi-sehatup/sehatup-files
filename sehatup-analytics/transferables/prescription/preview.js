const fs = require('fs');
const path = require('path');

let handlebars;
try {
  handlebars = require('handlebars');
} catch (err) {
  handlebars = require('../../../sehatup-firebase/functions/node_modules/handlebars');
}

handlebars.registerHelper('lt', (a, b) => parseInt(a) < parseInt(b));
handlebars.registerHelper('gt', (a, b) => parseInt(a) > parseInt(b));
handlebars.registerHelper('eq', (a, b) => a === b);
handlebars.registerHelper('len', (list) => (Array.isArray(list) ? list.length : 0));
handlebars.registerHelper('add', (a, b) => parseInt(a) + parseInt(b));

const read = (...parts) => fs.readFileSync(path.join(__dirname, ...parts), 'utf8');

const template = handlebars.compile(read('prescription-template.html'));
const sample = JSON.parse(read('sample-data.json'));
const labels = JSON.parse(read('diet-plans', 'labels.json'));

const logoFile = path.join(__dirname, 'assets', 'functions-assets', 'Logo.png');
sample.logoBase64 = 'data:image/png;base64,' + fs.readFileSync(logoFile).toString('base64');
sample.baseUrl = '../assets/hosting';

const pages = [{ key: 'no-diet-plan', label: 'No diet plan', plan: null }];
for (const key of Object.keys(labels)) {
  const plan = JSON.parse(read('diet-plans', key + '.json'));
  pages.push({ key, label: labels[key], plan });
}

const outDir = path.join(__dirname, 'preview');
fs.mkdirSync(outDir, { recursive: true });

for (const page of pages) {
  const html = template({
    ...sample,
    prescriptionTemplate: page.plan ? page.key : '',
    dietPlan: page.plan || undefined,
    hasDietPlan: Boolean(page.plan),
  });
  fs.writeFileSync(path.join(outDir, page.key + '.html'), html);
}

const links = pages.map((page) => `<li><a href="${page.key}.html">${page.label}</a></li>`).join('\n');
fs.writeFileSync(
  path.join(outDir, 'index.html'),
  `<!doctype html>\n<meta charset="utf-8">\n<title>Prescription preview</title>\n<h1>Prescription preview</h1>\n<ul>\n${links}\n</ul>\n`
);

console.log(`${pages.length} pages written to ${outDir}`);
