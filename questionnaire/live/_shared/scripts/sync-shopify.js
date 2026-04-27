// sync-shopify.js
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from User
const SHOPIFY_DOMAIN = '0ec320-gj.myshopify.com';
const ACCESS_TOKEN = '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';
const API_VERSION = '2026-01';

const TARGET_FILE = path.resolve(__dirname, '..', 'mock-products.js');

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

function formatProducts(products) {
  const formatted = {};
  
  products.forEach(p => {
    const variants = {};
    p.variants.forEach(v => {
      // Convert "499.00" to 49900 (cents)
      const priceCents = Math.round(parseFloat(v.price) * 100);
      const compareCents = v.compare_at_price ? Math.round(parseFloat(v.compare_at_price) * 100) : null;
      
      variants[v.id] = {
        price: priceCents,
        compareAtPrice: compareCents,
        available: v.inventory_management === null || v.inventory_quantity > 0,
        inventory_quantity: v.inventory_quantity || 0
      };
    });

    formatted[p.handle] = {
      title: p.title,
      featuredImage: p.image ? p.image.src : (p.images && p.images.length > 0 ? p.images[0].src : ''),
      url: `/products/${p.handle}`,
      variants: variants
    };
  });

  return formatted;
}

async function sync() {
  console.log(`🚀 Starting Shopify Sync for ${SHOPIFY_DOMAIN}...`);
  try {
    const products = await fetchProducts();
    console.log(`📦 Fetched ${products.length} products.`);
    
    const formatted = formatProducts(products);
    
    const fileContent = `/**
 * AUTO-GENERATED Shopify Product Data.
 * Generated on: ${new Date().toISOString()}
 * Source: ${SHOPIFY_DOMAIN}
 */
export const mockShopifyProducts = ${JSON.stringify(formatted, null, 2)};
`;

    fs.writeFileSync(TARGET_FILE, fileContent);
    console.log(`✅ Successfully updated ${TARGET_FILE}`);
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
  }
}

sync();
