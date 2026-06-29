// Inbox Dashboard config.
//
//  This dashboard READS every conversation under qr_conversations/{phone} (the
//  same public-read collection the quickreply-tester watches for a single phone)
//  and lets you open any one of them.
//
//  "Reply" posts a USER_TEXT message to the n8n webhook for the selected phone —
//  exactly like the quickreply-tester's composer. That simulates the customer
//  typing, which drives the bot. (Sending a real AGENT reply to the customer goes
//  through the authenticated qrSendMessage Cloud Function in the main CRM; this
//  no-auth tool intentionally mirrors the tester instead.)

export const N8N_WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || "";

// Optional shared key — only needed if you set QR_TESTER_KEY in functions/.env.
export const TESTER_KEY = import.meta.env.VITE_QR_TESTER_KEY || "";

export const CONVERSATIONS_COLLECTION =
  import.meta.env.VITE_CONVERSATIONS_COLLECTION || "qr_conversations";

// WhatsApp 24h session window length, in milliseconds.
export const WINDOW_MS = 24 * 60 * 60 * 1000;
