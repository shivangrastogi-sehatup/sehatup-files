# SehatUP — Sales Dashboard

A Full-HD (1920×1080) wall/TV dashboard built with Vite + React + Tailwind + Recharts.
It reads two **private** Google Sheets through a serverless function (`api/sheet.js`)
that authenticates with a Google **service account** — so the credentials stay on the
server and the browser never sees them.

## Service-account setup (one time)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → your project
2. **APIs & Services → Library** → enable **Google Sheets API** (if not already)
3. **APIs & Services → Credentials → Create Credentials → Service account**
   - Give it a name (e.g. `sheets-reader`) → Create → Done (no roles needed)
4. Open the service account → **Keys → Add key → Create new key → JSON** → download it
5. Open the JSON file and copy the **`client_email`** value (looks like
   `sheets-reader@your-project.iam.gserviceaccount.com`)
6. On **both** Google Sheets: **Share** → paste that `client_email` → role **Viewer** → Send
7. Base64-encode the whole JSON file and put it in `.env` (see below)

## Environment variables (server-side — no `VITE_` prefix)

| Variable                       | Description                                                        |
| ------------------------------ | ----------------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON`  | Base64 of the entire service-account JSON key file                |
| `SHEET_ID_MENS`                | Men's Wellness spreadsheet ID                                     |
| `SHEET_GID_MENS`               | Tab id (the `gid=` number in the URL) for the Men's Wellness tab  |
| `SHEET_ID_HEALTH`              | Healthscore 360 spreadsheet ID                                    |
| `SHEET_GID_HEALTH`             | Tab id (`gid=`) for the Healthscore tab                           |

Encode the JSON:

```bash
base64 -w0 service-account.json        # Linux / Git Bash → paste output into .env
```

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))   # PowerShell
```

## Run

The dashboard talks to a serverless function, so use **`vercel dev`** locally (plain
`vite` won't serve `/api`):

```bash
npm install
npm i -g vercel        # if not installed
vercel link            # link to your Vercel project (one time)
vercel dev             # serves the app + /api together
```

For production, set the same env vars in **Vercel → Project → Settings → Environment
Variables**, then `vercel --prod` (or push to the connected branch).

## Display requirements baked in

- Indian-locale number formatting (`toLocaleString('en-IN')`) and `₹` currency prefix
- Percentages rounded to 1 decimal place
- Dates parsed from both `DD-MM-YYYY` and `YYYY-MM-DD`
- Case-insensitive payment-mode matching (`cod` = `COD` = `Cod`)
- Rows skipped when all key fields are empty, or when the date cell contains `#remarks`
- No horizontal scrollbars; min 13px text for 3-metre readability
- "SehatUP" watermark in the bottom-right corner

## Project layout

```
src/
  api/sheets.js          # Google Sheets fetch layer (generic, schema-agnostic)
  utils/dataProcessor.js # formatters + row parsing/normalisation helpers
  components/            # dashboard panels (added once the column schema is finalised)
  App.jsx               # dashboard shell + layout
  main.jsx              # React entry
```

> **Note:** the per-column data processing and the chart components are wired to the
> finalised sheet schema. Update `src/utils/dataProcessor.js` column mappings and the
> components when the sheet headers change.
