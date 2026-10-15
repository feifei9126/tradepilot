import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default async function nextConfig(phase: string): Promise<NextConfig> {
  // Docker and the default local server run on Node.js, without Workerd.
  // Cloudflare binding emulation is opt-in and confined to next dev.
  if (
    phase === PHASE_DEVELOPMENT_SERVER &&
    process.env.TRADEPILOT_RUNTIME === "cloudflare"
  ) {
    const { initOpenNextCloudflareForDev } = await import(
      "@opennextjs/cloudflare"
    );
    await initOpenNextCloudflareForDev();
  }

  return {
    // The Node build traces pg-cloudflare's empty default export. OpenNext's
    // Workerd bundle also needs the conditionally exported socket implementation.
    outputFileTracingIncludes: {
      "/*": [
        "./node_modules/pg-cloudflare/dist/**/*",
        "./node_modules/pg-cloudflare/esm/**/*",
      ],
    },
  };
}
