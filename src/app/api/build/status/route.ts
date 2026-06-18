import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import path from "path";

const BUILD_STATE_FILE = path.join(process.cwd(), "public", "apk", "build-state.json");
const APK_OUTPUT = path.join(process.cwd(), "public", "apk", "tradepilot.apk");

export async function GET() {
  // Check if APK file exists
  if (existsSync(APK_OUTPUT)) {
    const stats = require("fs").statSync(APK_OUTPUT);
    return NextResponse.json({
      ready: true,
      url: "/apk/tradepilot.apk",
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
    });
  }

  // Check build state
  if (existsSync(BUILD_STATE_FILE)) {
    try {
      const state = JSON.parse(readFileSync(BUILD_STATE_FILE, "utf8"));
      return NextResponse.json({
        ready: state.status === "ready",
        building: state.status === "building" || state.status === "queued",
        error: state.status === "error" ? (state.message || state.error) : null,
        message: state.message || null,
        url: state.url || null,
      });
    } catch {
      // Corrupted state file
    }
  }

  return NextResponse.json({ ready: false, building: false, error: null });
}
