import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only middleware so `npm run dev` serves the /api/sheet serverless function
// locally (Vite alone doesn't run /api). In production Vercel runs api/sheet.js.
function devApiPlugin() {
  // Localhost has no CDN in front of /api/sheet, so without this the browser's 5s
  // poll would make 6 raw Google reads per tick (3 boards × 2 months) = ~72/min,
  // OVER Google's 60-reads-per-minute quota — and every board flaps to
  // "unavailable". In production Vercel's CDN absorbs this via s-maxage; here we
  // reproduce it with a tiny in-memory TTL cache keyed by which+month. Current
  // month 5s, previous month 10min (it doesn't change) — same numbers api/sheet.js
  // sets on its Cache-Control header.
  const cache = new Map(); // key -> { body, ts, ttl }
  return {
    name: 'dev-api-sheet',
    configureServer(server) {
      server.middlewares.use('/api/sheet', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const query = Object.fromEntries(url.searchParams); // forward all params (which, month, …)
          const key = `${query.which || ''}:${query.month || ''}`;
          const ttl = String(query.month || '') === 'prev' ? 600000 : 5000;

          const hit = cache.get(key);
          if (hit && Date.now() - hit.ts < hit.ttl) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Dev-Cache', 'HIT');
            res.end(hit.body);
            return;
          }

          const { default: handler } = await import('./api/sheet.js');
          const resAdapter = {
            setHeader: (k, v) => res.setHeader(k, v),
            status(code) {
              res.statusCode = code;
              return this;
            },
            json(body) {
              const str = JSON.stringify(body);
              // Only cache successful reads that actually carried rows — never an
              // error or an empty tick, or we'd pin the "unavailable" state for the
              // whole TTL and starve the retry.
              if (res.statusCode === 200 && body && Array.isArray(body.values) && body.values.length) {
                cache.set(key, { body: str, ts: Date.now(), ttl });
              }
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('X-Dev-Cache', 'MISS');
              res.end(str);
              return this;
            },
          };
          await handler({ query }, resAdapter);
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err?.message || 'dev api error' }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Make non-VITE_ env vars (service account, sheet IDs) available to the dev API.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    plugins: [react(), devApiPlugin()],
    server: {
      port: 5181,
      host: true,
    },
  };
});
