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

  return {};
}
