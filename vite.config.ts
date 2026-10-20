import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* Package boundaries, matched on `node_modules/<pkg>/` segments so a package
   like `react-router-dom` cannot swallow unrelated ids and a marker inside a
   filename can never skew the split. Vite module ids always use `/`. */
const FRAMEWORK_PACKAGES = [
  "react/",
  "react-dom/",
  "scheduler/",
  "react-router-dom/",
  "react-router/",
  "react-redux/",
  "@reduxjs/",
  "redux/",
  "redux-thunk/",
  "immer/",
  "reselect/",
  "use-sync-external-store/",
  // compiled helpers used by the framework packages themselves — if these
  // stayed in `vendor`, chunks would form a vendor→framework→vendor cycle
  // (Rollup warning) with an undefined execution order at runtime.
  "@babel/runtime/",
  "regenerator-runtime/",
  "tslib/",
];

const CHART_PACKAGES = ["chart.js/", "react-chartjs-2/", "@kurkle/"];

const belongsTo = (packages: string[], id: string) =>
  packages.some((pkg) => id.includes(`node_modules/${pkg}`));

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
