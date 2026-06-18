// 产品设计工作台 — 完整独立页面

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Image, FileText, Palette, Layout, Sparkles, Download, Languages, Loader2,
  Wand2, CheckCircle2, Clock, ArrowRight, Eye, Settings, Search, Grid3X3,
  List, Filter, Star, Trash2, Share2, MoreHorizontal, Plus, RefreshCw
} from "lucide-react";

type ToolId = "image" | "desc" | "lang" | "spec" | "catalog";

interface DesignProject {
  id: string;
  type: ToolId;
  name: string;
  productName: string;
  status: "done" | "processing" | "draft";
  createdAt: string;
  thumbnail?: string;
}

const MOCK_PROJECTS: DesignProject[] = [
  { id: "p1", type: "image", name: "BT-E100 白底主图", productName: "无线蓝牙耳机", status: "done", createdAt: "2026-06-10" },
  { id: "p2", type: "desc", name: "智能手表 S3 英文描述", productName: "智能手表 S3", status: "done", createdAt: "2026-06-09" },
  { id: "p3", type: "catalog", name: "2026 Q2 产品目录", productName: "多产品", status: "processing", createdAt: "2026-06-08" },
  { id: "p4", type: "spec", name: "LED 台灯规格书", productName: "LED 台灯", status: "draft", createdAt: "2026-06-07" },
  { id: "p5", type: "lang", name: "充电宝多语言包", productName: "便携充电宝", status: "done", createdAt: "2026-06-06" },
];

const QUICK_TOOLS = [
  { id: "image" as ToolId, label: "AI 商品图", icon: Image, desc: "生成专业产品图片", count: 8,
    gradient: "from-blue-500 to-blue-600", lightBg: "bg-blue-50", iconClass: "text-blue-600" },
  { id: "desc" as ToolId, label: "描述优化", icon: Sparkles, desc: "AI 生成产品文案", count: 15,
    gradient: "from-emerald-500 to-emerald-600", lightBg: "bg-emerald-50", iconClass: "text-emerald-600" },
  { id: "lang" as ToolId, label: "多语言翻译", icon: Languages, desc: "6 种语言一次生成", count: 6,
    gradient: "from-violet-500 to-violet-600", lightBg: "bg-violet-50", iconClass: "text-violet-600" },
  { id: "spec" as ToolId, label: "规格书", icon: FileText, desc: "导出 PDF 规格书", count: 4,
    gradient: "from-amber-500 to-amber-600", lightBg: "bg-amber-50", iconClass: "text-amber-600" },
  { id: "catalog" as ToolId, label: "产品目录", icon: Layout, desc: "排版生成目录/价格表", count: 3,
    gradient: "from-rose-500 to-rose-600", lightBg: "bg-rose-50", iconClass: "text-rose-600" },
];

export function ProductDesignWorkbench() {
  const [activeTab, setActiveTab] = useState("projects");
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState<ToolId | null>(null);

  const filtered = MOCK_PROJECTS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.productName.toLowerCase().includes(search.toLowerCase())
  );

  const runTool = (id: ToolId) => {
    setRunning(id);
    setTimeout(() => {
      setRunning(null);
      toast.success(`✅ ${QUICK_TOOLS.find(t => t.id === id)?.label} 已完成`);
    }, 2000);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      done: "bg-green-50 text-green-700 border-green-200",
      processing: "bg-blue-50 text-blue-700 border-blue-200",
      draft: "bg-amber-50 text-amber-700 border-amber-200",
    };
    const label: Record<string, string> = { done: "已完成", processing: "处理中", draft: "草稿" };
    return <Badge variant="outline" className={cn(map[status], "text-[10px] h-5")}>{label[status]}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs text-white/80 mb-3">
              <Palette className="h-3.5 w-3.5" />Design Studio
            </div>
            <h1 className="text-2xl font-bold tracking-tight">产品设计工作室</h1>
            <p className="text-white/60 text-sm mt-1 max-w-lg">
              AI 商品图生成 · 自动描述 · 多语言翻译 · 规格书 · 产品目录
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border-0">
              <RefreshCw className="h-4 w-4 mr-1.5" />同步产品
            </Button>
            <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90">
              <Plus className="h-4 w-4 mr-1.5" />新建项目
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-8">
          {[
            { label: "设计项目", value: "36", sub: "全部时间" },
            { label: "AI 生成图", value: "128", sub: "本月新增 24" },
            { label: "产品目录", value: "8", sub: "已发布" },
            { label: "本月用量", value: "4,567", sub: "Tokens" },
          ].map((s, i) => (
            <div key={i} className="bg-white/5 rounded-xl p-3">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-white/50">{s.label}</p>
              <p className="text-[10px] text-white/30 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-5 gap-3">
        {QUICK_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isRunning = running === tool.id;
          return (
            <Card
              key={tool.id}
              className={cn(
                "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 overflow-hidden",
                "border-t-4",
              )}
              style={{ borderTopColor: tool.gradient.split(" ")[1].replace("to-", "#").replace("-600", "") }}
              onClick={() => runTool(tool.id)}
            >
              <CardContent className="p-4 text-center space-y-2">
                <div className={cn(
                  "w-12 h-12 rounded-xl mx-auto flex items-center justify-center transition-all",
                  tool.lightBg, "group-hover:scale-110"
                )}>
                  {isRunning ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    <Icon className={cn("h-6 w-6", tool.iconClass)} />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm">{tool.label}</p>
                  <p className="text-[10px] text-muted-foreground">{tool.desc}</p>
                  <Badge variant="secondary" className="mt-1.5 text-[10px] h-4 px-1.5">
                    已用 {tool.count} 次
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs: Projects / Templates */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="projects" className="text-sm"><Grid3X3 className="h-4 w-4 mr-1.5" />设计项目</TabsTrigger>
            <TabsTrigger value="templates" className="text-sm"><Layout className="h-4 w-4 mr-1.5" />模板</TabsTrigger>
          </TabsList>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索项目..." className="pl-9 h-9 text-sm"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <TabsContent value="projects" className="mt-4">
          <div className="space-y-2">
            {filtered.map((project) => {
              const tool = QUICK_TOOLS.find(t => t.id === project.type);
              const Icon = tool?.icon || FileText;
              return (
                <Card key={project.id} className="hover:shadow-sm transition-shadow group">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", tool?.lightBg || "bg-muted")}>
                        <Icon className={cn("h-5 w-5", tool?.iconClass || "text-muted-foreground")} />
                      </div>
                      <div>
                        <p className="font-medium text-sm group-hover:text-primary transition-colors">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.productName} · {project.createdAt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(project.status)}
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Image className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无匹配的设计项目</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid grid-cols-4 gap-4">
            {[
              { name: "现代简约目录", type: "catalog", preview: "bg-gradient-to-br from-blue-50 to-white" },
              { name: "经典商务目录", type: "catalog", preview: "bg-gradient-to-br from-slate-50 to-white" },
              { name: "基础规格书", type: "spec", preview: "bg-gradient-to-br from-amber-50 to-white" },
              { name: "详细规格书", type: "spec", preview: "bg-gradient-to-br from-emerald-50 to-white" },
            ].map((t, i) => (
              <Card key={i} className="group cursor-pointer hover:shadow-md transition-all">
                <CardContent className="p-0">
                  <div className={cn("h-32 rounded-t-xl flex items-center justify-center", t.preview)}>
                    <Layout className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm">{t.name}</p>
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {t.type === "catalog" ? "产品目录" : "规格书"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
