export default async function handler(req, res) {
    const url = process.env.DEFAULT_GSCRIPT_URL;
    if (!url) {
        return res.status(500).json({ error: 'DEFAULT_GSCRIPT_URL is not configured' });
    }

    if (req.method === 'GET') {
        try {
            const response = await fetch(url);
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
        // If the configured URL is a Google Sheets URL (not a script), POST is not supported.
        if (url.includes('docs.google.com/spreadsheets')) {
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
            const response = await fetch(url, {
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
