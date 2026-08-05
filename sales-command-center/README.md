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

> ### ⚠️ Which path is LIVE — read this before optimising anything
>
> **Production (`sehatup-sales.vercel.app`) runs the `/api/sheet` fallback, not
> Apps Script.** Verified in the browser on 2026-08-05: the page requests
> `/api/sheet?which=health|quick|mens` (six per poll — each source twice, current
> and `month=prev`) and never contacts `script.google.com` at all.
>
> Why: `useScript` requires all three `VITE_SHEETS_ENDPOINT_*`. Vite inlines those
> at **build** time, and they exist only in `.env`, which is gitignored — so the
> Vercel build sees them undefined and silently takes the fallback. Setting them in
> the Vercel project's Environment Variables is what would flip it.
>
> A whole day was spent tuning the Apps Script path — cache TTL, payload
> signatures, poll interval — while production executed none of it. **Check
> `x-vercel-cache` on `/api/sheet` before believing any diagram in this file.**
>
> And the fallback is not obviously the worse option. Requests measured **131ms
> average** through Vercel's CDN versus **4.2s** direct to Apps Script, and the CDN
> fans in — every screen shares one cached response, so Google's read quota is flat
> in the number of viewers. Think twice before switching.

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

Data refreshes every 20 s. A partial failure (one sheet throttled) keeps that
**board's** last-good numbers on screen rather than showing a half-empty board.

### How fast a sheet edit reaches the wall

**On the path production actually runs** (`/api/sheet` behind Vercel's CDN):

| Stage | Was | Now |
| --- | --- | --- |
| CDN staleness (`s-maxage` + `stale-while-revalidate` in `api/sheet.js`) | **up to 30 s** | up to 5 s |
| Client poll (`App.jsx` `_poll`) | up to 20 s | up to 5 s |
| Request round trip (CDN edge, measured) | ~0.13 s | ~0.13 s |
| **Worst case** | **~50-60 s** | **~10 s** |

The 60 s that was reported for weeks was `stale-while-revalidate=20` stacked on a
20 s poll. Caught by reading `x-vercel-cache` on the live endpoint:

```
/api/sheet?which=mens   x-vercel-cache: STALE   age: 19
```

`age: 19` — the CDN was handing browsers a 19-second-old response and refreshing it
in the background. Note Vercel rewrites the client-facing header to
`public, max-age=0`, so the staleness is invisible in `cache-control`; only
`x-vercel-cache` and `age` reveal it.

Polling at 5 s is cheap **because of the CDN**: the browser hits the edge, and
Google is only read when a CDN entry expires, which `s-maxage` governs
independently of poll rate. Previous-month responses are cached 10 minutes — they
cannot change, and they were half of every poll.

*(For reference, if `VITE_SHEETS_ENDPOINT_*` were ever set, the browser would go
straight to Apps Script: 4.7 s average round trip, 9.1 s worst, no CDN, and every
poll a real execution against a 6 h/day quota. Restore the 20 s poll first.)*

> **The request time is Apps Script overhead, not bytes.** Dropping the previous
> month cut the payload 83% (475 KB → 80 KB per tick) and the round trip barely
> moved; the 5 KB mens board still takes 1.9–4.1 s. Anything that assumes "smaller
> payload ⇒ cheaper execution" — including a faster poll — is reasoning from the
> wrong bottleneck. This is why the poll went back to 20 s after briefly being 10 s.

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

What it costs instead is Apps Script *runtime* — 6 h/day on Workspace. At a 20 s
poll that lands around 3–4 h/day, which fits with room.

**The quota is per USER, and every screen multiplies it.** The script cache saves
the *sheet read*, not the *execution* — a second TV polling the same endpoint
still costs a full execution. Two screens at a 20 s poll is already ~26,000
executions/day.

Before lowering the poll, look at Apps Script → Executions → runtime and see what
the daily total actually is. A 10 s poll doubles the count for a per-execution
cost that measurement shows does **not** fall with payload size, so it only fits
if there is genuine headroom — and it buys ~10 s.

> Polling faster is not the answer past that. At a 5 s poll you are over quota,
> executions start failing, and a failing board is worse than a slow one. The only
> real improvement past ~20 s is push — see [How fast a sheet edit reaches the
> wall](#how-fast-a-sheet-edit-reaches-the-wall).

**Deploying it**, once per board:

1. Paste the same `apps-script/Code.gs` into the project — identical in all three.
2. Change one line: `var SOURCE = 'health';` → `'quick'` or `'mens'`. Keep the
   quotes; a bare `mens` is an identifier, not a string, and throws
   `ReferenceError: mens is not defined`. Nothing else needs editing — the
   spreadsheet IDs are already in `BOARDS`.

   > ⚠️ **This is the step that goes wrong.** The file in this repo ships with
   > `'health'`, so pasting it into the Quick Reply or Men's project and
   > forgetting line 5 leaves that endpoint serving **Healthscore** rows. It
   > happened on 2026-08-05: the Quick Reply endpoint returned Healthscore leads,
   > `unify.js` relabelled them `source: 'quickreply'`, and the wall counted the
   > same 194 leads twice while Quick Reply's ~488 vanished. Nothing looked
   > broken — the rows were real, well-formed and non-empty — so the board showed
   > confident wrong numbers rather than an obvious failure.
   >
   > `callScript()` now compares the `source` in every response against the slot
   > it asked for and refuses a mismatch by name, so this fails loudly instead.
   > Running `setup()` (step 3) also catches it before the dashboard ever calls.
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
