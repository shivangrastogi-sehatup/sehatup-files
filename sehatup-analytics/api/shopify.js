export default async function handler(req, res) {
    const SHOPIFY_HOSTNAME = '0ec320-gj.myshopify.com';
    const API_VERSION = '2024-01';
    const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';

    // Extract the original path from the request URL
    // e.g. /shopify-v2/graphql.json -> /graphql.json
    const endpoint = req.url.replace('/shopify-v2', '').split('?')[0];
    const apiPath = `/admin/api/${API_VERSION}${endpoint}`;
    const url = `https://${SHOPIFY_HOSTNAME}${apiPath}`;

    try {
        const fetchOptions = {
            method: req.method,
            headers: {
                'X-Shopify-Access-Token': TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        };

        if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
            fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }

        const shopifyRes = await fetch(url, fetchOptions);
        const data = await shopifyRes.text();

        res.status(shopifyRes.status);
        ['content-type', 'x-shopify-shop-api-call-limit'].forEach(h => {
            if (shopifyRes.headers.get(h)) res.setHeader(h, shopifyRes.headers.get(h));
        });
        
        res.send(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
