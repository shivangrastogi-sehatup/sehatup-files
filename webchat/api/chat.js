// POST /api/chat - one turn of the on-site chat panel, streamed back as SSE.
//
// Request:  { sessionId, messages: [{ role: 'user'|'model', text }], page: { url, title, productHandle } }
// Response: event: delta  { t }            text fragments, markers already stripped
//           event: done   { products, handoff, blocked }
//           event: error  { message }
//
// GET /api/chat returns a config/health summary with no secrets in it, which is the
// quickest way to tell a misconfigured deploy from a broken one.

import { getCatalog, cardIndex } from './_lib/catalog.js';
import { buildSystemPrompt } from './_lib/prompt.js';
import { streamReply, isConfigured, transportName } from './_lib/gemini.js';
import { checkLimit, clientIp } from './_lib/ratelimit.js';
import { logTurn, probeLogging } from './_lib/log.js';
import { createMarkerFilter, resolveMarkers } from './_lib/markers.js';

const WA_NUMBER = (process.env.WHATSAPP_NUMBER || '919355539355').replace(/\D/g, '');
const MAX_HISTORY = 24;      // 12 exchanges the model re-reads; see healthDisclosures()
const MAX_TRANSCRIPT = 200;  // hard cap on what a client may send at all
const MAX_MESSAGE_CHARS = 1000;

const ALLOWED_ORIGINS = [
  'https://sehatup.com',
  'https://www.sehatup.com',
  `https://${process.env.SHOPIFY_DOMAIN || '0ec320-gj.myshopify.com'}`,
  ...(process.env.EXTRA_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
];

// Shopify serves the storefront from several hostnames depending on how you are looking
// at it: the live domain, the .myshopify.com admin domain, and a throwaway
// *.shopifypreview.com host for an unpublished theme. A theme is always tested on that
// last one before going live, so leaving it out blocks the only safe way to try changes.
const ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.myshopify\.com$/,
  /^https:\/\/[a-z0-9-]+\.shopifypreview\.com$/,
];

function applyCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    ORIGIN_PATTERNS.some((re) => re.test(origin));

  // Echoing the requested origin is the only thing a browser accepts; answering with a
  // different allowed origin reads as "blocked by CORS policy" and sends you hunting for
  // a server fault that is not there. Unknown origins get the canonical store URL, which
  // fails closed - deliberately, and visibly.
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : 'https://sehatup.com');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Gemini expects user and model turns to alternate, and the widget can legitimately hand
// us two user turns in a row: the visitor sends a message, navigates or closes the tab
// before the reply lands, and comes back to a transcript with no model turn in between.
// Merging is right rather than dropping - both messages are things the visitor actually
// said, and the second usually only makes sense given the first.
function collapseRoles(messages) {
  const out = [];
  for (const m of messages) {
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) prev.text = `${prev.text}\n${m.text}`;
    else out.push({ ...m });
  }
  // A history that opens on a model turn (the greeting, if it ever got persisted) is also
  // invalid, so drop any leading model turns.
  while (out.length && out[0].role === 'model') out.shift();
  return out;
}

