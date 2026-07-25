"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Puzzle,
  Plus,
  Trash2,
  RefreshCw,
  Settings,
  Code,
  FolderOpen,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidPluginName } from "@/lib/plugin-name";
import type { PluginSetting } from "@/plugins";

interface PluginInfo {
  name: string;
  dir: string;
  manifest: {
    name: string;
    version: string;
    displayName: string;
    description: string;
    author: string;
    license: string;
    permissions?: string[];
    hooks?: string[];
    settings?: PluginSetting[];
    minAppVersion?: string;
  };
  hasBackend: boolean;
  hasFrontend: boolean;
  hasMigrations: boolean;
  active: boolean;
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [newPluginName, setNewPluginName] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | null>(null);
  const [pendingUninstall, setPendingUninstall] = useState<PluginInfo | null>(
    null,
  );
  const [uninstalling, setUninstalling] = useState(false);

  useEffect(() => {
    loadPlugins();
  }, []);

  async function loadPlugins() {
    setLoading(true);
    try {
      const r = await fetch("/api/plugins");
      const data = await r.json();
      if (!r.ok || !Array.isArray(data.plugins)) {
        throw new Error(data.error || "插件加载失败");
      }
      setPlugins(data.plugins);
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        toast.warning(`${data.warnings.length} 个插件清单无效，已跳过`);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "插件加载失败");
    }
    setLoading(false);
  }

  async function handleUninstall() {
    if (!pendingUninstall) return;
    const name = pendingUninstall.name;
    setUninstalling(true);
    try {
      const r = await fetch("/api/plugins?name=" + encodeURIComponent(name), {
        method: "DELETE",
      });
      if (r.ok) {
        toast.success("插件 " + name + " 已卸载");
        setPendingUninstall(null);
        await loadPlugins();
      } else {
        const d = await r.json();
        toast.error(d.error || "卸载失败");
      }
    } catch {
      toast.error("卸载失败");
    } finally {
      setUninstalling(false);
    }
  }

  function openPluginSettings(p: PluginInfo) {
    setSelectedPlugin(p);
  }

  async function handleCreate(name: string) {
    const normalizedName = name.trim();
    if (!isValidPluginName(normalizedName)) {
      toast.error("插件名只能包含小写字母、数字和连字符，长度不超过 64 个字符");
      return;
    }
    try {
      const r = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName }),
      });
      if (r.ok) {
        toast.success(`插件骨架 "${name}" 已创建`);
        setNewPluginName("");
        setShowCreator(false);
        loadPlugins();
      } else {
        const d = await r.json();
        toast.error(d.error || "创建失败");
      }
    } catch {
      toast.error("创建失败");
    }
  }

  function getLicenseColor(license: string) {
    const map: Record<string, string> = {
      MIT: "bg-green-100 text-green-700",
      GPL: "bg-orange-100 text-orange-700",
      Apache: "bg-blue-100 text-blue-700",
    };
    return map[license] || "bg-gray-100 text-gray-600";
  }

  const normalizedPluginName = newPluginName.trim();
  const pluginNameValid = isValidPluginName(normalizedPluginName);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/app"
            aria-label="返回上一页"
            className="mr-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Puzzle className="h-6 w-6 text-primary" />
            插件开发
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            管理插件源码目录与开发骨架
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={loadPlugins}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            刷新
          </Button>
          <Button
            size="sm"
            className="h-9"
            onClick={() => {
              setShowCreator(!showCreator);
              setNewPluginName("");
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {showCreator ? "查看插件" : "创建插件"}
          </Button>
        </div>
      </div>

      {showCreator ? (
        /* ===== Plugin scaffold creator ===== */
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                创建插件骨架
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                输入小写英文名称后，系统会在 <code>plugins/</code>{" "}
                下创建清单和入口文件。插件不会自动执行，需完成代码审查并接入运行时后再启用。
              </p>
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-muted-foreground" />
                <input
                  className="flex-1 h-9 px-3 rounded-lg border text-sm bg-transparent"
                  placeholder="输入自定义插件名称创建..."
                  value={newPluginName}
                  onChange={(e) => setNewPluginName(e.target.value)}
                  maxLength={64}
                  aria-invalid={Boolean(newPluginName) && !pluginNameValid}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    pluginNameValid &&
                    handleCreate(normalizedPluginName)
                  }
                />
                <Button
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() =>
                    pluginNameValid && handleCreate(normalizedPluginName)
                  }
                  disabled={!pluginNameValid}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  创建
                </Button>
              </div>
              <p
                className={cn(
                  "text-xs",
                  newPluginName && !pluginNameValid
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {newPluginName && !pluginNameValid ? (
                  "仅支持小写字母、数字和连字符，且不能以连字符开头或结尾"
                ) : (
                  <>
                    创建的插件可在{" "}
                    <code className="text-primary bg-primary/10 px-1 rounded">
                      plugins/
                    </code>{" "}
                    目录中编辑
                  </>
                )}
              </p>
            </CardContent>
          </Card>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">💡 CLI 创建插件</p>
              <p>在终端执行：</p>
              <code className="block mt-1 px-3 py-1.5 bg-white rounded text-xs font-mono">
                bash scripts/create-plugin.sh my-plugin
              </code>
              <p className="mt-1">
                将会在{" "}
                <code className="text-primary bg-white/50 px-1 rounded">
                  plugins/my-plugin/
                </code>{" "}
                生成完整插件骨架
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ===== Installed Plugins ===== */
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                已安装插件
                <Badge variant="secondary" className="ml-2 text-xs">
                  {plugins.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  加载中...
                </div>
              ) : plugins.length === 0 ? (
                <div className="py-10 text-center">
                  <Puzzle className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    暂无插件源码目录
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    点击「创建插件」生成开发骨架
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {plugins.map((p) => (
                    <div
                      key={p.name}
                      className="border rounded-lg p-4 hover:border-primary/20 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm">
                              {p.manifest.displayName}
                            </h3>
                            <Badge
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {p.manifest.version}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                getLicenseColor(p.manifest.license),
                              )}
                            >
                              {p.manifest.license}
                            </Badge>
                            {p.active ? (
                              <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-200">
                                已激活
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                待接入运行时
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {p.manifest.description}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>👤 {p.manifest.author}</span>
                            {p.hasBackend && (
                              <span className="inline-flex items-center gap-0.5">
                                <Code className="h-3 w-3" />
                                后端
                              </span>
                            )}
                            {p.hasFrontend && (
                              <span className="inline-flex items-center gap-0.5">
                                <ExternalLink className="h-3 w-3" />
                                前端
                              </span>
                            )}
                            {p.hasMigrations && (
                              <span className="inline-flex items-center gap-0.5">
                                <Settings className="h-3 w-3" />
                                数据库
                              </span>
                            )}
                          </div>
                          {p.manifest.hooks && p.manifest.hooks.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {p.manifest.hooks.map((h) => (
                                <span
                                  key={h}
                                  className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-xs"
                                >
                                  {h}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPluginSettings(p);
                            }}
                            aria-label={`查看 ${p.manifest.displayName} 清单`}
                            title="查看插件清单"
                          >
                            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingUninstall(p);
                            }}
                            aria-label={`卸载 ${p.manifest.displayName}`}
                            title="卸载插件"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                        <code className="text-primary bg-primary/5 px-1 rounded">
                          plugins/{p.name}/
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Plugin Detail Dialog */}
      <Dialog
        open={!!selectedPlugin}
        onOpenChange={(o) => {
          if (!o) setSelectedPlugin(null);
        }}
      >
        <DialogContent className="max-w-lg">
          {selectedPlugin && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Puzzle className="h-5 w-5 text-primary" />
                  {selectedPlugin.manifest.displayName}
                  <Badge variant="outline" className="text-xs font-mono ml-2">
                    {selectedPlugin.manifest.version}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  {selectedPlugin.manifest.description}
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground">作者</span>
                    <p className="font-medium mt-0.5">
                      {selectedPlugin.manifest.author}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground">许可协议</span>
                    <p className="font-medium mt-0.5">
                      {selectedPlugin.manifest.license}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground">目录</span>
                    <code className="text-primary font-medium mt-0.5 block">
                      plugins/{selectedPlugin.name}/
                    </code>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground">最低版本</span>
                    <p className="font-medium mt-0.5">
                      {selectedPlugin.manifest.minAppVersion || "1.0.0"}
                    </p>
                  </div>
                </div>

                {selectedPlugin.manifest.permissions &&
                  selectedPlugin.manifest.permissions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        权限
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedPlugin.manifest.permissions.map((p) => (
                          <Badge
                            key={p}
                            variant="secondary"
                            className="text-[10px] h-5"
                          >
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {selectedPlugin.manifest.hooks &&
                  selectedPlugin.manifest.hooks.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        钩子
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedPlugin.manifest.hooks.map((h) => (
                          <Badge
                            key={h}
                            variant="outline"
                            className="text-[10px] h-5 bg-purple-50 text-purple-600"
                          >
                            {h}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {selectedPlugin.manifest.settings &&
                  selectedPlugin.manifest.settings.length > 0 && (
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        清单默认值
                      </p>
                      <p className="mb-2 text-xs text-muted-foreground">
                        当前插件尚未接入运行时，默认值仅供审查，不会在此处保存。
                      </p>
                      <div className="space-y-2.5">
                        {selectedPlugin.manifest.settings.map((s) => (
                          <div key={s.key}>
                            <label className="text-xs text-muted-foreground block mb-1">
                              {s.label}
                            </label>
                            <div className="rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs">
                              {s.type === "password" && s.defaultValue
                                ? "已在清单中设置"
                                : String(s.defaultValue ?? "未设置")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="flex justify-between pt-2 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setPendingUninstall(selectedPlugin);
                      setSelectedPlugin(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    卸载插件
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSelectedPlugin(null)}
                  >
                    关闭
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingUninstall}
        onOpenChange={(open) => {
          if (!open && !uninstalling) setPendingUninstall(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>卸载插件源码</DialogTitle>
            <DialogDescription>
              将永久删除 plugins/{pendingUninstall?.name}/
              目录。插件目前未接入运行时，但目录内容仍会丢失。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingUninstall(null)}
              disabled={uninstalling}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleUninstall}
              disabled={uninstalling}
            >
              {uninstalling && (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              )}
              确认卸载
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
