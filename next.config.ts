import type { NextConfig } from "next";

// A static site: every page is rendered at build time from agent-eval-gate's published runs.
// BASE_PATH lets it live under a project path such as GitHub Pages' /agent-telemetry.
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.BASE_PATH || undefined,
  trailingSlash: true,
  turbopack: { root: process.cwd() },
};

export default nextConfig;
