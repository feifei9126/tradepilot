import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default async function nextConfig(phase: string): Promise<NextConfig> {
  // The Cloudflare emulator is only needed by next dev, not Docker builds/start.
  // Its glibc executable cannot run in the Alpine (musl) production image.
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
    await initOpenNextCloudflareForDev();
  }

  return {};
}
