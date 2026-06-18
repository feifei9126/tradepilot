// 产品设计插件 — 产品详情页面板（重新设计）

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Image, FileText, Palette, Layout, Sparkles, Download, Languages, Loader2,
  Wand2, CheckCircle2, Clock, ArrowRight, Eye, Settings, History
} from "lucide-react";

interface Props {
  productId: string;
  productName: string;
  productImage?: string;
  onResult?: (type: string, result: any) => void;
}

const tools = [
  {
    id: "image", label: "AI 商品图", icon: Image,
    desc: "使用 AI 生成专业级产品图片，支持白底/场景/简约三种风格",
    color: "from-blue-500 to-blue-600", lightBg: "bg-blue-50", badge: "AI",
    gradient: "from-blue-500/10 to-blue-600/5 border-blue-100",
  },
  {
    id: "desc", label: "描述优化", icon: Sparkles,
    desc: "AI 自动生成产品描述，突出卖点与技术规格",
    color: "from-emerald-500 to-emerald-600", lightBg: "bg-emerald-50", badge: "AI",
    gradient: "from-emerald-500/10 to-emerald-600/5 border-emerald-100",
  },
  {
    id: "lang", label: "多语言翻译", icon: Languages,
    desc: "一次生成中/英/西/阿/法/德 6 种产品描述",
    color: "from-violet-500 to-violet-600", lightBg: "bg-violet-50", badge: "6 语言",
    gradient: "from-violet-500/10 to-violet-600/5 border-violet-100",
  },
  {
    id: "spec", label: "规格书", icon: FileText,
    desc: "导出专业产品规格书，含参数、包装、认证信息",
    color: "from-amber-500 to-amber-600", lightBg: "bg-amber-50", badge: "PDF",
    gradient: "from-amber-500/10 to-amber-600/5 border-amber-100",
  },
  {
    id: "catalog", label: "产品目录", icon: Layout,
    desc: "自动排版生成产品目录/价格表，可选模板",
    color: "from-rose-500 to-rose-600", lightBg: "bg-rose-50", badge: "PDF/Excel",
    gradient: "from-rose-500/10 to-rose-600/5 border-rose-100",
  },
];

const recentItems = [
  { type: "image", name: "蓝牙耳机-主图.jpg", time: "2 分钟前", status: "done" },
  { type: "desc", name: "蓝牙耳机-英文描述", time: "15 分钟前", status: "done" },
  { type: "catalog", name: "2026产品目录-Q2", time: "昨天", status: "done" },
];

export function ProductDesignPanel({ productId, productName }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(false);

  const handleAction = async (id: string) => {
    setActiveTool(id);
    setLoading(id);
    setTimeout(() => {
      setLoading(null);
      toast.success(`✅ ${tools.find(a => a.id === id)?.label} 已完成`);
    }, 1800);
  };

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <Card className="bg-gradient-to-r from-slate-50 to-white border-slate-200">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">产品设计工作室</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                已生成 12 项设计资产
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowRecent(!showRecent)}>
              <History className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isLoading = loading === tool.id;
          const isActive = activeTool === tool.id && !isLoading;

          return (
            <Card
              key={tool.id}
              className={cn(
                "group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden",
                tool.gradient,
                isActive && "ring-2 ring-offset-1 ring-primary/30"
              )}
              onClick={() => handleAction(tool.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
                    tool.lightBg,
                    "group-hover:scale-110 group-hover:shadow-sm"
                  )}>
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <Icon className="h-5 w-5" style={{ color: tool.color.split(" ")[0].replace("from-", "").replace("-500", "").replace("-600", "") }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">{tool.label}</p>
                      <Badge variant="secondary" className="h-4 text-[10px] px-1.5">{tool.badge}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
                  </div>
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
                    isLoading ? "bg-primary/10" : "bg-transparent group-hover:bg-muted"
                  )}>
                    <ArrowRight className={cn(
                      "h-4 w-4 text-muted-foreground transition-all",
                      "group-hover:translate-x-0.5 group-hover:text-primary",
                      isLoading && "opacity-0"
                    )} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      {showRecent && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              最近生成
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentItems.map((item, i) => {
              const tool = tools.find(t => t.type === item.type);
              const Icon = tool?.icon || FileText;
              return (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", tool?.lightBg || "bg-muted")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] h-5 bg-green-50 text-green-700 border-green-200">已完成</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
