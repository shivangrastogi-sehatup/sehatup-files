# Apps Script endpoints — one deployment per board

Each file is the **same** sheet-reader script; only the `SOURCE` line differs.
Deploy each into its own Apps Script project as a Web App and paste the three
`/exec` URLs into the dashboard's `.env`.

| File | `SOURCE` | Sheet | `.env` var |
| --- | --- | --- | --- |
| `health.gs` | `'health'` | Healthscore 360 (per-lead LEADS tab) | `VITE_SHEETS_ENDPOINT_HEALTH` |
| `quick.gs` | `'quick'` | Quick Reply Leads | `VITE_SHEETS_ENDPOINT_QUICK` |
| `mens.gs` | `'mens'` | Men's Wellness Orders | `VITE_SHEETS_ENDPOINT_MENS` |

`Code.gs` is the older, fully-commented original (ships with `SOURCE='health'`);
the three files above are the clean, per-board copies. Use whichever you prefer —
they behave identically.

## Deploy / redeploy (do this per board)

1. Open (or create) the board's Apps Script project.
2. Paste the matching file's contents. **Do not change `SOURCE`** — the file
   already has the right value.
3. Run `setup` once and accept the permission prompt. It logs the spreadsheet
   name and the resolved current/previous tab titles — a wrong sheet or a
   renamed tab shows up here before the dashboard ever calls it.
4. **Deploy → New deployment → Web app**, Execute as: **Me**, Who has access:
   **Anyone**.
5. Copy the `/exec` URL into the matching `.env` var above, plus
   `VITE_SHEETS_KEY` (the `KEY` constant in the file).

> Editing a file later needs **Deploy → Manage deployments → edit (pencil) →
> Version: New version**. Saving alone does NOT update the live `/exec` URL — a
> stale/undeployed URL is what returns `404` to the dashboard.

All three `VITE_SHEETS_ENDPOINT_*` must be set, or the dashboard falls back to
the `/api/sheet` service-account path.
