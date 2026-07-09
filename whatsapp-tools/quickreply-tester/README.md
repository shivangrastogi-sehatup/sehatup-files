# QuickReply WhatsApp Tester (React + Vite)

A mobile, WhatsApp-style chat UI to **test your n8n QuickReply bot** end-to-end:
simulate a customer sending WhatsApp messages, and watch the bot's replies appear
live from Firestore.

## How it works

The 24-hour WhatsApp window can only be opened by a **real inbound message** from
the customer's phone → the business number. No API can do that for you, so the
tester sends *you* into WhatsApp to do it:

1. **Enter your WhatsApp number** (10 digits; the **+91** prefix is fixed). This
   is only used to know which conversation to watch.
2. Tap **Open WhatsApp & Say Hi** — it deep-links to `wa.me/919355539355` with
   "Hi" prefilled. Send it from your real WhatsApp; that opens the 24h window and
   starts the n8n flow.
3. **Bridge detection** — the app subscribes to `qr_conversations/{91xxxxxxxxxx}/events`
   and shows *"Waiting for the bridge…"* until your "Hi" lands, then reveals the
   live chat. The header shows the **24h window countdown**, synced to your last
   message.
4. **Follow-ups** — typing in the composer POSTs `USER_TEXT` to the n8n webhook
   (`quickreply-webhook`) so you can keep testing without switching apps.

Rendering: `USER_*` → your green bubbles, `AI_REPLY` / `AGENT_TEXT` → bot bubbles,
`STATUS` → system pills.

> ⏱️ The n8n flow **batches and waits ~3 minutes** before the AI replies, so a
> "bot replies in ~3 min" indicator shows after each send. That delay is expected.

Configure the business number / bot name via `VITE_BUSINESS_WHATSAPP` and
`VITE_BOT_NAME` in `.env` (defaults: `919355539355` / `SehatUp`).

## Setup

```bash
cd quickreply-tester
npm install
```

Create **`.env`** (already present here, prefilled from your old config; or copy
from `.env.example`):

```
VITE_WEBHOOK_URL=https://sehatup-wellness.app.n8n.cloud/webhook/quickreply-webhook
VITE_QR_CLIENT_ID=...
VITE_QR_SECRET_KEY=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=sehatup-f96b5.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sehatup-f96b5
VITE_FIREBASE_STORAGE_BUCKET=sehatup-f96b5.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

> ⚠️ `VITE_*` vars are **bundled into the client JS** — they are kept out of git
> (via `.gitignore`) but are not truly secret in the browser. The real secret
> (QuickReply API key) lives server-side in n8n, which is correct.

## Firestore permissions (the "insufficient permissions" fix)

Your rules only allow reads when `request.auth != null`, but the tester is
unauthenticated → permission denied. A scoped public-read rule for
`qr_conversations` only was added to `../sehatup-firebase/firestore.rules`.
**Deploy it** (writes stay locked; only this collection's reads open up):

```bash
cd ../sehatup-firebase
firebase deploy --only firestore:rules
```

## Run

```bash
npm run dev
```

Open the printed URL on desktop, or the `Network:` URL on your phone (same Wi-Fi).

## Project structure

```
src/
  main.jsx            React entry
  App.jsx             setup ↔ chat switch + session state
  SetupScreen.jsx     name / +91 phone / first message
  ChatScreen.jsx      webhook send + optimistic bubbles + live timeline
  useConversation.js  Firestore onSnapshot hook (events ordered by savedAt)
  firebase.js         Firebase init from .env
  config.js           webhook URL + headers from .env
  utils.js            classify / time / timeline merge helpers
  styles.css          WhatsApp-style mobile UI
```
