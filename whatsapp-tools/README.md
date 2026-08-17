# WhatsApp ops tools

Small web apps for operating and inspecting the SehatUP WhatsApp chatbot (the
"Ananya" assistant). These are the **operate-the-bot** tools; the
**build-the-model** pipeline (data cleaning + training data + fine-tune) lives
separately under [`../ananya-training/`](../ananya-training/).

| Folder | What it is | Backend | Build |
|---|---|---|---|
| [`chatbot-control/`](chatbot-control/) | Control panel: toggles `qr_config/chatbot` **mode** (off/test/on), test numbers, and blocked numbers | Firestore `qr_config` | Static HTML (Vercel project **chatbot-control**) |
| [`conversations-studio/`](conversations-studio/) | WhatsApp-style viewer/editor for the **Quickreply Messages** Google Sheet — edits write back via `apps-script.gs` | Google Sheet + Apps Script Web App | React + Vite |
| [`conversations-studio-standalone/`](conversations-studio-standalone/) | Single-file (no build) version of Conversations Studio — the original prototype; carries its own `apps-script.gs` + README | Google Sheet + Apps Script Web App | None — open `index.html` |
| [`inbox-dashboard/`](inbox-dashboard/) | WhatsApp-Web-style dashboard showing **every** user's conversation at once; multi-user companion to quickreply-tester | Firestore `qr_conversations` | React + Vite |
| [`quickreply-tester/`](quickreply-tester/) | Replays and inspects a **single** phone's `conversations/{convId}/messages`; reply/clear mechanics | Firestore | React + Vite |

## Notes
- `conversations-studio/` (Vite) and `conversations-studio-standalone/` (single
  file) are two forms of the same tool. The Vite app is the maintained one; the
  standalone is kept as a zero-build fallback.
- `inbox-dashboard/` and `quickreply-tester/` share the same Firestore collection
  and `.env` shape (see each app's `.env.example`).
- Apps Script setup for editing the Quickreply sheet lives in each Conversations
  Studio folder's `apps-script.gs` + README.
