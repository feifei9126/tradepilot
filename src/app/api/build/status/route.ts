import { NextResponse } from "next/server";
import { existsSync, statSync } from "fs";
import path from "path";

const APK_OUTPUT = path.join(process.cwd(), "public", "apk", "tradepilot.apk");

export async function GET() {
  // Check if APK file exists
  if (existsSync(APK_OUTPUT)) {
    const stats = statSync(APK_OUTPUT);
    return NextResponse.json({
      ready: true,
      url: "/apk/tradepilot.apk",
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
    });
  }

  return NextResponse.json({ ready: false });
}
