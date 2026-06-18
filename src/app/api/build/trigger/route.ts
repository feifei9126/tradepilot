import { NextResponse } from "next/server";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

const BUILD_STATE_FILE = path.join(process.cwd(), "public", "apk", "build-state.json");
const APK_OUTPUT = path.join(process.cwd(), "public", "apk", "tradepilot.apk");

export async function POST() {
  const dir = path.dirname(BUILD_STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Check if APK already exists
  if (existsSync(APK_OUTPUT)) {
    writeFileSync(BUILD_STATE_FILE, JSON.stringify({ status: "ready", url: "/apk/tradepilot.apk" }));
    return NextResponse.json({ success: true, message: "APK 已就绪", url: "/apk/tradepilot.apk" });
  }

  // Try EAS build
  const { execSync } = require("child_process");
  try {
    const whoami = execSync("npx eas whoami 2>/dev/null", {
      cwd: path.join(process.cwd(), "..", "tradepilot-mobile"),
      encoding: "utf8",
      timeout: 10000,
    }).trim();
    if (whoami && !whoami.includes("Not logged") && !whoami.includes("not logged")) {
      // EAS is logged in - trigger build
      writeFileSync(BUILD_STATE_FILE, JSON.stringify({ status: "building", startedAt: new Date().toISOString() }));
      execSync("npx eas build --platform android --profile preview --non-interactive --no-wait 2>&1", {
        cwd: path.join(process.cwd(), "..", "tradepilot-mobile"),
        encoding: "utf8",
        timeout: 30000,
      });
      return NextResponse.json({
        success: true,
        message: "EAS 构建已提交！查看进度: npx eas build:list",
      });
    }
  } catch {}

  // Not logged in to EAS - provide instructions
  writeFileSync(BUILD_STATE_FILE, JSON.stringify({
    status: "error",
    message: "需要 EAS 登录",
    instructions: [
      "注册 Expo 账号: https://expo.dev/signup",
      "运行: cd tradepilot-mobile && npx eas login",
      "运行: npx eas build -p android --profile preview",
      "下载 APK 放到 public/apk/tradepilot.apk",
    ],
  }));

  return NextResponse.json({
    success: false,
    message: "需要登录 EAS。请先注册 Expo 账号并运行 npx eas login。",
    easUrl: "https://expo.dev/signup",
  });
}
