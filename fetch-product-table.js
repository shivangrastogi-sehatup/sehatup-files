const https = require('https');
const fs = require('fs');

const SHOPIFY_DOMAIN = '0ec320-gj.myshopify.com';
const ACCESS_TOKEN = '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';
const API_VERSION = '2026-01';

async function fetchProducts() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SHOPIFY_DOMAIN,
      path: `/admin/api/${API_VERSION}/products.json?limit=250`,
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data).products);
        } else {
          reject(new Error(`Shopify API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (e) => { reject(e); });
    req.end();
  });
}

async function start() {
  try {
    console.log('🔄 Fetching latest product data from Shopify...');
    const products = await fetchProducts();
    
    // Markdown Version (Fixed)
    let markdown = '# SehatUP Product Price List\n\n';
    markdown += `| Product Name | Selling Price (INR) | MRP (INR) | 10% Off Price (INR) |\n`;
    markdown += `| :--- | :--- | :--- | :--- |\n`;

    // CSV Version (Excel compatible)
    let csv = 'Product Name,Selling Price (INR),MRP (INR),10% Off Price (INR)\n';

    products.forEach(p => {
      const v = p.variants[0];
      const sellingPrice = parseFloat(v.price).toFixed(2);
      const mrp = v.compare_at_price ? parseFloat(v.compare_at_price).toFixed(2) : sellingPrice;
      const discountedPrice = (parseFloat(v.price) * 0.9).toFixed(2);
      
      // Clean title for Markdown (remove |)
      const cleanTitle = p.title.replace(/\|/g, '-').trim();
      
      // Clean title for CSV (wrap in quotes to handle commas)
      const csvTitle = `"${p.title.replace(/"/g, '""')}"`;

      markdown += `| ${cleanTitle} | ₹${sellingPrice} | ₹${mrp} | ₹${discountedPrice} |\n`;
      csv += `${csvTitle},${sellingPrice},${mrp},${discountedPrice}\n`;
    });

    fs.writeFileSync('PRODUCT_LIST.md', markdown);
    fs.writeFileSync('PRODUCT_LIST.csv', csv);
    
    console.log('✅ PRODUCT_LIST.md (Markdown) updated.');
    console.log('✅ PRODUCT_LIST.csv (Excel) created successfully.');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

start();
