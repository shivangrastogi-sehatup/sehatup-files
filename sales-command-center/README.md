# SehatUP — Sales Command Center (new design)

A 1920×1080 TV wallboard, built from the Claude Design prototype
"SehatUP Command Center.dc.html" and wired to the live Google Sheets.

Lives at the repo root. It replaced the old `sales-dashboard-tv/` directory on
2026-07-25 — the previous `sales-dashboard` build and design export are
recoverable from git history if ever needed.

```bash
npm install
npm run dev      # http://localhost:5181
npm run build
```

## How it's put together

| Layer | File | Notes |
| --- | --- | --- |
| Sheet reader (preferred) | `apps-script/Code.gs` | Apps Script Web App, **one deployment per board** (same file, different `CONFIG.SOURCE`). Each returns its board's current *and* previous month in one response. Reads via `SpreadsheetApp`, so it doesn't touch the Sheets API quota. |
| Sheet reader (fallback) | `api/sheet.js` | The original service-account read, one sheet/month per request. Used when the three `VITE_SHEETS_ENDPOINT_*` vars aren't all set. |
| HTTP + row shaping | `src/api/sheets.js` | Picks whichever reader is configured and returns the same six `{rows, tab, ok}` objects either way. Never throws. |
| Cell helpers | `src/utils/dataProcessor.js` | Tolerant date/number parsing and header lookup (`field()` ignores casing and spacing drift). |
| The data seam | `src/data/unify.js` | Maps raw rows into one unified shape. **This is the only file that knows about sheet columns.** |
| The board | `src/App.jsx` | Layout + all derived metrics. |

Three sheets feed it:

- **Healthscore 360** and **Quick Reply** — per-lead boards. Supply *leads*, the
  caller, and the call-status funnel.
- **Men's Wellness** — the orders board. Every row is an order: it supplies
  *revenue, orders, payment mode, delivery status and lead source*. Orders never
  come from the lead sheets.

Data refreshes every 20 s. A partial failure (one sheet throttled) keeps the
last-good numbers on screen rather than showing a half-empty board.

### Why the Apps Script endpoint

The service-account path spent **six Google Sheets API reads per tick** (three
boards × current and previous month), plus up to six more `spreadsheets.get`
calls whenever the tab-title cache went cold — roughly 18–36 reads a minute
against Google's ceiling of 60 per user per minute. Hitting it throttled a
sheet, which flashed partial numbers on the wall.

Apps Script reads the spreadsheets natively, so those reads don't count against
that quota at all, and the poll drops to three parallel requests — one per board,
each carrying both months. A script-side cache (15 s for the current month,
10 min for last month, which no longer changes) means a second and third TV cost
essentially nothing.

Splitting it per board rather than running one script over all three also means
a board fails alone: if the Healthscore script errors, Quick Reply and Men's
Wellness still answer and only the Healthscore numbers hold at their last-good
values.

What it costs instead is Apps Script *runtime* — 6 h/day on Workspace. At a 20 s
poll that lands around 3–4 h/day, which fits with room. If you add a lot more
boards or want more headroom, raise the poll interval in `App.jsx`
(`this._poll = setInterval(… , 20000)`) rather than the cache TTL.

**Deploying it**, once per board:

1. Paste the same `apps-script/Code.gs` into the project — identical in all three.
2. Change one line: `var SOURCE = 'health';` → `'quick'` or `'mens'`. Keep the
   quotes; a bare `mens` is an identifier, not a string, and throws
   `ReferenceError: mens is not defined`. Nothing else needs editing — the
   spreadsheet IDs are already in `BOARDS`.
3. Run `setup` from the editor and accept the permission prompt. It logs the
   spreadsheet name and both resolved tab titles, so a wrong `SOURCE` or a
   renamed tab shows up before the dashboard ever calls it.
4. Deploy → New deployment → Web app, **Execute as: Me**, **Who has access:
   Anyone**.
5. Put the three `/exec` URLs in `.env` as `VITE_SHEETS_ENDPOINT_HEALTH` /
   `_QUICK` / `_MENS`, and the key as `VITE_SHEETS_KEY`. All three must be set
   or the board falls back to `api/sheet.js`.

Editing the file later needs Deploy → Manage deployments → edit (pencil) →
Version: **New version**. Saving alone does not update the live `/exec` URL.

