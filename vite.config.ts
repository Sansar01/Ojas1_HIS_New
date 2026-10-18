import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // vendor code changes rarely → stays cached across deploys
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/react-router|react-dom|[\\/]react[\\/]|scheduler/.test(id))
            return "react";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("chart.js") || id.includes("react-chartjs-2"))
            return "charts";
          if (id.includes("@reduxjs") || id.includes("react-redux") || id.includes("immer") || id.includes("reselect"))
            return "redux";
        },
      },
    },
  },
});
