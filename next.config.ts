import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stagehand (AI browser agent) + Playwright are heavy, node-native server
  // deps — keep them out of the bundler and load them at runtime.
  serverExternalPackages: ["@browserbasehq/stagehand", "playwright-core"],
};

export default nextConfig;
