const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    app.use(
        '/api-sehatup',
        createProxyMiddleware({
            target: 'https://sehatup.com',
            changeOrigin: true,
            pathRewrite: {
                '^/api-sehatup': '',
            },
        })
    );

    app.use(
        '/api-shorten-tiny',
        createProxyMiddleware({
            target: 'https://tinyurl.com',
            changeOrigin: true,
            pathRewrite: {
                '^/api-shorten-tiny': '',
            },
        })
    );

    app.use(
        '/api-shorten-isgd',
        createProxyMiddleware({
            target: 'https://is.gd',
            changeOrigin: true,
            pathRewrite: {
                '^/api-shorten-isgd': '',
            },
        })
    );

    app.use(
        '/api-shorten-vgd',
        createProxyMiddleware({
            target: 'https://v.gd',
            changeOrigin: true,
            pathRewrite: {
                '^/api-shorten-vgd': '',
            },
        })
    );

    app.use(
        '/api-shorten-ulvis',
        createProxyMiddleware({
            target: 'https://ulvis.net',
            changeOrigin: true,
            pathRewrite: {
                '^/api-shorten-ulvis': '',
            },
        })
    );

    app.use(
        '/api-shorten-chilp',
        createProxyMiddleware({
            target: 'https://chilp.it',
            changeOrigin: true,
            pathRewrite: {
                '^/api-shorten-chilp': '',
            },
        })
    );

    app.use(
        '/api-shopify',
        createProxyMiddleware({
            target: 'https://0ec320-gj.myshopify.com',
            changeOrigin: true,
            pathRewrite: {
                '^/api-shopify': '',
            },
            headers: {
                'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'SehatUp-CRM'
            },
            onProxyRes: function (proxyRes) {
                delete proxyRes.headers['www-authenticate'];
            },
            onProxyReq: (proxyReq) => {
                proxyReq.setHeader('X-Shopify-Access-Token', process.env.SHOPIFY_ACCESS_TOKEN || '');
            }
        })
    );

    app.use(
        '/api-sehatup',
        createProxyMiddleware({
            target: 'https://sehatup.com',
            changeOrigin: true,
            pathRewrite: {
                '^/api-sehatup': '',
            }
        })
    );
};
