# SehatUP on-site chat panel

Replaces the tap-out-to-WhatsApp floating button on sehatup.com with a chat panel that
answers product, price and policy questions itself, using **live Shopify prices**, and
hands over to WhatsApp only when it genuinely cannot help.

Same persona as the WhatsApp bot (Ananya), same safety rules, deliberately **not** the
same model.

```
visitor types
   -> widget.js (shadow DOM, on the Shopify theme)
   -> POST /api/chat on Vercel
        -> Shopify Admin API      live prices + stock, cached 5 min
        -> prompts/ananya-web.txt persona and rules
        -> api/kb/policies.md     shipping, returns, consultation
        -> Gemini on Vertex AI    one call, no tool round trips
   <- SSE: text deltas, then product cards + handoff
```

## Why a base model and not the fine-tune

The WhatsApp bot calls a tuned Vertex endpoint. This one does not, on purpose:

- The tune learnt WhatsApp cadence from WhatsApp transcripts. A website visitor is already
  on the product page and wants a concrete answer, not a chat-app opener.
- It over-steers toward booking a consultation. On the site that is friction in front of a
  visitor who was about to add to cart.
- The rules that matter (no dosing, prescription gating, safety gate, price discipline)
  live in `prompts/ananya-web.txt`, so they are shared without inheriting the bias.

Set `GEMINI_MODEL` to the tuned endpoint id if you ever want to A/B it.

## What the code guarantees, not just the prompt

Prompt rules are advisory; a determined visitor can talk a model out of them. These are
enforced in code, so a jailbreak cannot reach them:

| Guarantee | Where |
| --- | --- |
| Prescription products have no price, URL or handle in the context window at all | `api/_lib/catalog.js` redacts before the prompt is built |
| A hallucinated, sold-out or Rx handle never becomes a product card | `api/_lib/markers.js` `resolveMarkers` validates against the live catalog |
| Prices are never remembered from an earlier chat | the whole catalog is re-read per request; no price appears anywhere in the prompt text |
| Markers never appear on screen mid-stream | `createMarkerFilter` holds back partial markers; `widget.js` strips them again as a backstop |

`node scripts/smoke-test.mjs` asserts all of these against the live store.

## Setup

### 1. Deploy

```bash
cd webchat
vercel                       # first deploy, links the project
vercel --prod
```

### 2. Environment variables

Set these in the Vercel project (Settings -> Environment Variables):

| Variable | Required | What |
| --- | --- | --- |
| `SHOPIFY_ACCESS_TOKEN` | yes | Admin API token with `read_products`. The one in `fetch-product-table.js` works. |
| `GCP_SERVICE_ACCOUNT` | yes* | Full JSON key for a service account with `roles/aiplatform.user` on `sehatup-f96b5`. Same project the WhatsApp bot bills to. |
| `GEMINI_API_KEY` | yes* | Alternative to the above: an AI Studio key. Simpler for local testing, and it takes priority if both are set. |
| `WHATSAPP_NUMBER` | no | Handoff number, digits only. Defaults to `919355539355` **- confirm this is the right number before launch.** |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.5-flash`. |
| `VERTEX_LOCATION` | no | Defaults to `us-central1`. |
| `FIRESTORE_PROJECT_ID` | no | Turns on transcript logging to the `web_chats` collection. Needs `roles/datastore.user` too. |
| `GEMINI_SAFETY` | no | Defaults to `BLOCK_ONLY_HIGH`. See the note below. |
| `RATE_LIMIT_PER_MIN` | no | Per IP, defaults to 12. |
| `EXTRA_ORIGINS` | no | Comma-separated extra CORS origins. |

\* one of `GCP_SERVICE_ACCOUNT` or `GEMINI_API_KEY`.

Check it landed: `curl https://<your-deployment>/api/chat` returns the model in use,
whether logging is on, and how many products it can see.

### 3. Install on the theme

`shopify-elements/sehatup-webchat.liquid` has the full instructions in its header
comment. Short version: add it as a snippet named `sehatup-webchat`, render it just above
`</body>` in `theme.liquid`, and **point `chat_api` at your deployment URL**.

### 4. Turn off the old WhatsApp button

There is no `wa.me` link anywhere in the theme files, so the current floating icon comes
from a Shopify **app**. Disable that app's floating button or uninstall it, otherwise two
buttons stack in the same corner.

## Before you launch

1. **Fill in the TODOs in `api/kb/policies.md`.** Every line marked TODO is something the
   bot will refuse to answer (correctly - it says the team will confirm). The COD charge
   and support hours are the two visitors ask about most.
2. **Confirm the WhatsApp number.** `919355539355` came off the privacy policy page, not
   from a WhatsApp setting.
3. **Check the Rx list.** `RX_MARKERS` in `api/_lib/catalog.js` decides what needs a
   doctor. Run the smoke test after any Shopify product rename - a renamed product that
   stops matching would start quoting a prescription price.
4. **Read a day of transcripts** in Firestore `web_chats` before trusting it unattended.

## Local development

```bash
node scripts/markers.test.mjs                 # streaming/marker logic, no network
SHOPIFY_ACCESS_TOKEN=... node scripts/smoke-test.mjs   # live catalog + Rx containment

vercel dev                                     # real bot at localhost:3000/preview.html?live=1
```

`public/preview.html` with no query string mocks the API entirely, so you can judge the
look, the streaming and the cards without any Gemini credentials.

## Editing the bot's behaviour

- **What Ananya says and refuses**: `prompts/ananya-web.txt`. Plain text, no code. Never
  put a real price in an example here - a stale number in the prompt is how a model learns
  to quote stale prices.
- **Policy answers**: `api/kb/policies.md`. Plain markdown.
- **What is prescription-only**: `RX_MARKERS` in `api/_lib/catalog.js`.
- **Look and feel**: `public/widget.js` (the `css()` function at the bottom).
- **Greeting, suggestion chips, avatar, accent colour, corner position**: `data-*`
  attributes on the script tag in the liquid snippet - theme edit only, no redeploy.

  | Attribute | Default | What |
  | --- | --- | --- |
  | `data-bottom` | `40px` | Gap from the bottom edge, desktop |
  | `data-right` | `20px` | Gap from the right edge |
  | `data-bottom-mobile` | `16px` | Gap from the bottom on phones (≤560px) |
  | `data-accent` | `#ee204a` | Brand colour for the bubble, header and buttons |

  The widget renders in a shadow root, so theme CSS cannot reach `.launcher` - these
  attributes are the supported way to move it.

## Notes

**Safety filters.** `GEMINI_SAFETY` defaults to `BLOCK_ONLY_HIGH` rather than Google's
default. This catalog is half sexual-wellness, and the default thresholds refuse ordinary
customer questions about performance, erections and period pain. What keeps this bot safe
is the medical gating, the no-dosing rule and the prescription redaction, not a category
classifier. If you see refusals in the transcripts, `OFF` is available on Vertex.

**Rate limiting** is per lambda instance, so it is a brake on one bored visitor, not a
defence against a botnet. Put the Vercel WAF in front of `/api/chat` if that changes.

**The catalog cache is 5 minutes.** A price change in Shopify takes up to that long to
show in chat. Set `CATALOG_TTL_MS` lower during a sale.

**No order lookup.** The website has no way to identify the visitor, so every order,
tracking, refund and cancellation question hands over to WhatsApp by design. Adding order
lookup means asking for a phone number in the panel and verifying it - a bigger change,
and a privacy decision worth making deliberately.
