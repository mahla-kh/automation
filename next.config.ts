import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Turbopack/webpack from bundling these Node-native packages.
  //
  // pdfjs-dist v6 uses a dynamic `import(workerSrc)` inside _setupFakeWorkerGlobal.
  // When bundled, Turbopack resolves that import to a non-existent chunk inside
  // `.next/dev/server/chunks/`, causing "Setting up fake worker failed".
  //
  // Marking them external forces Node.js to load them directly as native ESM/CJS
  // at runtime, bypassing Turbopack's module graph entirely.
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],
};

export default nextConfig;
