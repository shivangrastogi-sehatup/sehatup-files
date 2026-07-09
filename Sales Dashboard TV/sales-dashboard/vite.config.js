import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only middleware so `npm run dev` serves the /api/sheet serverless function
// locally (Vite alone doesn't run /api). In production Vercel runs api/sheet.js.
function devApiPlugin() {
  return {
    name: 'dev-api-sheet',
    configureServer(server) {
      server.middlewares.use('/api/sheet', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const query = Object.fromEntries(url.searchParams); // forward all params (which, month, …)
          const { default: handler } = await import('./api/sheet.js');
          const resAdapter = {
            setHeader: (k, v) => res.setHeader(k, v),
            status(code) {
              res.statusCode = code;
              return this;
            },
            json(body) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(body));
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
      port: 5180,
      host: true,
    },
  };
});
