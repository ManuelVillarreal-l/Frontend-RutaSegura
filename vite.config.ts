import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Separate files for the libraries so the browser caches them.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          map: ["leaflet"],
          qr: ["jsqr", "qrcode"],
        },
      },
    },
  },
});
