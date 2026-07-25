import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isValidPluginName } from "@/lib/plugin-name";

const PLUGINS_DIR = path.join(process.cwd(), "plugins");

interface PluginManifestData {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  permissions: string[];
  hooks: string[];
  settings: PluginSettingData[];
  minAppVersion: string;
}

interface PluginSettingData {
  key: string;
  type: "string" | "password" | "boolean" | "select";
  label: string;
  required?: boolean;
  defaultValue?: string | number | boolean | null;
  options?: { label: string; value: string }[];
}

function pluginPathFor(name: string) {
  if (!isValidPluginName(name))
    throw new Error("插件名只能包含小写字母、数字和连字符");
  return path.join(PLUGINS_DIR, name);
}

function stringField(value: unknown, field: string, maxLength = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new Error(`插件清单字段 ${field} 无效`);
  }
  return value.trim();
}

function stringArray(value: unknown, field: string) {
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some((item) => typeof item !== "string" || item.length > 200)
  ) {
    throw new Error(`插件清单字段 ${field} 无效`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function parseSettings(value: unknown): PluginSettingData[] {
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error("插件清单字段 settings 无效");
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("插件清单设置项格式无效");
    }
    const raw = entry as Record<string, unknown>;
    const type = raw.type;
    if (!["string", "password", "boolean", "select"].includes(String(type))) {
      throw new Error("插件清单设置项类型无效");
    }
    const defaultValue = raw.defaultValue;
    if (
      defaultValue !== undefined &&
      defaultValue !== null &&
      !["string", "number", "boolean"].includes(typeof defaultValue)
    ) {
      throw new Error("插件清单设置项默认值无效");
    }
    const options = raw.options;
    if (
      options !== undefined &&
      (!Array.isArray(options) ||
        options.length > 100 ||
        options.some(
          (option) =>
            !option ||
            typeof option !== "object" ||
            typeof (option as Record<string, unknown>).label !== "string" ||
            typeof (option as Record<string, unknown>).value !== "string",
        ))
    ) {
      throw new Error("插件清单设置项选项无效");
    }
    return {
      key: stringField(raw.key, "settings.key", 100),
      type: type as PluginSettingData["type"],
      label: stringField(raw.label, "settings.label", 200),
      required: raw.required === true || undefined,
      defaultValue: defaultValue as PluginSettingData["defaultValue"],
      options: Array.isArray(options)
        ? options.map((option) => ({
            label: stringField(
              (option as Record<string, unknown>).label,
              "settings.options.label",
              100,
            ),
            value: stringField(
              (option as Record<string, unknown>).value,
              "settings.options.value",
              100,
            ),
          }))
        : undefined,
    };
  });
}

function parseManifest(
  value: unknown,
  directoryName: string,
): PluginManifestData {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("插件清单格式无效");
  const raw = value as Record<string, unknown>;
  const name = stringField(raw.name, "name", 64);
  if (name !== directoryName || !isValidPluginName(name))
    throw new Error("插件清单名称与目录不一致");
  return {
    name,
    version: stringField(raw.version, "version", 40),
    displayName: stringField(raw.displayName, "displayName"),
    description: stringField(raw.description, "description", 2_000),
    author: stringField(raw.author, "author"),
    license: stringField(raw.license, "license", 100),
    permissions: stringArray(raw.permissions, "permissions"),
    hooks: stringArray(raw.hooks, "hooks"),
    settings: parseSettings(raw.settings),
    minAppVersion: stringField(raw.minAppVersion, "minAppVersion", 40),
  };
}

export async function GET() {
  const pluginList: {
    name: string;
    dir: string;
    manifest: PluginManifestData;
    hasBackend: boolean;
    hasFrontend: boolean;
    hasMigrations: boolean;
    active: boolean;
    installed: boolean;
  }[] = [];
  const warnings: string[] = [];

  try {
    if (fs.existsSync(PLUGINS_DIR)) {
      for (const dir of fs.readdirSync(PLUGINS_DIR)) {
        const pp = path.join(PLUGINS_DIR, dir);
        if (!isValidPluginName(dir) || !fs.lstatSync(pp).isDirectory())
          continue;
        const mp = path.join(pp, "plugin.json");
        if (!fs.existsSync(mp)) continue;
        try {
          const manifest = parseManifest(
            JSON.parse(fs.readFileSync(mp, "utf-8")),
            dir,
          );
          pluginList.push({
            name: dir,
            dir,
            manifest,
            hasBackend: fs.existsSync(path.join(pp, "backend")),
            hasFrontend: fs.existsSync(path.join(pp, "frontend")),
            hasMigrations: fs.existsSync(path.join(pp, "migrations")),
            active: false,
            installed: true,
          });
        } catch (error: unknown) {
          warnings.push(
            `${dir}: ${error instanceof Error ? error.message : "插件清单无效"}`,
          );
        }
      }
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "插件目录读取失败" },
      { status: 500 },
    );
  }

  return NextResponse.json({ plugins: pluginList, warnings });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name)
      return NextResponse.json(
        { error: "\u63d2\u4ef6\u540d\u79f0\u5fc5\u586b" },
        { status: 400 },
      );

    const pluginPath = pluginPathFor(name);
    if (fs.existsSync(pluginPath)) {
      return NextResponse.json(
        { error: "\u63d2\u4ef6\u5df2\u5b58\u5728" },
        { status: 409 },
      );
    }

    fs.mkdirSync(pluginPath, { recursive: true });
    const manifest: PluginManifestData = {
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
    };
    fs.writeFileSync(
      path.join(pluginPath, "plugin.json"),
      JSON.stringify(manifest, null, 2),
    );
    fs.writeFileSync(
      path.join(pluginPath, "index.ts"),
      `import type { PluginInstance, PluginManifest } from "../../src/plugins";
import manifest from "./plugin.json";
const plugin: PluginInstance = { manifest: manifest as unknown as PluginManifest, isActive: false, settings: {}, async onLoad() {}, async onUnload() {}, async onHook(_context) { return null; }, };
export default plugin;`,
    );
    return NextResponse.json({ ok: true, name, manifest });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "插件创建失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get("name");
    if (!name)
      return NextResponse.json(
        { error: "\u63d2\u4ef6\u540d\u79f0\u5fc5\u586b" },
        { status: 400 },
      );
    const pluginPath = pluginPathFor(name);
    if (!fs.existsSync(pluginPath))
      return NextResponse.json(
        { error: "\u63d2\u4ef6\u4e0d\u5b58\u5728" },
        { status: 404 },
      );
    fs.rmSync(pluginPath, { recursive: true, force: true });
    return NextResponse.json({
      ok: true,
      message: `\u63d2\u4ef6 "${name}" \u5df2\u5378\u8f7d`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "插件卸载失败" },
      { status: 400 },
    );
  }
}
