const { createProxyMiddleware } = require('http-proxy-middleware');
const https = require('https');
require('dotenv').config();

module.exports = function (app) {
    const SHOPIFY_HOSTNAME = '0ec320-gj.myshopify.com';
    const STOREFRONT_TARGET = 'https://sehatup.com';
    const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
    const API_VERSION = '2024-01';

    console.log('--- Proxy Config Initialized ---');
    console.log('Shopify Hostname:', SHOPIFY_HOSTNAME);
    console.log('API Version:', API_VERSION);
    console.log('Token Length:', TOKEN.length);
    console.log('Token Preview:', TOKEN ? TOKEN.substring(0, 8) + '...' : 'MISSING');

    // Shopify Admin API — raw HTTPS (no redirect-following, full control)
    app.use('/shopify-v2', (req, res) => {
        const apiPath = `/admin/api/${API_VERSION}${req.url}`;
        console.log(`>>> [Shopify] ${req.method} https://${SHOPIFY_HOSTNAME}${apiPath}`);

        // Collect request body (needed for POST/PUT)
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            const bodyBuf = Buffer.concat(chunks);
            const bodyStr = bodyBuf.toString();

            const reqHeaders = {
                'X-Shopify-Access-Token': TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Host': SHOPIFY_HOSTNAME,
            };
            if (bodyBuf.length > 0) {
                reqHeaders['Content-Length'] = bodyBuf.length;
            }

            const options = {
                hostname: SHOPIFY_HOSTNAME,
                path: apiPath,
                method: req.method,
                headers: reqHeaders,
            };

            const proxyReq = https.request(options, (proxyRes) => {
                const resChunks = [];
                proxyRes.on('data', c => resChunks.push(c));
                proxyRes.on('end', () => {
                    const responseBody = Buffer.concat(resChunks).toString();
                    console.log(`<<< [Shopify] ${proxyRes.statusCode} Content-Type: ${proxyRes.headers['content-type']}`);
                    if (proxyRes.statusCode !== 200) {
                        console.log(`    Response body (first 300 chars): ${responseBody.substring(0, 300)}`);
                    }
                    res.status(proxyRes.statusCode);
                    // Forward safe response headers
                    ['content-type', 'x-shopify-shop-api-call-limit'].forEach(h => {
                        if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]);
                    });
                    res.send(responseBody);
                });
            });

            proxyReq.on('error', (err) => {
                console.error('[Shopify HTTPS Error]:', err.message);
                res.status(500).json({ error: err.message });
            });

            if (bodyBuf.length > 0) proxyReq.write(bodyBuf);
            proxyReq.end();
        });
    });

    // SehatUp Storefront Proxy (search, products)
    app.use(
        '/api-sehatup',
        createProxyMiddleware({
            target: STOREFRONT_TARGET,
            changeOrigin: true,
            pathRewrite: { '^/api-sehatup': '' },
        })
    );

    // URL shortener proxies
    const shorteners = {
        'tiny': 'https://tinyurl.com',
        'isgd': 'https://is.gd',
        'vgd': 'https://v.gd',
        'ulvis': 'https://ulvis.net',
        'chilp': 'https://chilp.it',
    };
    Object.entries(shorteners).forEach(([key, target]) => {
        app.use(`/api-shorten-${key}`, createProxyMiddleware({
            target,
            changeOrigin: true,
            pathRewrite: { [`^/api-shorten-${key}`]: '' },
        }));
    });
};
