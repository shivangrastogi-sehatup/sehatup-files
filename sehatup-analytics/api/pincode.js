// api/pincode.js
// Vercel Serverless Function — pincode → city/district/state lookup.
// Call as: /api/pincode?pin=262001
//
// OFFLINE-FIRST: resolves from a bundled all-India dataset (api/_data/pincodes.json,
// ~24k pincodes, from the India Post directory) — fast, reliable, accurate CITY.
// Falls back to the external APIs (postalpincode.in / zippopotam.us) only for the
// rare pincode missing from the dataset.

const https = require('https');
// Static require so Vercel traces + bundles the JSON with the function.
const DB = require('./_data/pincodes.json');

const httpsGet = (url, rejectUnauthorized = true) =>
  new Promise((resolve, reject) => {
    const opts = Object.assign(require('url').parse(url), { rejectUnauthorized });
    https.get(opts, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        return httpsGet(resp.headers.location, rejectUnauthorized).then(resolve).catch(reject);
      }
      let raw = '';
      resp.on('data', c => { raw += c; });
      resp.on('end', () => resolve({ status: resp.statusCode, body: raw }));
    }).on('error', reject);
  });

// Build the postalpincode.in-compatible shape from a dataset entry.
// Each PostOffice carries District (real district) AND City (shipping city).
function offlineShape(pin, e) {
  const names = (e.o && e.o.length) ? e.o : [e.c || e.d].filter(Boolean);
  const PostOffice = names.map(name => ({
    Name: name,
    District: e.d || '',
    City: e.c || '',
    State: e.s || '',
    Country: 'India',
    Pincode: pin,
  }));
  return [{
    Message: `Number of pincode(s) found:${PostOffice.length}`,
    Status: 'Success',
    _source: 'offline',
    PostOffice,
  }];
}

module.exports = async function handler(req, res) {
  const pin = (req.query.pin || '').trim();

  if (!pin || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: 'Invalid pincode. Must be exactly 6 digits.' });
  }

  // --- Offline dataset (primary) ---
  const entry = DB[pin];
  if (entry) {
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate');
    return res.status(200).json(offlineShape(pin, entry));
  }

  // --- Fallback 1: api.postalpincode.in (rejectUnauthorized:false for expired cert) ---
  try {
    const { status, body } = await httpsGet(`https://api.postalpincode.in/pincode/${pin}`, false);
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

  // --- Fallback 2: api.zippopotam.us (valid cert) ---
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
