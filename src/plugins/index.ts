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
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
}

export type HookName =
  | "inquiry.received"
  | "inquiry.statusChanged"
  | "product.afterCreate"
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
  data: unknown;
  timestamp: Date;
}

export interface PluginInstance {
  manifest: PluginManifest;
  isActive: boolean;
  settings: Record<string, unknown>;

  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
  onHook?(context: HookContext): Promise<unknown>;
}
