import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// host: true makes the dev server reachable from your phone on the same Wi-Fi.
// (No QuickReply proxy needed — the real chat happens in WhatsApp; this app only
// listens to Firestore and posts follow-ups to the n8n webhook.)
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5280 },
});
