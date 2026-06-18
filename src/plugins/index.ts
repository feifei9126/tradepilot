// ========================================
// TradePilot 插件系统核心
// 设计参考：研究报告第5章
// ========================================

export interface PluginManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  permissions: string[];
  hooks: string[];
  settings: PluginSetting[];
  minAppVersion: string;
}

export interface PluginSetting {
  key: string;
  type: "string" | "password" | "boolean" | "select";
  label: string;
  required?: boolean;
  defaultValue?: any;
  options?: { label: string; value: string }[];
}

// 钩子定义
export type HookName =
  | "inquiry.received"
  | "inquiry.statusChanged"
  | "contact.beforeCreate"
  | "contact.afterCreate"
  | "quotation.beforeSend"
  | "order.created"
  | "order.statusChanged"
  | "document.generated"
  | "ai.emailGenerate.beforePrompt"
  | "ai.intentAnalysis.afterComplete"
  | "message.received";

export interface HookContext {
  hook: HookName;
  data: any;
  timestamp: Date;
}

// 插件实例接口
export interface PluginInstance {
  manifest: PluginManifest;
  isActive: boolean;
  settings: Record<string, any>;

  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
  onHook?(context: HookContext): Promise<any>;
}

// ---- 钩子注册表 ----
const hookHandlers = new Map<HookName, ((context: HookContext) => Promise<any>)[]>();

export function registerHook(hook: HookName, handler: (context: HookContext) => Promise<any>) {
  if (!hookHandlers.has(hook)) hookHandlers.set(hook, []);
  hookHandlers.get(hook)!.push(handler);
}

export async function triggerHook(hook: HookName, data: any): Promise<any[]> {
  // Ponytail: hook system activated - log every hook trigger
  console.log(`[Hooks] \u89e6\u53d1: ${hook}`);
  const handlers = hookHandlers.get(hook) || [];
  const results: any[] = [];
  for (const handler of handlers) {
    try {
      const result = await handler({ hook, data, timestamp: new Date() });
      results.push(result);
      console.log(`[Hooks] ${hook} \u5904\u7406\u5b8c\u6210:`, result);
    } catch (e: any) {
      console.error(`[Plugin] Hook ${hook} error:`, e.message);
    }
  }
  if (results.length === 0) {
    console.log(`[Hooks] ${hook} \u65e0\u5904\u7406\u5668\u6ce8\u518c`);
  }
  return results;
}

// \u6ce8\u518c\u9ed8\u8ba4\u94a9\u5b50\u5904\u7406\u5668
registerHook("contact.afterCreate", async (ctx) => {
  console.log(`[Hooks] \u2605 \u65b0\u5ba2\u6237: ${ctx.data.name} (${ctx.data.country || "\u672a\u77e5"})`);
  return { handled: true, source: "core" };
});
registerHook("inquiry.received", async (ctx) => {
  console.log(`[Hooks] \u2605 \u65b0\u8be2\u76d8: ${ctx.data.customer} - ${ctx.data.subject || "\u65e0\u4e3b\u9898"}`);
  return { handled: true, source: "core" };
});
registerHook("order.created", async (ctx) => {
  console.log(`[Hooks] \u2605 \u65b0\u8ba2\u5355: ${ctx.data.no} - $${ctx.data.totalAmount || 0}`);
  return { handled: true, source: "core" };
});
registerHook("order.statusChanged", async (ctx) => {
  console.log(`[Hooks] \u2605 \u8ba2\u5355\u72b6\u6001: ${ctx.data.no} \u2192 ${ctx.data.status}`);
  return { handled: true, source: "core" };
});

// ---- \u63d2\u4ef6\u7ba1\u7406\u5668 ----
const plugins = new Map<string, PluginInstance>();

export const pluginManager = {
  listPlugins: () => [...plugins.values()],

  getPlugin: (name: string) => plugins.get(name),

  async installPlugin(manifest: PluginManifest, factory: () => PluginInstance): Promise<PluginInstance> {
    if (plugins.has(manifest.name)) throw new Error(`插件 "${manifest.name}" 已安装`);
    const instance = factory();
    plugins.set(manifest.name, instance);
    if (instance.onLoad) await instance.onLoad();
    return instance;
  },

  async uninstallPlugin(name: string): Promise<boolean> {
    const instance = plugins.get(name);
    if (!instance) return false;
    if (instance.onUnload) await instance.onUnload();
    plugins.delete(name);
    return true;
  },

  validateManifest(manifest: any): manifest is PluginManifest {
    return !!(manifest.name && manifest.version && manifest.displayName);
  },
};
