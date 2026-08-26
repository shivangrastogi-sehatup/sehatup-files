// Gemini transport. Talks to Vertex AI by default, because that is where the WhatsApp
// bot's billing and quota already live (project sehatup-f96b5, us-central1). Set
// GEMINI_API_KEY instead and it switches to the AI Studio endpoint, which is handy for
// local testing without a service-account key on disk.
//
// Deliberately a BASE model, not the tuned endpoint the WhatsApp flow uses. That tune was
// trained on WhatsApp transcripts: it writes in WhatsApp cadence and it over-steers every
// topic toward booking a consultation, which is wrong for a visitor who is already on the
// product page with their card out.

import { getAccessToken, hasServiceAccount, serviceAccountProjectId } from './google-auth.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';

// Sexual wellness and health are the core of this catalog, so the default safety filters
// will refuse perfectly ordinary questions ("timing problem", "erection", "period pain").
// The persona rules are what actually keep this bot safe - medical gating, no dosing,
// no prescription leakage - not a category classifier that cannot tell a customer
// asking about stamina from abuse.
const SAFETY = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT']
  .map((category) => ({ category, threshold: process.env.GEMINI_SAFETY || 'BLOCK_ONLY_HIGH' }));

function endpoint() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
      headers: { 'Content-Type': 'application/json' },
      mode: 'aistudio',
    };
  }

  const project = process.env.GCP_PROJECT_ID || serviceAccountProjectId();
  if (!project) {
    throw new Error('Set GEMINI_API_KEY, or GCP_SERVICE_ACCOUNT (plus GCP_PROJECT_ID if the key has no project_id)');
  }
  return {
    url: `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${project}/locations/${LOCATION}` +
         `/publishers/google/models/${MODEL}:streamGenerateContent?alt=sse`,
    headers: { 'Content-Type': 'application/json' },
    mode: 'vertex',
    needsToken: true,
  };
}

export function transportName() {
  return process.env.GEMINI_API_KEY ? `aistudio:${MODEL}` : `vertex:${MODEL}`;
}

export function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || hasServiceAccount());
}

/**
 * Streams the reply as plain text chunks.
 *
 * @param {string}   systemPrompt
 * @param {object[]} history   [{ role: 'user'|'model', text }]
 * @param {function} onChunk   called with each text fragment as it arrives
 * @returns {Promise<{ text: string, finishReason: string, blocked: boolean }>}
 */
export async function streamReply(systemPrompt, history, onChunk) {
  const ep = endpoint();
  const headers = { ...ep.headers };
  if (ep.needsToken) headers.Authorization = `Bearer ${await getAccessToken()}`;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: history.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.text || '').slice(0, 4000) }],
    })),
    generationConfig: {
      temperature: Number(process.env.GEMINI_TEMPERATURE || 0.7),
      topP: 0.95,
      // Replies are 1-3 short lines by design. A tight cap is a cost control and a
      // style control at once: the model cannot ramble into a paragraph.
      maxOutputTokens: Number(process.env.GEMINI_MAX_TOKENS || 400),
    },
    safetySettings: SAFETY,
  };

  const r = await fetch(ep.url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok || !r.body) {
    throw new Error(`Gemini ${ep.mode} ${r.status}: ${(await r.text()).slice(0, 400)}`);
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let finishReason = '';
  let blocked = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; a frame can carry several `data:` lines.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';

    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        let json;
        try { json = JSON.parse(payload); } catch (_) { continue; }

        if (json.promptFeedback?.blockReason) {
          blocked = true;
          finishReason = json.promptFeedback.blockReason;
        }

        const candidate = json.candidates?.[0];
        if (candidate?.finishReason) finishReason = candidate.finishReason;

        for (const part of candidate?.content?.parts || []) {
          if (typeof part.text !== 'string' || !part.text) continue;
          text += part.text;
          onChunk(part.text);
        }
      }
    }
  }

  if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') blocked = true;
  return { text, finishReason, blocked };
}
