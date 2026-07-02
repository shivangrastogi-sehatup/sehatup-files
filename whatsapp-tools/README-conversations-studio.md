# SehatUP · Conversations Studio

A single-file WhatsApp-style dashboard (`index.html`) that reads the **Quickreply Messages**
Google Sheet and renders every phone number as its own WhatsApp chat thread — inbound on the
left, outbound (agent/template) on the right, sorted chronologically with day separators,
delivery ticks, template chips, amount charged, and button/CTA click counts.

## Run it
Just open `index.html`. Because it fetches Google's `gviz` endpoint it must be served over
http(s), not `file://`:

```
cd whatsapp-tools
python -m http.server 8777
# open http://localhost:8777/index.html
```

(Deploying the file to Vercel/Firebase Hosting works too — it's fully static.)

## Reading (no setup)
Reads the public sheet directly via the Google Visualization API. Configure the Sheet ID,
tab name (`ALL_DATA`, `FINAL_TRAINING`, `CHATBOT_ONLY`, …) and grouping under ⚙️ Settings.
The sheet must be shared as **Anyone with the link – Viewer**.

## Editing → writing back to the sheet
A browser cannot write to a Google Sheet from a plain HTML page (a view link has no write
permission). To enable the ✏️ pencil edits to save back:

1. Sheet ▸ **Extensions ▸ Apps Script** → paste `apps-script.gs` → Save.
2. **Deploy ▸ New deployment ▸ Web app** — *Execute as: Me*, *Who has access: Anyone*.
3. Copy the Web app URL → paste into **⚙️ Settings ▸ Save endpoint** in the site.

Once connected, edits update the exact row (matched by **Message ID**) in the sheet, and the
badge in the sidebar flips from **Read-only** to **Live · edits save**. Without it, edits stay
local to the browser session. The same steps are built into the app under the 🔗 button.

## Columns used
Date & Time (UTC), Message ID, Conversation ID, Phone, Direction, Message Type, Message
Content, Delivery Status, Failure Reason, Template ID, Template Category, Amount Charged,
Automation Source Type, Automation Source ID, Channel Type, Replied, Button Clicks, CTA Link Clicks.
