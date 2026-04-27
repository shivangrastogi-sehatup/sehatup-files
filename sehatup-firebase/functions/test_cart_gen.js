const axios = require('axios');

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

const main = async () => {
    const input = [
        { name: "Amla", qty: 2 },
        { name: "Ashwagandha Extract", qty: 1 }
    ];
    console.log("Input:", input);
    const resolved = await resolveAllVariantIds(input);
    console.log("Resolved:", resolved);
};

main();
