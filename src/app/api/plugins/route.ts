import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PLUGINS_DIR = path.join(process.cwd(), "plugins");
const TEMPLATE_SOURCE = path.join(PLUGINS_DIR, "product-design");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pluginList: any[] = [];

  try {
    if (fs.existsSync(PLUGINS_DIR)) {
      for (const dir of fs.readdirSync(PLUGINS_DIR)) {
        const pp = path.join(PLUGINS_DIR, dir);
        if (!fs.statSync(pp).isDirectory()) continue;
        const mp = path.join(pp, "plugin.json");
        if (!fs.existsSync(mp)) continue;
        try {
          const manifest = JSON.parse(fs.readFileSync(mp, "utf-8"));
          pluginList.push({
            name: dir, dir, manifest,
            hasBackend: fs.existsSync(path.join(pp, "backend")),
            hasFrontend: fs.existsSync(path.join(pp, "frontend")),
            hasMigrations: fs.existsSync(path.join(pp, "migrations")),
            active: true, installed: true,
          });
        } catch {}
      }
    }
  } catch {}

  return NextResponse.json({ plugins: pluginList });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name } = body;
    if (!name) return NextResponse.json({ error: "\u63d2\u4ef6\u540d\u79f0\u5fc5\u586b" }, { status: 400 });

    const pluginPath = path.join(PLUGINS_DIR, name);
    if (fs.existsSync(pluginPath)) {
      return NextResponse.json({ error: "\u63d2\u4ef6\u5df2\u5b58\u5728" }, { status: 409 });
    }

    // Copy from product-design template, then update manifest
    if (fs.existsSync(TEMPLATE_SOURCE)) {
      fs.cpSync(TEMPLATE_SOURCE, pluginPath, { recursive: true });
      const manifestPath = path.join(pluginPath, "plugin.json");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      manifest.name = name;
      manifest.displayName = name;
      manifest.description = "\u8bf7\u586b\u5199\u63d2\u4ef6\u63cf\u8ff0";
      manifest.hooks = [];
      manifest.settings = [];
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      return NextResponse.json({ ok: true, name, manifest, fromTemplate: true });
    }

    // Fallback: create skeleton
    fs.mkdirSync(path.join(pluginPath, "backend"), { recursive: true });
    fs.mkdirSync(path.join(pluginPath, "frontend"), { recursive: true });
    fs.mkdirSync(path.join(pluginPath, "migrations"), { recursive: true });
    const manifest = { name, version: "1.0.0", displayName: name, description: "\u8bf7\u586b\u5199\u63d2\u4ef6\u63cf\u8ff0", author: "Community Contributor", license: "MIT", permissions: ["read:contacts"], hooks: [], settings: [], minAppVersion: "1.0.0" };
    fs.writeFileSync(path.join(pluginPath, "plugin.json"), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(pluginPath, "index.ts"), `import { PluginInstance, PluginManifest } from "../../src/plugins";
const plugin: PluginInstance = { manifest: manifest as unknown as PluginManifest, isActive: true, settings: {}, async onLoad() {}, async onUnload() {}, async onHook(context) { return null; }, };
export default plugin;`);
    return NextResponse.json({ ok: true, name, manifest });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");
    if (!name) return NextResponse.json({ error: "\u63d2\u4ef6\u540d\u79f0\u5fc5\u586b" }, { status: 400 });
    const pluginPath = path.join(PLUGINS_DIR, name);
    if (!fs.existsSync(pluginPath)) return NextResponse.json({ error: "\u63d2\u4ef6\u4e0d\u5b58\u5728" }, { status: 404 });
    fs.rmSync(pluginPath, { recursive: true, force: true });
    return NextResponse.json({ ok: true, message: `\u63d2\u4ef6 "${name}" \u5df2\u5378\u8f7d` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