⚠️ The Web App must be deployed with **"Anyone" access** — a browser can't fetch
a login-gated one, it just gets redirected to a sign-in page. `VITE_SHEETS_KEY`
is compiled into the browser bundle, so anyone who can open the board's devtools
can read the raw sheets through that URL. That's a real step down from the
service-account path, where credentials never left the server. If the lead data
shouldn't be readable by anyone who can see the screen, stay on `api/sheet.js`.

## Design → data mapping

The prototype ran on simulated counters. Every number here is real:

| Panel | Source |
| --- | --- |
| Today's revenue / orders / conversion | Men's orders dated today ÷ leads count today |
| This Month · MTD | All loaded orders; "vs last month" compares against the same month-to-date window of the previous month's tabs |
| Weekly revenue | Six Monday-start weeks of orders (current + previous month tabs); WoW = this week vs last |
| KPI row | Lead status buckets — Today vs Month; the trend % compares the month against the previous month's tabs |
| Leaderboard | Leads by `Caller 1`, orders + revenue by `Agent Name`, over the selected range |
| Fulfillment | The orders sheet's `Order Status` column (Delivered / In-Transit / Undelivered / RTO delivered) |
| Payment mode | The orders sheet's `Mode` column (COD / Prepaid / Partially Paid) |
| Source split | Leads from the two lead boards; orders + revenue from the orders board |
| Ticker | The most recent real orders in the selected range |

### Deliberate departures from the prototype

- **KPI drill-in modals.** The prototype invented sub-reasons ("Answered on 1st
  ring", "DND / opted out"). No sheet column carries those, so each modal breaks
  the number down the two ways the data *does* support: by lead source and by
  top agents.
- **Source split labels.** The orders sheet's `Lead Source` has more than two
  values (Quick Reply, HEALTHSCORE, Instagram, Reference). `unify.js` folds
  everything non-Healthscore into one bucket, so it's labelled "Quick Reply &
  Meta" rather than named after a single value.
- **Ticker third field.** The prototype showed a region; the orders board has no
  state column (only free-text `Address`), so it falls back to the lead source.
- **Panel titles follow the filter.** Titles read "· This Month" / "· This Week"
  / "· Today" to match the selected range instead of being hard-coded to MTD.

## Modes

- **TV** — display only, no click targets. What goes on the wall.
- **Interactive** — adds the filter bar (range / source / agent), the settings
  gear, and makes cards, agents and charts clickable for drill-in.

Both render the same fixed 1920×1080 stage, scaled to fit the viewport.

Mode, range, source and agent are remembered in `localStorage` (`scc-prefs-v1`),
so a refresh returns to the view you left. The default range is **This Month**.

> Panels titled "· Today" genuinely show today. Early in the day — or on a
> weekend — the leaderboard, donuts and source split can legitimately be empty
> while the MTD card is full. That's the data, not a load failure. If a *sheet*
> actually fails or returns nothing, a red/amber chip naming it appears next to
> the LIVE badge.

## Settings (gear icon, interactive mode)

Repoints the board at different sheets and remaps columns, without touching code
or `.env`. Per source:

1. Paste a **Google Sheet URL or ID** (blank = keep the server's `.env` sheet).
2. **Load tabs** lists the spreadsheet's tabs; click one to pin it, or type
   `auto:month` / `auto:leads` to keep following the current month.
3. **Read columns** pulls that tab's header row and turns every field into a
   dropdown of the columns that actually exist.
4. **Save & reload data** persists to `localStorage` (`scc-config-v1`) and
   refetches. **Reset to defaults** returns every source to `.env`.

Required fields are marked `*`. An unmapped field falls back to its default
column name, matched loosely — casing and stray spaces don't matter. A red border
means the mapped column is no longer present in the selected tab.

Two things worth knowing:

- The config lives in the browser, so it's **per-browser, not global**. The TV
  and your laptop each have their own. For a permanent change, edit `.env`.
- The service account must be shared on any sheet you point at. It can't read
  anything it wasn't granted — a sheet it can't see just comes back empty.

## Config

Copy `.env.example` to `.env` and fill in the service-account key and the three
sheet IDs. `.env` and any `sehatup-*.json` key file are gitignored — never commit
them.
