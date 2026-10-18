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
    target: "es2020",
    sourcemap: false,

    rollupOptions: {
      output: {
        /**
         * Three stable vendor chunks instead of one everything-bundle:
         *
         *   charts-vendor → chart.js + react-chartjs-2. Only DashboardPage
         *             imports them, and DashboardPage is a lazy route — so
         *             first-time visitors (login screen) never download
         *             chart code.
         *   framework → react, react-dom, scheduler, react-router(+dom),
         *             redux + toolkit/react-redux/immer/reselect. The shell
         *             itself depends on these, so they are eagerly needed,
         *             but they change far more slowly than app code —
         *             isolating them means an app-only release re-uses the
         *             cached framework chunk (see netlify.toml's immutable
         *             /assets policy).
         *   vendor   → the remaining libraries (radix, lucide, axios,
         *             clsx, tailwind-merge, …).
         *
         * Feature screens keep their own per-page chunks from the `lazy()`
         * route imports, cache-busted by content hashes and staying valid
         * across releases that only touch other chunks.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (belongsTo(CHART_PACKAGES, id)) return "charts-vendor";
          if (belongsTo(FRAMEWORK_PACKAGES, id)) return "framework";
          return "vendor";
        },
      },
    },
  },
});
