const puppeteer = require('puppeteer');
const path = require('path');

async function testPdf() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const tempHtmlPath = path.join(__dirname, 'templates', 'preview_result.html');

  // Try with no viewport explicitly set
  // await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

  await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');

  await page.pdf({
    path: 'test_output.pdf',
    printBackground: true,
    width: "210mm",
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log('PDF generated at test_output.pdf');
}

testPdf();
