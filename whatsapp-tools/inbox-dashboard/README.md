# WhatsApp Inbox Dashboard (React + Vite)

A desktop, WhatsApp-Web-style dashboard to **see every user's conversation** in
one place and work with any of them. It's the multi-user companion to the
`quickreply-tester` (which watches a single phone): same Firestore collection,
same `.env`, same reply/clear mechanics — just every conversation at once.

## What it does

- **Sidebar** — live list of every conversation in `qr_conversations`, newest
  first, with name, number, last-message preview, and time. Search by name,
  number, or message text.
- **Chat panel** — open any conversation to read the full live thread
  (`qr_conversations/{phone}/events`), with the 24-hour window countdown.
- **Reply** — the composer POSTs a `USER_TEXT` message to the n8n webhook for the
  selected phone, exactly like the quickreply-tester. This simulates the customer
  typing, which drives the bot. (A *real* agent reply to the customer goes through
  the authenticated `qrSendMessage` Cloud Function used by the main CRM; this
  no-auth tool intentionally mirrors the tester instead.)
- **Clear** (🗑️) — calls the `qrTestClear` Cloud Function to wipe that phone's
  saved history so the bot starts fresh.

Rendering: `USER_*` → green bubbles (right), `AI_REPLY` / `AGENT_TEXT` → bot
bubbles (left), `STATUS` → centered system pills.

## How conversations are listed

Each `qr_conversations/{phone}` document carries summary fields written by the n8n
flow — `name`, `phone`, `lastUserMessage`, `lastAiReply`, `lastAgentReply`,
`lastUpdated`. The dashboard subscribes to the whole collection and sorts by
`lastUpdated` **client-side** (so a doc missing that field is never dropped).

## Setup

```bash
cd inbox-dashboard
npm install
```

Create **`.env`** (already present here, copied from quickreply-tester; or copy
from `.env.example` and fill in the Firebase web config).

> ⚠️ `VITE_*` vars are **bundled into the client JS** — kept out of git via
> `.gitignore`, but not truly secret in the browser. The real QuickReply secret
> lives server-side in n8n / functions, which is correct.

## Firestore permissions

Reads rely on the existing public-read rule for `qr_conversations` in
`../../sehatup-firebase/firestore.rules` (the same rule the quickreply-tester
needs). If conversations don't load with "offline — deploy rules", deploy it:

```bash
cd ../../sehatup-firebase
firebase deploy --only firestore:rules
```

## Run

```bash
npm run dev
```

Runs on port **5281** (the tester uses 5280, so both run side by side).

## Project structure

```
src/
  main.jsx             React entry
  App.jsx              two-pane shell (sidebar + chat / placeholder)
  Sidebar.jsx          live conversation list + search
  ChatPanel.jsx        live thread + composer (USER_TEXT) + clear
  useConversations.js  Firestore onSnapshot over the whole collection
  useConversation.js   Firestore onSnapshot over one conversation's events
  firebase.js          Firebase init from .env
  config.js            webhook URL + collection name from .env
  utils.js             classify / time / timeline merge helpers
  styles.css           WhatsApp-Web-style desktop UI
```
