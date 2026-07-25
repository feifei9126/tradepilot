#!/bin/bash
set -e
NAME=$1
if [ -z "$NAME" ]; then
  echo "用法: bash scripts/create-plugin.sh <插件名称>"
  echo "示例: bash scripts/create-plugin.sh alibaba-integration"
  exit 1
fi
if [[ ! "$NAME" =~ ^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$ ]]; then
  echo "插件名只能包含小写字母、数字和连字符，长度不超过 64 个字符"
  exit 1
fi
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="$ROOT_DIR/plugins/$NAME"
if [ -e "$PLUGIN_DIR" ]; then
  echo "插件已存在: $PLUGIN_DIR"
  exit 1
fi
mkdir -p "$PLUGIN_DIR/backend" "$PLUGIN_DIR/frontend" "$PLUGIN_DIR/migrations"
cat > "$PLUGIN_DIR/plugin.json" << JSONEOF
{
  "name": "$NAME",
  "version": "1.0.0",
  "displayName": "请输入插件显示名称",
  "description": "请输入插件描述",
  "author": "Your Name",
  "license": "MIT",
  "permissions": ["read:contacts"],
  "hooks": [],
  "settings": [],
  "minAppVersion": "1.0.0"
}
JSONEOF
cat > "$PLUGIN_DIR/index.ts" << TSEOF
import type { PluginInstance, PluginManifest } from "../../src/plugins";
import manifest from "./plugin.json";

const plugin: PluginInstance = {
  manifest: manifest as unknown as PluginManifest,
  isActive: false,
  settings: {},
  async onLoad() { console.log('[Plugin]', manifest.displayName, 'loaded'); },
  async onUnload() { console.log('[Plugin]', manifest.displayName, 'unloaded'); },
  async onHook(_context) { return null; },
};
export default plugin;
TSEOF
echo "✅ 插件 \"$NAME\" 已创建在 $PLUGIN_DIR"
