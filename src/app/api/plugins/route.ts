import { NextResponse } from "next/server";

// Plugin metadata sourced from plugin.json files
// In serverless (Cloudflare), plugins are bundled at build time
const PLUGIN_MANIFESTS: Record<string, any> = {
  "product-design": {
    name: "product-design",
    version: "1.0.0",
    displayName: "\u4ea7\u54c1\u8bbe\u8ba1",
    description: "AI \u5546\u54c1\u56fe\u751f\u6210\u3001\u4ea7\u54c1\u63cf\u8ff0\u6a21\u677f\u3001\u89c4\u683c\u4e66\u5bfc\u51fa\u3001\u4ea7\u54c1\u76ee\u5f55\u751f\u6210",
    author: "TradePilot Team",
    hasBackend: true,
    hasFrontend: true,
    hasMigrations: false,
    active: true,
    installed: true,
  },
};

export async function GET(req: Request) {
  const pluginList = Object.entries(PLUGIN_MANIFESTS).map(([name, manifest]) => ({
    name,
    dir: name,
    manifest,
    ...manifest,
  }));
  return NextResponse.json({ plugins: pluginList });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name } = body;
    if (!name) return NextResponse.json({ error: "\u63d2\u4ef6\u540d\u79f0\u5fc5\u586b" }, { status: 400 });

    if (PLUGIN_MANIFESTS[name]) {
      return NextResponse.json({ error: "\u63d2\u4ef6\u5df2\u5b58\u5728" }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      name,
      manifest: {
        name,
        version: "1.0.0",
        displayName: name,
        description: "\u8bf7\u586b\u5199\u63d2\u4ef6\u63cf\u8ff0",
        author: "Community Contributor",
        license: "MIT",
        permissions: ["read:contacts"],
        hooks: [],
        settings: [],
        minAppVersion: "1.0.0",
      },
      note: "Runtime plugin creation is not supported in serverless mode. Add plugins via the plugins/ directory and redeploy.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");
    if (!name) return NextResponse.json({ error: "\u63d2\u4ef6\u540d\u79f0\u5fc5\u586b" }, { status: 400 });
    if (!PLUGIN_MANIFESTS[name]) {
      return NextResponse.json({ error: "\u63d2\u4ef6\u4e0d\u5b58\u5728" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, message: `\u63d2\u4ef6 "${name}" \u5df2\u6807\u8bb0\u5378\u8f7d\uff08\u9700\u91cd\u65b0\u90e8\u7f72\u751f\u6548\uff09` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
