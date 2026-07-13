import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stagehand (AI browser agent) + Playwright are heavy, node-native server
  // deps — keep them out of the bundler and load them at runtime.
  serverExternalPackages: ["@browserbasehq/stagehand", "playwright-core"],
  // Vercel-Serverless: Die o. g. Pakete werden zur Laufzeit aus node_modules
  // geladen, aber das File-Tracing übersieht Nicht-JS-Assets (z. B.
  // playwright-core/browsers.json → "Cannot find module … browsers.json").
  // Darum die kompletten Pakete explizit in die Function-Bundles der
  // Browser-Routen zwingen.
  outputFileTracingIncludes: {
    "/api/analyze": [
      "./node_modules/playwright-core/**/*",
      "./node_modules/playwright-core/browsers.json",
      "./node_modules/@browserbasehq/stagehand/**/*",
    ],
    "/api/discover": [
      "./node_modules/playwright-core/**/*",
      "./node_modules/playwright-core/browsers.json",
    ],
  },
};

export default nextConfig;
