// Transcript logging to Firestore over REST.
//
// Why REST and not firebase-admin: this function has to cold-start fast and the admin SDK
// is a heavy dependency for two writes. The same service account that calls Vertex can
// call Firestore, it just needs a token on the datastore scope.
//
// Entirely optional. If FIRESTORE_PROJECT_ID is unset, logging is a no-op and the chat
// still works - transcripts are how you improve the bot, not how you serve a reply, so a
// Firestore outage must never surface to a visitor.

import { getAccessToken, hasServiceAccount, serviceAccountProjectId } from './google-auth.js';

const DATASTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const COLLECTION = process.env.FIRESTORE_COLLECTION || 'web_chats';

function projectId() {
  return process.env.FIRESTORE_PROJECT_ID || process.env.GCP_PROJECT_ID || serviceAccountProjectId();
}

/** Whether logging is CONFIGURED. Says nothing about whether it is permitted. */
export function loggingEnabled() {
  return Boolean(projectId() && hasServiceAccount());
}

/**
 * Actually try Firestore and report what came back.
 *
 * loggingEnabled() only checks that env vars exist, which is how transcript logging ran
 * for days reporting "true" while every write was rejected with PERMISSION_DENIED and
 * swallowed by logTurn's catch. A health check that reports a capability it has not
 * exercised is worse than no health check - it actively hides the outage.
 */
export async function probeLogging() {
  if (!loggingEnabled()) return 'off (not configured)';
  const project = projectId();
  try {
    const token = await getAccessToken(DATASTORE_SCOPE);
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${COLLECTION}?pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (r.ok) return 'ok';
    const j = await r.json().catch(() => null);
    const reason = j?.error?.status || r.status;
    return `FAILING (${reason}) - grant roles/datastore.user to the service account`;
  } catch (e) {
    return `FAILING (${e.message.slice(0, 80)})`;
  }
}

// Firestore REST wants every value tagged with its type.
const val = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };
  return { stringValue: String(v) };
};

/**
 * Appends one exchange to web_chats/{sessionId}/turns. Never throws.
 * The caller should NOT await this on the response path.
 */
export async function logTurn(sessionId, turn) {
  if (!loggingEnabled() || !sessionId) return;

  const project = projectId();
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;

  try {
    const token = await getAccessToken(DATASTORE_SCOPE);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // The parent doc carries the fields you actually want to filter a dashboard on, so
    // it is rewritten every turn rather than only created once.
    await fetch(
      `${base}/${COLLECTION}/${encodeURIComponent(sessionId)}?` +
      ['lastMessageAt', 'turnCount', 'lastPage', 'handedOff', 'firstSeenAt',
       'trafficSource', 'utmCampaign', 'landingPage']
        .map((f) => `updateMask.fieldPaths=${f}`).join('&'),
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          fields: {
            lastMessageAt: { timestampValue: new Date().toISOString() },
            turnCount: val(turn.turnIndex + 1),
            lastPage: val(turn.page?.url || ''),
            // Written on the parent doc, not per turn: a session has one origin, and
            // reporting "chats by traffic source" should not mean unpacking a subcollection.
            trafficSource: val(turn.page?.attribution?.traffic_source || ''),
            utmCampaign: val(turn.page?.attribution?.utm_campaign || ''),
            landingPage: val(turn.page?.attribution?.landing_page || ''),
            handedOff: val(Boolean(turn.handedOff)),
            firstSeenAt: { timestampValue: new Date(turn.sessionStartedAt || Date.now()).toISOString() },
          },
        }),
      }
    );

    await fetch(`${base}/${COLLECTION}/${encodeURIComponent(sessionId)}/turns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: {
          at: { timestampValue: new Date().toISOString() },
          turnIndex: val(turn.turnIndex),
          user: val(turn.user),
          reply: val(turn.reply),
          products: val(turn.products || []),
          handedOff: val(Boolean(turn.handedOff)),
          page: val(turn.page?.url || ''),
          model: val(turn.model || ''),
          latencyMs: val(turn.latencyMs || 0),
          blocked: val(Boolean(turn.blocked)),
        },
      }),
    });
  } catch (e) {
    // Deliberately swallowed. A logging failure is not the visitor's problem.
    console.error('[webchat] transcript log failed:', e.message);
  }
}
