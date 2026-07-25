import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;

void import("@opennextjs/cloudflare").then((module) =>
  module.initOpenNextCloudflareForDev(),
);
