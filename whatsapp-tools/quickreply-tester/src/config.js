// How the tester works now:
//
//  The 24h WhatsApp window can only be opened by a REAL inbound message from the
//  customer's phone → the business number. No API can do that. So the tester
//  redirects the user into WhatsApp (wa.me deep link) to say "Hi" themselves;
//  that real message opens the window and starts the n8n flow. The tester then
//  just LISTENS to conversations/{convId}/messages to detect the bridge and
//  render the live chat.
//
//  N8N_WEBHOOK_URL is still used by the composer to send follow-up customer
//  messages (USER_TEXT) without leaving the page. The opener is NOT auto-sent.

export const N8N_WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || "";

// The business WhatsApp number the user is sent to (digits only, E.164 without +).
export const BUSINESS_WHATSAPP =
  import.meta.env.VITE_BUSINESS_WHATSAPP || "919355539355";

// Display name for the conversation partner (the bot/business) in the chat header.
export const BOT_NAME = import.meta.env.VITE_BOT_NAME || "SehatUp";

// Optional shared key — only needed if you set QR_TESTER_KEY in functions/.env.
export const TESTER_KEY = import.meta.env.VITE_QR_TESTER_KEY || "";

// Unified store the n8n flow + Cloud Function now write to (was "qr_conversations").
export const CONVERSATIONS_COLLECTION =
  import.meta.env.VITE_CONVERSATIONS_COLLECTION || "conversations";

// Fixed country code — the +91 prefix is not editable in the UI.
export const COUNTRY_CODE = "91";

// WhatsApp 24h session window length, in milliseconds.
export const WINDOW_MS = 24 * 60 * 60 * 1000;
