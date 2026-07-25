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
| Sheet reader (server) | `api/sheet.js` | Service-account read of the private sheets. Auto-resolves the current `<Month> <Year>` tab; `?month=prev` reads last month. Also accepts `id`/`tab` overrides from the Settings panel. |
| HTTP + row shaping | `src/api/sheets.js` | Fetches all six sheet/month combinations in parallel. Never throws. |
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

## Design → data mapping

The prototype ran on simulated counters. Every number here is real:

| Panel | Source |
| --- | --- |
| Today's revenue / orders / conversion | Men's orders dated today ÷ leads worked today |
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
