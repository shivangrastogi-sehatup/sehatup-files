// Service-account auth for server-side Google API calls (Vertex AI + Firestore REST).
//
// Ported from sehatup-analytics/api/_lib/google-auth.js. Same JWT-sign-then-exchange
// flow; the only differences are that the default scope here is cloud-platform (Vertex
// needs it) and that GCP_SERVICE_ACCOUNT is accepted as an env name alongside the
// Firebase one, because this project talks to Vertex first and Firestore second.
//
// Which key is used depends on which service is being called - see loadCredentials():
//
//   GCP_SERVICE_ACCOUNT        Vertex AI. Needs roles/aiplatform.user.
//                              On sehatup-f96b5 that is n8n-vertexai@.
//   FIRESTORE_SERVICE_ACCOUNT  Transcript logging. Needs roles/datastore.user.
//                              On sehatup-f96b5 that is firebase-adminsdk-fbsvc@.
//
// Set only GCP_SERVICE_ACCOUNT and both fall back to it, which is right when one account
// holds both roles. Values may be raw JSON or base64. FIREBASE_CLIENT_EMAIL plus
// FIREBASE_PRIVATE_KEY is also accepted as a two-field alternative.

import crypto from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

// Keyed by scope: Vertex and Firestore hold different tokens at the same time.
const cache = new Map();

// This project talks to two Google services, and on sehatup-f96b5 the two service accounts
// that exist have complementary, non-overlapping permissions:
//
//   firebase-adminsdk-fbsvc  Firestore yes, Vertex no
//   n8n-vertexai             Vertex yes, Firestore no
//
// So one key cannot serve both. Rather than widening either account's roles - n8n's
// production WhatsApp bot depends on one of them - each service picks its own key, and
// falls back to the shared one when only a single key is configured.
function loadCredentials(scope) {
  const wantsFirestore = String(scope || '').includes('datastore');

  const raw = (wantsFirestore
    ? process.env.FIRESTORE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.GCP_SERVICE_ACCOUNT
    : process.env.GCP_SERVICE_ACCOUNT || process.env.VERTEX_SERVICE_ACCOUNT ||
      process.env.FIREBASE_SERVICE_ACCOUNT
  ) || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

  if (raw.trim()) {
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      // Some dashboards mangle raw JSON, so base64 is a common workaround - accept it.
      try { parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); } catch (_) { /* fall through */ }
    }
    if (parsed?.client_email && parsed?.private_key) {
      return {
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
        projectId: parsed.project_id || '',
      };
    }
    throw new Error('A service-account env var is set but is not valid JSON');
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return { clientEmail, privateKey, projectId: process.env.GCP_PROJECT_ID || '' };
  }
  return null;
}

// Env vars flatten real newlines into the two characters \ and n - PEM parsing fails
// unless they are restored.
const normalizeKey = (k) => String(k).split('\\n').join('\n').trim();

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export function hasServiceAccount(scope) {
  try { return Boolean(loadCredentials(scope)); } catch (_) { return false; }
}

/** project_id straight off the key file, so the deploy only needs one env var. */
export function serviceAccountProjectId(scope) {
  try { return loadCredentials(scope)?.projectId || ''; } catch (_) { return ''; }
}

/** OAuth2 access token for `scope`, cached until ~2 minutes before it expires. */
export async function getAccessToken(scope = DEFAULT_SCOPE) {
  const hit = cache.get(scope);
  if (hit && Date.now() < hit.expiresAt) return hit.token;

  const creds = loadCredentials(scope);
  if (!creds) {
    throw new Error(
      'No service account configured - set GCP_SERVICE_ACCOUNT to the JSON key of a ' +
      'service account with roles/aiplatform.user on the Vertex project'
    );
  }

  const iat = Math.floor(Date.now() / 1000);
  const signingInput =
    `${b64url({ alg: 'RS256', typ: 'JWT' })}.` +
    `${b64url({ iss: creds.clientEmail, scope, aud: TOKEN_URL, iat, exp: iat + 3600 })}`;

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

  const entry = {
    token: j.access_token,
    expiresAt: Date.now() + (Number(j.expires_in || 3600) - 120) * 1000,
  };
  cache.set(scope, entry);
  return entry.token;
}
