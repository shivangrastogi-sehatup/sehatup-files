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
                    if (apiPath.includes('shipping_zones')) {
                        console.log(`    [SHIPPING_ZONES] body: ${responseBody.substring(0, 3000)}`);
                    }
                    if (apiPath.includes('graphql')) {
                        console.log(`    [GRAPHQL] body: ${responseBody.substring(0, 3000)}`);
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
    // Local development proxy for /api/leads
    app.use('/api/leads', (req, res) => {
        const url = process.env.DEFAULT_GSCRIPT_URL;
        if (!url) {
            return res.status(500).json({ error: 'DEFAULT_GSCRIPT_URL is not configured' });
        }

        if (req.method === 'GET') {
            fetch(url)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.text();
                })
                .then(csvData => {
                    res.setHeader('Content-Type', 'text/csv');
                    res.status(200).send(csvData);
                })
                .catch(error => {
                    res.status(500).json({ error: error.message });
                });
        } else if (req.method === 'POST') {
            if (url.includes('docs.google.com/spreadsheets')) {
                return res.status(200).json({ skipped: true, message: 'Default sync skipped (CSV URL configured)' });
            }
            // Collect request body
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => {
                const bodyStr = Buffer.concat(chunks).toString();
                fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: bodyStr
                })
                .then(response => response.text())
                .then(data => res.status(200).send(data))
                .catch(error => res.status(500).json({ error: error.message }));
            });
        } else {
            res.status(405).json({ error: 'Method Not Allowed' });
        }
    });

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
