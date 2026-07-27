// Service-account auth for server-side Google API calls (Firestore REST).
//
// Why this exists: `?key=FIREBASE_WEB_API_KEY` identifies the PROJECT, not a user, so
// Firestore evaluates `request.auth` as null. The rules in sehatup-firebase/firestore.rules
// allow unauthenticated WRITES (that's how the Nimbus webhook works) but require
// `request.auth != null` to READ — which is why every read from a Vercel function was
// coming back 403 PERMISSION_DENIED.
//
// A service account is a real principal: we sign a JWT with its private key, swap that
// for an OAuth access token, and send it as a Bearer header. Service accounts bypass
// security rules entirely, so reads work without loosening any rule.
//
// Setup (one time):
//   Firebase Console → Project settings → Service accounts → Generate new private key
//   → paste the whole JSON file into the Vercel env var FIREBASE_SERVICE_ACCOUNT
//
// Accepted env formats:
//   FIREBASE_SERVICE_ACCOUNT  – the full JSON (raw or base64)
//   FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY – the two fields separately

import crypto from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/datastore';

let cached = { token: null, expiresAt: 0, scope: null };

function loadCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (raw.trim()) {
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      // Some dashboards mangle raw JSON, so base64 is a common workaround — accept it.
      try { parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); } catch (_) { /* fall through */ }
    }
    if (parsed?.client_email && parsed?.private_key) {
      return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
    }
    throw new Error('FIREBASE_SERVICE_ACCOUNT is set but is not valid service-account JSON');
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && privateKey) return { clientEmail, privateKey };
  return null;
}

// Env vars flatten real newlines into the two characters \ and n — PEM parsing fails
// unless they are restored.
const normalizeKey = (k) => String(k).replace(/\\n/g, '\n').trim();

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export function hasServiceAccount() {
  try { return Boolean(loadCredentials()); } catch (_) { return false; }
}

/**
 * OAuth2 access token for the given scope, cached until ~2 minutes before it expires.
 * Throws with an actionable message when the service account isn't configured.
 */
export async function getAccessToken(scope = DEFAULT_SCOPE) {
  if (cached.token && cached.scope === scope && Date.now() < cached.expiresAt) return cached.token;

  const creds = loadCredentials();
  if (!creds) {
    throw new Error(
      'No service account configured — set FIREBASE_SERVICE_ACCOUNT (Firebase Console → ' +
      'Project settings → Service accounts → Generate new private key)'
    );
  }

  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    iss: creds.clientEmail,
    scope,
    aud: TOKEN_URL,
    iat,
    exp: iat + 3600,
  };
  const signingInput = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(payload)}`;

  let signature;
  try {
    signature = crypto
      .createSign('RSA-SHA256')
      .update(signingInput)
      .sign(normalizeKey(creds.privateKey))
      .toString('base64url');
  } catch (e) {
    throw new Error(`Could not sign JWT with the service-account private key: ${e.message}`);
  }

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${signature}`,
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.access_token) {
    throw new Error(`Token exchange failed (${r.status}): ${j?.error_description || j?.error || 'unknown'}`);
  }

  cached = {
    token: j.access_token,
    scope,
    expiresAt: Date.now() + (Number(j.expires_in || 3600) - 120) * 1000,
  };
  return cached.token;
}

/** `Authorization` header ready to spread into a fetch call. */
export async function authHeader(scope = DEFAULT_SCOPE) {
  return { Authorization: `Bearer ${await getAccessToken(scope)}` };
}
