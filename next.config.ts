import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Hide the Next.js dev badge (and its "Cache disabled" pill); build and runtime errors still show.
  devIndicators: false,
  partialPrefetching: true,
  // The QR sticker reads Inter and the logo from disk at request time; ship them with that route when deployed.
  outputFileTracingIncludes: {
    "/api/tables/[id]/qr": ["./src/assets/fonts/*.ttf", "./public/brand/tawilati-horizontal.svg"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
