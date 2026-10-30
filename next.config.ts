import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: [
      // A browser redirect from an image host cannot escape this allowlist.
      { key: "Content-Security-Policy", value: "img-src 'self' blob: data: https://images.qloo.com https://staging.images.qloo.com;" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ] }];
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
