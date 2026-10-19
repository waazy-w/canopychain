import type { NextConfig } from "next";

// Cache Components and Partial Prefetching are off: almost every page is a client-side wallet/map
// view, and Cache Components keeps hidden routes mounted (<Activity>), which keeps Leaflet maps alive.
const X402_STUB = "./src/lib/stubs/x402.cjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Optional peers of @coinbase/cdp-sdk that aren't installed; see the stub for details.
    resolveAlias: {
      "@x402/core/client": X402_STUB,
      "@x402/evm": X402_STUB,
      "@x402/evm/exact/client": X402_STUB,
      "@x402/evm/upto/client": X402_STUB,
      "@x402/svm/exact/client": X402_STUB,
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
