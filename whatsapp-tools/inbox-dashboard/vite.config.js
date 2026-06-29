import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Different port from quickreply-tester (5280) so both can run side by side.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5281 },
});
