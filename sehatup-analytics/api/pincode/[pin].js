// api/pincode/[pin].js
// Vercel Serverless Function — proxies pincode lookup to avoid CORS in the browser.
// Tries postalpincode.in first (rich India data), falls back to zippopotam.us.

export default async function handler(req, res) {
    const { pin } = req.query;

    if (!pin || !/^\d{6}$/.test(pin)) {
        return res.status(400).json({ error: 'Invalid pincode. Must be exactly 6 digits.' });
    }

    // --- Primary: api.postalpincode.in ---
    // This API has an intermittently expired SSL cert, so we catch errors gracefully.
    try {
        const primaryRes = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
        if (primaryRes.ok) {
            const data = await primaryRes.json();
            if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length) {
                res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate'); // cache for 24h
                return res.status(200).json(data);
            }
        }
    } catch (e) {
        console.warn(`[pincode] postalpincode.in failed for ${pin}:`, e.message);
    }

    // --- Fallback: api.zippopotam.us ---
    try {
        const fallbackRes = await fetch(`https://api.zippopotam.us/in/${pin}`);
        if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
            return res.status(200).json({ _source: 'zippopotam', ...data });
        }
    } catch (e) {
        console.warn(`[pincode] zippopotam.us failed for ${pin}:`, e.message);
    }

    return res.status(404).json({ error: `No data found for pincode ${pin}` });
}
