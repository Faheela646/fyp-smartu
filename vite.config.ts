import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  // Pre-bundle every heavy dependency up front so the dev server never stalls ("optimizing dependencies") mid-session.
  optimizeDeps: {
    include: [
      "react", "react-dom/client", "react-router-dom", "@tanstack/react-query", "zustand", "zustand/middleware", "axios", "framer-motion", "lucide-react",
      "recharts", "leaflet", "react-leaflet", "qrcode.react", "html5-qrcode", "sonner", "zod", "react-hook-form", "@hookform/resolvers/zod",
      "clsx", "tailwind-merge", "class-variance-authority", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-slot",
      "@radix-ui/react-tabs", "@radix-ui/react-switch",
    ],
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Small stable vendor chunks cached across deploys. Maps, charts and PDF are NOT forced into manual chunks: Rollup keeps them
        // attached to the lazy pages that import them, so they never load on the first screen.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "vendor-react";
          if (/node_modules\/(framer-motion|motion-)/.test(id)) return "vendor-motion";
          if (/node_modules\/@radix-ui/.test(id)) return "vendor-radix";
          if (/node_modules\/(@tanstack|zustand|axios|zod|react-hook-form|@hookform)/.test(id)) return "vendor-data";
        },
      },
    },
  },
});
