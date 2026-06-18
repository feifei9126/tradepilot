"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Puzzle, Plus, Download, Trash2, Check, X, RefreshCw,
  Settings, Code, FolderOpen, ExternalLink, AlertCircle, Info
} from "lucide-react";

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
    settings?: any[];
    minAppVersion?: string;
  };
  hasBackend: boolean;
  hasFrontend: boolean;
  hasMigrations: boolean;
  active: boolean;
}

export default function PluginsPage() {
  const router = useRouter();
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [newPluginName, setNewPluginName] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | null>(null);
  const [pluginSettings, setPluginSettings] = useState<Record<string, any>>({});
  const [marketplaceTemplates, setMarketplaceTemplates] = useState<any[]>([]);

  useEffect(() => { loadPlugins(); }, []);

  async function loadMarketplace() {
    try {
      const r = await fetch("/api/plugins?marketplace=true");
      const d = await r.json();
      setMarketplaceTemplates(d.plugins || []);
    } catch {}
  }

  async function loadPlugins() {
    setLoading(true);
    try {
      const r = await fetch("/api/plugins");
      const data = await r.json();
      setPlugins(data.plugins || []);
    } catch { toast.error("加载失败"); }
    setLoading(false);
  }

  async function handleUninstall(name: string) {
    if (!confirm("确定要卸载插件 " + name + " 吗？\n插件目录将被永久删除。")) return;
    try {
      const r = await fetch("/api/plugins?name=" + encodeURIComponent(name), { method: "DELETE" });
      if (r.ok) { toast.success("插件 " + name + " 已卸载"); loadPlugins(); }
      else { const d = await r.json(); toast.error(d.error || "卸载失败"); }
    } catch { toast.error("卸载失败"); }
  }

  function openPluginSettings(p: PluginInfo) {
    setSelectedPlugin(p);
    const settings: Record<string, any> = {};
    if (p.manifest.settings) {
      p.manifest.settings.forEach(s => { settings[s.key] = s.defaultValue || ""; });
    }
    setPluginSettings(settings);
  }

  async function handleInstall(name: string) {
    if (!name.trim()) return;
    try {
      const r = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (r.ok) { toast.success(`插件 "${name}" 已安装`); setNewPluginName(""); loadPlugins(); }
      else { const d = await r.json(); toast.error(d.error || "安装失败"); }
    } catch { toast.error("安装失败"); }
  }

  function getLicenseColor(license: string) {
    const map: Record<string, string> = { "MIT": "bg-green-100 text-green-700", "GPL": "bg-orange-100 text-orange-700", "Apache": "bg-blue-100 text-blue-700" };
    return map[license] || "bg-gray-100 text-gray-600";
  }

  

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="mr-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Puzzle className="h-6 w-6 text-primary" />
            插件市场
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">扩展 TradePilot 功能</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={loadPlugins} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button size="sm" className="h-9" onClick={() => { setShowMarketplace(!showMarketplace); setNewPluginName(""); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            {showMarketplace ? "已安装插件" : "探索市场"}
          </Button>
        </div>
      </div>

      {showMarketplace ? (
        /* ===== Marketplace ===== */
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                从市场安装
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">点击插件一键安装，或输入自定义名称创建新插件</p>
              <div className="grid gap-3 md:grid-cols-2">
                {marketplaceTemplates.map((p: any) => {
                  const installed = p.installed;
                  return (
                    <div key={p.name} className="border rounded-lg p-4 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-sm">{p.display}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">{p.author}</span>
                        <Button size="sm" variant={installed ? "secondary" : "default"} className="h-7 text-xs"
                          disabled={installed} onClick={() => handleInstall(p.name)}>
                          {installed ? <Check className="h-3 w-3 mr-1" /> : <Download className="h-3 w-3 mr-1" />}
                          {installed ? "已安装" : "安装"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator className="my-3" />
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-muted-foreground" />
                <input
                  className="flex-1 h-9 px-3 rounded-lg border text-sm bg-transparent"
                  placeholder="输入自定义插件名称创建..."
                  value={newPluginName}
                  onChange={e => setNewPluginName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && newPluginName.trim() && handleInstall(newPluginName.trim())}
                />
                <Button size="sm" className="h-9 text-xs" onClick={() => newPluginName.trim() && handleInstall(newPluginName.trim())} disabled={!newPluginName.trim()}>
                  <Plus className="h-3.5 w-3.5 mr-1" />创建
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">创建的插件可在 <code className="text-primary bg-primary/10 px-1 rounded">plugins/</code> 目录中编辑</p>
            </CardContent>
          </Card>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">💡 CLI 创建插件</p>
              <p>在终端执行：</p>
              <code className="block mt-1 px-3 py-1.5 bg-white rounded text-xs font-mono">
                bash /Users/mac/tradepilot/scripts/create-plugin.sh my-plugin
              </code>
              <p className="mt-1">将会在 <code className="text-primary bg-white/50 px-1 rounded">plugins/my-plugin/</code> 生成完整插件骨架</p>
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
                <Badge variant="secondary" className="ml-2 text-xs">{plugins.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
              ) : plugins.length === 0 ? (
                <div className="py-10 text-center">
                  <Puzzle className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">暂无已安装的插件</p>
                  <p className="text-xs text-muted-foreground mt-1">点击「探索市场」安装或创建插件</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {plugins.map((p) => (
                    <div key={p.name} className="border rounded-lg p-4 hover:border-primary/20 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm">{p.manifest.displayName}</h3>
                            <Badge variant="outline" className="text-xs font-mono">{p.manifest.version}</Badge>
                            <Badge variant="secondary" className={cn("text-xs", getLicenseColor(p.manifest.license))}>
                              {p.manifest.license}
                            </Badge>
                            {p.active && <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-200">已激活</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{p.manifest.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>👤 {p.manifest.author}</span>
                            {p.hasBackend && <span className="inline-flex items-center gap-0.5"><Code className="h-3 w-3" />后端</span>}
                            {p.hasFrontend && <span className="inline-flex items-center gap-0.5"><ExternalLink className="h-3 w-3" />前端</span>}
                            {p.hasMigrations && <span className="inline-flex items-center gap-0.5"><Settings className="h-3 w-3" />数据库</span>}
                          </div>
                          {p.manifest.hooks && p.manifest.hooks.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {p.manifest.hooks.map(h => (
                                <span key={h} className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-xs">
                                  {h}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); openPluginSettings(p); }}>
                            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => { e.stopPropagation(); handleUninstall(p.name); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                        <code className="text-primary bg-primary/5 px-1 rounded">plugins/{p.name}/</code>
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
      <Dialog open={!!selectedPlugin} onOpenChange={(o) => { if (!o) setSelectedPlugin(null); }}>
        <DialogContent className="max-w-lg">
          {selectedPlugin && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Puzzle className="h-5 w-5 text-primary" />
                  {selectedPlugin.manifest.displayName}
                  <Badge variant="outline" className="text-xs font-mono ml-2">{selectedPlugin.manifest.version}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">{selectedPlugin.manifest.description}</p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground">作者</span>
                    <p className="font-medium mt-0.5">{selectedPlugin.manifest.author}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground">许可协议</span>
                    <p className="font-medium mt-0.5">{selectedPlugin.manifest.license}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground">目录</span>
                    <code className="text-primary font-medium mt-0.5 block">plugins/{selectedPlugin.name}/</code>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2.5">
                    <span className="text-muted-foreground">最低版本</span>
                    <p className="font-medium mt-0.5">{selectedPlugin.manifest.minAppVersion || "1.0.0"}</p>
                  </div>
                </div>

                {selectedPlugin.manifest.permissions && selectedPlugin.manifest.permissions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">权限</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPlugin.manifest.permissions.map(p => (
                        <Badge key={p} variant="secondary" className="text-[10px] h-5">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPlugin.manifest.hooks && selectedPlugin.manifest.hooks.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">钩子</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPlugin.manifest.hooks.map(h => (
                        <Badge key={h} variant="outline" className="text-[10px] h-5 bg-purple-50 text-purple-600">{h}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPlugin.manifest.settings && selectedPlugin.manifest.settings.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">插件设置</p>
                    <div className="space-y-2.5">
                      {selectedPlugin.manifest.settings.map(s => (
                        <div key={s.key}>
                          <label className="text-xs text-muted-foreground block mb-1">{s.label}</label>
                          {s.type === "boolean" ? (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={!!pluginSettings[s.key]}
                                onChange={e => setPluginSettings({...pluginSettings, [s.key]: e.target.checked})}
                                className="rounded" />
                              <span className="text-sm">{s.label}</span>
                            </label>
                          ) : s.type === "select" && s.options ? (
                            <select value={pluginSettings[s.key] || ""}
                              onChange={e => setPluginSettings({...pluginSettings, [s.key]: e.target.value})}
                              className="w-full h-8 px-2 rounded-lg border text-xs bg-background">
                              {s.options.map((o: any) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input value={pluginSettings[s.key] || ""}
                              onChange={e => setPluginSettings({...pluginSettings, [s.key]: e.target.value})}
                              placeholder={s.label}
                              className="w-full h-8 px-2 rounded-lg border text-xs bg-background" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-2 border-t">
                  <Button variant="destructive" size="sm" className="h-8 text-xs"
                    onClick={() => { handleUninstall(selectedPlugin.name); setSelectedPlugin(null); }}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />卸载插件
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs"
                    onClick={() => setSelectedPlugin(null)}>关闭</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...classes: any[]) { return classes.filter(Boolean).join(" "); }
