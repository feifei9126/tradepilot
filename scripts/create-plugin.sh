#!/bin/bash
set -e
NAME=$1
if [ -z "$NAME" ]; then
  echo "用法: bash scripts/create-plugin.sh <插件名称>"
  echo "示例: bash scripts/create-plugin.sh alibaba-integration"
  exit 1
fi
PLUGIN_DIR="plugins/$NAME"
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
import { PluginInstance, PluginManifest, registerHook } from "../../src/plugins";
import manifest from "./plugin.json";

const plugin: PluginInstance = {
  manifest: manifest as unknown as PluginManifest,
  isActive: true, settings: {},
  async onLoad() { console.log('[Plugin]', manifest.displayName, 'loaded'); },
  async onUnload() { console.log('[Plugin]', manifest.displayName, 'unloaded'); },
  async onHook(context) { return null; },
};
export default plugin;
TSEOF
echo "✅ 插件 \"$NAME\" 已创建在 $PLUGIN_DIR"
