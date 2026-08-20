import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The web panel talks to /api/*, served by the Worker (worker/index.js)
      // + D1, not by Vite. Run `npm run worker:dev` alongside `npm run dev`
      // and this forwards API calls to it, so the React UI still gets full
      // Vite HMR while working against the real backend. `npm run cf:dev`
      // runs the built app through Wrangler alone for an end-to-end check
      // closer to production.
      "/api": "http://127.0.0.1:8788",
    },
  },
});
