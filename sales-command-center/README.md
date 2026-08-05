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

Data refreshes every 10 s. A partial failure (one sheet throttled) keeps that
**board's** last-good numbers on screen rather than showing a half-empty board.

### How fast a sheet edit reaches the wall

| Stage | Cost |
| --- | --- |
| Apps Script cache (`TTL_CURRENT`) | up to 5 s |
| Client poll (`App.jsx` `_poll`) | up to 10 s |
| Request round trip | ~1 s |
| **Worst case** | **~16 s** |

It used to be ~40 s at best and *unbounded* at worst — see below. If you need
better than this, polling is the wrong shape and no amount of tuning fixes it:
you need a push channel (an Apps Script `onChange` trigger writing a revision
stamp somewhere the browser can hold a socket open to, e.g. Firestore, which the
dashboard then listens on). That lands around 3 s and would *reduce* the Apps
Script quota load, because executions would track real edits instead of a timer.

#### Fixed 2026-08-05 — one board's failure used to freeze all three

`unify.js` computed `ok = health.ok && quick.ok && mens.ok` and `App.jsx` threw
away the **entire** refresh when that was false:

```js
if (!d.ok && !first && this.state.rows && this.state.rows.length) return;   // gone
```

So a single board hiccuping discarded the two that had succeeded as well, with
no time bound and no retry — the wall held its numbers until a tick where all
three happened to succeed at once. At ~4 s per Apps Script request that is not
rare, and an unlucky run is **minutes** of stale numbers.

It was invisible, too: the header printed `synced 3:04 pm` next to a permanently
green **LIVE** badge, so a frozen board looked healthy.

Now each of the six slices (three boards × two months) keeps **its own**
last-good copy and its own age. Whatever arrives is rendered unconditionally,
and staleness is reported rather than hidden:

- the LIVE badge turns amber and reads **HELD 2m ago** when any board is running
  on held data;
- the header reads `synced 12s ago`, relative — a clock time is only
  recognisable as stale if you also know what time it is now;
- the warning chip names the board and says *not updating*.

If you ever see minutes again, the header now tells you where the time went.

#### Last month is not re-sent

83% of every response was the previous month (394 KB of 473 KB), re-serialised
and re-sent every tick forever — ~1.6 GB/day per screen of data that cannot
change, and several seconds of every request.

The script now returns a `sig` (an MD5 of the tab name + values, computed once
per cache fill, not per request). The client sends back the `sig` it holds and
gets `previous: { unchanged: true }` with no rows, reusing what it already
mapped. A real edit to last month changes the signature and the full payload
comes back on its own — so this is a cache, not a blanket "skip last month".

An older deployment sends no `sig`, in which case the client just keeps asking
for the full payload. **The frontend is safe to ship before the scripts are
redeployed.**

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

What it costs instead is Apps Script *runtime* — 6 h/day on Workspace. At the old
20 s poll that landed around 3–4 h/day. The poll is now **10 s**, which doubles
the execution count to ~26,000/day, and is only affordable because dropping the
previous month made each execution far cheaper. **Check this before adding
screens or boards**: Apps Script → Executions → runtime. If the daily total
approaches 6 h, raise `this._poll = setInterval(…, 10000)` in `App.jsx` rather
than the cache TTL — the TTL is a floor on staleness, the poll is not.

> Polling faster than this is not the answer. At a 5 s poll you are over quota,
> executions start failing, and a failing board is worse than a slow one. Past
> ~16 s the only real improvement is push — see [How fast a sheet edit reaches
> the wall](#how-fast-a-sheet-edit-reaches-the-wall).

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
| Today's revenue / orders / conversion | Men's orders dated today ÷ leads received today |
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
