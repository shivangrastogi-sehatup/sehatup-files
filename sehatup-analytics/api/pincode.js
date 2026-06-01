// api/pincode.js
// Vercel Serverless Function — proxies pincode lookup server-side to avoid CORS.
// Call as: /api/pincode?pin=262001
// Uses Node https module (not fetch) so we can bypass the expired SSL cert on postalpincode.in.

const https = require('https');

const httpsGet = (url, rejectUnauthorized = true) =>
  new Promise((resolve, reject) => {
    const opts = Object.assign(require('url').parse(url), { rejectUnauthorized });
    https.get(opts, (resp) => {
      // Follow redirects
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        return httpsGet(resp.headers.location, rejectUnauthorized).then(resolve).catch(reject);
      }
      let raw = '';
      resp.on('data', c => { raw += c; });
      resp.on('end', () => resolve({ status: resp.statusCode, body: raw }));
    }).on('error', reject);
  });

module.exports = async function handler(req, res) {
  const pin = (req.query.pin || '').trim();

  if (!pin || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: 'Invalid pincode. Must be exactly 6 digits.' });
  }

  // --- Primary: api.postalpincode.in (rejectUnauthorized:false for expired cert) ---
  try {
    const { status, body } = await httpsGet(
      `https://api.postalpincode.in/pincode/${pin}`,
      false // bypass expired SSL cert
    );
    if (status === 200) {
      const data = JSON.parse(body);
      if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length) {
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
        return res.status(200).json(data);
      }
    }
  } catch (e) {
    console.warn(`[pincode] postalpincode.in failed for ${pin}:`, e.message);
  }

  // --- Fallback: api.zippopotam.us (valid cert) ---
  try {
    const { status, body } = await httpsGet(`https://api.zippopotam.us/in/${pin}`, true);
    if (status === 200) {
      const data = JSON.parse(body);
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
      return res.status(200).json({ _source: 'zippopotam', ...data });
    }
  } catch (e) {
    console.warn(`[pincode] zippopotam.us failed for ${pin}:`, e.message);
  }

  return res.status(404).json({ error: `No data found for pincode ${pin}` });
};
