export default async function handler(req, res) {
    const getUrl = process.env.GOOGLE_SHEET_URL || process.env.DEFAULT_GSCRIPT_URL;
    const postUrl = process.env.DEFAULT_GSCRIPT_URL;

    if (req.method === 'GET') {
        if (!getUrl) {
            return res.status(500).json({ error: 'GOOGLE_SHEET_URL or DEFAULT_GSCRIPT_URL is not configured' });
        }
        try {
            const response = await fetch(getUrl);
            if (!response.ok) {
                return res.status(response.status).json({ error: `Failed to fetch: ${response.statusText}` });
            }
            const csvData = await response.text();
            res.setHeader('Content-Type', 'text/csv');
            res.status(200).send(csvData);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else if (req.method === 'POST') {
        if (!postUrl) {
            return res.status(500).json({ error: 'DEFAULT_GSCRIPT_URL is not configured' });
        }
        // If the configured URL is a Google Sheets URL (not a script), POST is not supported.
        if (postUrl.includes('docs.google.com/spreadsheets')) {
            return res.status(200).json({ skipped: true, message: 'Default sync skipped (CSV URL configured)' });
        }
        try {
            // Read raw body if present
            let bodyStr = '';
            if (typeof req.body === 'string') {
                bodyStr = req.body;
            } else if (req.body) {
                bodyStr = JSON.stringify(req.body);
            }
            const response = await fetch(postUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: bodyStr,
            });
            const data = await response.text();
            res.status(response.status).send(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else {
        res.status(405).json({ error: 'Method Not Allowed' });
    }
}
