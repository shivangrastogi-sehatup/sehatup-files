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
                    // Forward safe response headers. 'link' is REQUIRED for cursor
                    // pagination — getAllOrders reads it to follow rel="next"; without
                    // it, only the first page (250 orders) ever loads.
                    ['content-type', 'x-shopify-shop-api-call-limit', 'link'].forEach(h => {
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
        const getUrl = process.env.GOOGLE_SHEET_URL || process.env.DEFAULT_GSCRIPT_URL;
        const postUrl = process.env.DEFAULT_GSCRIPT_URL;

        if (req.method === 'GET') {
            if (!getUrl) {
                return res.status(500).json({ error: 'GOOGLE_SHEET_URL or DEFAULT_GSCRIPT_URL is not configured' });
            }
            console.log(`[Proxy] Fetching leads from GOOGLE_SHEET_URL: ${getUrl}`);
            fetch(getUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            })
                .then(async response => {
                    const contentType = response.headers.get('content-type') || '';
                    console.log(`[Proxy] Response status: ${response.status}, Content-Type: ${contentType}`);
                    const text = await response.text();
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
                    }
                    if (text.trim().toLowerCase().startsWith('<html') || text.trim().toLowerCase().startsWith('<!doctype')) {
                        console.log('[Proxy] Error: Received HTML instead of CSV! Content preview:', text.substring(0, 500));
                    }
                    return text;
                })
                .then(csvData => {
                    res.setHeader('Content-Type', 'text/csv');
                    res.status(200).send(csvData);
                })
                .catch(error => {
                    console.error('[Proxy] Fetch leads failed:', error);
                    res.status(500).json({ error: error.message });
                });
        } else if (req.method === 'POST') {
            if (!postUrl) {
                return res.status(500).json({ error: 'DEFAULT_GSCRIPT_URL is not configured' });
            }
            if (postUrl.includes('docs.google.com/spreadsheets')) {
                return res.status(200).json({ skipped: true, message: 'Default sync skipped (CSV URL configured)' });
            }
            // Collect request body
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => {
                const bodyStr = Buffer.concat(chunks).toString();
                fetch(postUrl, {
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

    // Pincode lookup proxy — avoids CORS issues with external APIs in deployed env
    // Uses https module (not fetch) to support Node.js < 18
    const httpsGet = (url, options = {}) => new Promise((resolve, reject) => {
        const reqOptions = { ...options };
        // postalpincode.in has an intermittently expired SSL cert — skip verification for it
        if (url.includes('postalpincode.in')) reqOptions.rejectUnauthorized = false;
        https.get(url, reqOptions, (resp) => {
            // Follow redirects
            if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
                return httpsGet(resp.headers.location, options).then(resolve).catch(reject);
            }
            let data = '';
            resp.on('data', chunk => { data += chunk; });
            resp.on('end', () => {
                try { resolve({ ok: resp.statusCode === 200, status: resp.statusCode, json: () => JSON.parse(data) }); }
                catch (e) { reject(new Error(`JSON parse error: ${e.message} — body: ${data.slice(0, 100)}`)); }
            });
        }).on('error', reject);
    });

    app.use('/api/pincode', async (req, res) => {
        const pin = req.url.replace(/^\//,'').split('?')[0].trim();
        if (!/^\d{6}$/.test(pin)) {
            return res.status(400).json({ error: 'Invalid pincode' });
        }
        try {
            // Primary: postalpincode.in — rich India data, but has SSL issues; rejectUnauthorized=false handles it
            let resolved = null;
            try {
                const primary = await httpsGet(`https://api.postalpincode.in/pincode/${pin}`);
                const primaryData = primary.json();
                if (primaryData?.[0]?.Status === 'Success' && primaryData[0].PostOffice?.length) {
                    resolved = primaryData;
                }
            } catch (e) {
                console.warn('[Pincode Proxy] postalpincode.in failed:', e.message);
            }

            if (resolved) return res.status(200).json(resolved);

            // Fallback: zippopotam.us (valid SSL, global coverage)
            const fallback = await httpsGet(`https://api.zippopotam.us/in/${pin}`);
            if (fallback.ok) {
                const fallbackData = fallback.json();
                return res.status(200).json({ _source: 'zippopotam', ...fallbackData });
            }

            return res.status(404).json({ error: 'Pincode not found' });
        } catch (err) {
            console.error('[Pincode Proxy] Error:', err.message);
            res.status(500).json({ error: err.message });
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