function waLink(history, page) {
  const lastUser = [...history].reverse().find((m) => m.role === 'user')?.text || '';
  const lines = ['Hi SehatUP team, I was chatting on your website.'];
  if (lastUser) lines.push(`My question: ${lastUser.slice(0, 300)}`);
  if (page?.url) lines.push(`Page: ${page.url}`);
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: isConfigured(),
      model: transportName(),
      transcriptLogging: await probeLogging(),
      whatsappNumber: WA_NUMBER,
      catalogReachable: await getCatalog().then((p) => p.length).catch((e) => `error: ${e.message}`),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const started = Date.now();
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const sessionId = String(body.sessionId || '').slice(0, 64);
  const page = body.page || {};
  // Whitelisted, never trusted as free text: this string is interpolated into the system
  // prompt, so anything but these two values is treated as not knowing.
  const gender = (body.gender === 'male' || body.gender === 'female') ? body.gender : null;

  // Capped before anything reads it. The client is the only source of history on a public
  // endpoint, so "however many messages you send me" is an unbounded input: without this,
  // a scripted POST of 50,000 turns is scanned in full by healthDisclosures() and held in
  // memory. MAX_TRANSCRIPT is far past any real conversation - the widget's own session
  // cap is lower - so a legitimate visitor never reaches it.
  const allMessages = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-MAX_TRANSCRIPT)
    .filter((m) => m && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      text: m.text.slice(0, MAX_MESSAGE_CHARS),
    }));

  // The window caps what the model re-reads each turn; disclosures are scanned over the
  // whole conversation so an early one cannot scroll out of view.
  const history = collapseRoles(
    allMessages
      .slice(-MAX_HISTORY)
  );

  if (!history.length || history[history.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'messages must end with a user turn' });
  }

  const limit = checkLimit(clientIp(req), sessionId);
  if (!limit.ok) {
    if (limit.retryAfter) res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: limit.reason });
  }

  if (!isConfigured()) {
    return res.status(500).json({ error: 'Gemini is not configured on this deployment' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let replyText = '';
  let cards = {};
  const filter = createMarkerFilter(
    (t) => {
      replyText += t;
      send('delta', { t });
    },
    // Inline markers become the product's name rather than a hole in the sentence.
    (handle) => cards[handle]?.title || ''
  );

  try {
    const products = await getCatalog();
    cards = cardIndex(products);
    const system = buildSystemPrompt(products, page, allMessages, gender);

    const result = await streamReply(system, history, (chunk) => filter.push(chunk));
    const markers = filter.end();

    // resolveMarkers validates every handle against the live catalog, so a hallucinated
    // product, a prescription handle or a sold-out item never becomes a card. The prompt
    // asks for that; this is what guarantees it.
    // Handles carded in the last two assistant turns. Anything still visible that close
    // above does not need showing again.
    const recentlyShown = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && (m.role === 'model' || m.role === 'assistant'))
      .slice(-2)
      .flatMap((m) => (Array.isArray(m.products) ? m.products : []))
      .filter((h) => typeof h === 'string');

    const { products: shown, handoff: wantsHandoff, consult: wantsConsult, askGender } =
      resolveMarkers(markers, cards, 3, recentlyShown);

    // Asked at most once, and never once we already know. The prompt says so too, but a
    // model that re-asks something the visitor already answered reads as not listening -
    // which is the exact complaint that started this - so it is enforced here.
    const genderAlreadyAsked = (Array.isArray(body.messages) ? body.messages : [])
      .some((m) => m && (m.role === 'model' || m.role === 'assistant') && m.askGender);
    const wantGender = askGender && !gender && !genderAlreadyAsked;
    let handoff = wantsHandoff;

    // The consultation offer is once per conversation, not once per reply. The model
    // is told this too, but a prompt is a request and this is the guarantee - the same
    // reason recentlyShown exists for cards. An offer repeated every turn stops being
    // an offer and becomes nagging.
    const consultAlreadyOffered = (Array.isArray(body.messages) ? body.messages : [])
      .some((m) => m && (m.role === 'model' || m.role === 'assistant') && m.consult);
    const consult = wantsConsult && !consultAlreadyOffered;

    if (result.blocked && !replyText.trim()) {
      const fallback = 'Ye sawaal main theek se samajh nahi payi. Aap thoda aur bata dijiye, ' +
        'ya main team se connect kara deti hu.';
      send('delta', { t: fallback });
      replyText = fallback;
      handoff = true;
    }

    send('done', {
      products: shown,
      handoff: handoff ? { url: waLink(history, page), label: 'Chat with our team' } : null,
      consult: consult,
      askGender: wantGender,
      blocked: result.blocked,
    });

    // Awaited on purpose: a serverless instance can be frozen the moment the response
    // ends, so a fire-and-forget write here would be dropped roughly at random.
    await logTurn(sessionId, {
      turnIndex: Math.floor((history.length - 1) / 2),
      sessionStartedAt: body.sessionStartedAt,
      user: history[history.length - 1].text,
      reply: replyText,
      products: shown.map((p) => p.handle),
      handedOff: handoff,
      consultOffered: consult,
      gender: gender || 'unknown',
      page,
      model: transportName(),
      latencyMs: Date.now() - started,
      blocked: result.blocked,
    });

    res.end();
  } catch (e) {
    console.error('[webchat] turn failed:', e);
    if (!replyText) {
      send('delta', {
        t: 'Sorry, abhi thodi technical dikkat aa rahi hai. Aap team se seedha baat kar sakte hain.',
      });
    }
    send('done', {
      products: [],
      handoff: { url: waLink(history, page), label: 'Chat with our team' },
      consult: false,
      askGender: false,
      error: true,
    });
    res.end();
  }
}
