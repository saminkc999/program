import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ Vite config for Netlify fullstack deployment
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // optional (for local dev)
  },
  // 👇 IMPORTANT: tell Vite to use relative base path for Netlify
  base: "./",
  // 👇 Proxy for local testing (optional)
  // When you run "npm run dev", your frontend can still call your backend
  // hosted as Netlify function at /.netlify/functions/server
  // Example: axios.get("/.netlify/functions/server/games")
  // will be proxied to http://localhost:8888/.netlify/functions/server during dev
  build: {
    outDir: "dist",
  },
});
