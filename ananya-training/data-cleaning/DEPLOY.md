# Ananya Training-Data Viewer — Vercel deploy

Static viewer (`public/index.html`) + serverless API (`api/*.js`) that saves all
reviews & exclusions to Firestore project **sehatupdev**, collection
**`ananya_training_reviews`** (one document per chunk file).

## What lives where
- `public/index.html` — the reviewer UI (served at `/`)
- `public/training-data/` — the chunk `.jsonl` + `.meta.json` + `index.json` manifest (static)
- `api/reviews.js` — `GET /api/reviews?file=…` → `{reviews, excluded}` for a chunk
- `api/review.js` — `POST /api/review` → toggle a reviewer's mark on one example
- `api/exclude.js` — `POST /api/exclude` → toggle exclude on one example
- `lib/firebase.js` — Firebase Admin singleton (credentials from env, file fallback for local)
- `build-data.mjs` — regenerates `public/training-data/` from `../raw/`

## Regenerate the data snapshot (after new chunks are produced)
```
cd ananya-training/data-cleaning
node build-data.mjs        # copies chunks + rebuilds index.json
```

## The one required secret: FIREBASE_SERVICE_ACCOUNT
The service-account JSON is **gitignored and must never be committed**. In production
the API reads it from the `FIREBASE_SERVICE_ACCOUNT` env var (the full JSON as a string).
Locally, `lib/firebase.js` falls back to
`sehatup-firebase/functions/sehatupdev-firebase-adminsdk-fbsvc-50c50c8be8.json`
(resolved relative to the repo root).

Add it to Vercel (run from `ananya-training/data-cleaning/`, PowerShell):
```
vercel login
vercel link                         # create/link the project, root dir = ananya-training/data-cleaning
Get-Content ..\..\sehatup-firebase\functions\sehatupdev-firebase-adminsdk-fbsvc-50c50c8be8.json -Raw | vercel env add FIREBASE_SERVICE_ACCOUNT production
Get-Content ..\..\sehatup-firebase\functions\sehatupdev-firebase-adminsdk-fbsvc-50c50c8be8.json -Raw | vercel env add FIREBASE_SERVICE_ACCOUNT preview
```

## Deploy

### Option A — Vercel CLI (simplest, uploads this folder directly)
```
cd ananya-training/data-cleaning
vercel            # preview deploy
vercel --prod     # production deploy
```

### Option B — Git integration (dashboard)
1. Import the repo in Vercel.
2. **Set Root Directory = `ananya-training/data-cleaning`** (Settings → General).
3. Framework preset: **Other**. Build command: none. Output dir: `public` (auto).
4. Add the `FIREBASE_SERVICE_ACCOUNT` env var (above).
5. Commit `public/training-data/` + `public/index.html` + `api/` so the deploy has them.

## Local preview
```
cd ananya-training/data-cleaning
npm install
vercel dev        # serves static + functions; uses the service-account file fallback
```

## Firestore document shape (`ananya_training_reviews/{chunkFileName}`)
```json
{
  "file": "chunk-01_2026-06-16_2026-06-30.jsonl",
  "reviews": { "0": [{ "name": "Asha", "color": "#e05252" }] },
  "excluded": [5, 7],
  "updatedAt": "<serverTimestamp>"
}
```
