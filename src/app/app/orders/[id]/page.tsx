"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, Lightbulb, Bell, FileText, Ship, MessageSquare, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAIConfig } from "@/hooks/useAIConfig";

function generateMilestones(order: any) {
  const allMilestones = [
    { name: "确认订单", status: "completed" },
    { name: "备料完成", status: "completed" },
    { name: "样品确认", status: "completed" },
    { name: "生产制造", status: (order?.progressPercent || 0) >= 70 ? "completed" : (order?.progressPercent || 0) >= 30 ? "in_progress" : "pending" },
    { name: "质量检验", status: (order?.progressPercent || 0) >= 90 ? "completed" : (order?.progressPercent || 0) >= 70 ? "in_progress" : "pending" },
    { name: "包装入库", status: (order?.progressPercent || 0) >= 100 ? "completed" : "pending" },
    { name: "安排发货", status: order?.status === "shipped" || order?.status === "completed" ? "completed" : "pending" },
  ];
  return allMilestones;
}

interface AISuggestion {
  type: "risk" | "opportunity" | "action" | "reminder";
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  description: string;
  actionLabel?: string;
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    confirmed: "已确认", in_production: "生产中", inspection: "验货中",
    ready: "待发货", shipped: "已发货", completed: "已完成", cancelled: "已取消",
  };
  return map[status] || status;
}

export default function OrderDetailPage() {
  const params = useParams();
  const { config, getTaskProvider } = useAIConfig();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/orders/${params.id}`)
        .then(r => r.json())
        .then(data => { setOrder(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [params.id]);

  async function loadSuggestions() {
    const aiConfig = getTaskProvider("order_suggestion");
    if (!aiConfig) {
      setAiError("请先在设置中配置 AI 提供商");
      return;
    }

    setLoadingAI(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: aiConfig.apiKey,
          provider: aiConfig.providerId,
          model: aiConfig.model,
          orderContext: {
            orderNo: order?.no || "ORD-2026-088",
            status: order?.status || "in_production",
            customerName: order?.contactName || "BestBuy Co.",
            total: "$" + ((order?.totalAmount || 12500).toLocaleString()),
            deliveryDate: order?.deliveryDate || "2026-06-20",
            progressPercent: order?.progressPercent || 70,
            milestones: (order ? generateMilestones(order) : []).map(m => ({ milestone: m.name, status: m.status, plannedDate: "-" })),
            recentCommunications: order?.comms?.map((c: any) => `${c.from}(${c.date}): ${c.text}`).join("\n") || "No recent communications",
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
      } else {
        setAiError(data.error || "AI 未返回有效建议");
      }
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setLoadingAI(false);
    }
  }

  useEffect(() => {
    if (getTaskProvider("order_suggestion")) {
      loadSuggestions();
    }
  }, [order]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  if (!order) return <div className="p-8 text-center text-muted-foreground">未找到订单</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{order.no}</h1>
          <p className="text-sm text-muted-foreground">{order.contactName} · ${(order.totalAmount || 0).toLocaleString()} · {order.tradeTerm || "FOB"}</p>
        </div>
        <Badge variant="secondary" className="ml-auto">{getStatusLabel(order.status)}</Badge>
      </div>

      {/* AI Suggestions - Real API */}
      {/* Risk Dashboard */}
      {order && (
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 bg-green-50 border-green-200">
            <p className="text-xs text-green-600 font-medium">订单状态</p>
            <p className="text-sm font-bold text-green-800 mt-1">{getStatusLabel(order.status)}</p>
          </div>
          <div className="rounded-lg border p-3 bg-blue-50 border-blue-200">
            <p className="text-xs text-blue-600 font-medium">生产进度</p>
            <p className="text-sm font-bold text-blue-800 mt-1">{order.progressPercent || 0}%</p>
          </div>
          <div className="rounded-lg border p-3 bg-amber-50 border-amber-200">
            <p className="text-xs text-amber-600 font-medium">交期</p>
            <p className="text-sm font-bold text-amber-800 mt-1">{order.deliveryDate || "-"}</p>
          </div>
          <div className="rounded-lg border p-3 bg-purple-50 border-purple-200">
            <p className="text-xs text-purple-600 font-medium">订单金额</p>
            <p className="text-sm font-bold text-purple-800 mt-1">${(order.totalAmount || 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      <Card className={`border ${loadingAI ? "border-blue-200 bg-blue-50" : suggestions.length > 0 ? "border-amber-200 bg-amber-50" : "border-gray-200"}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className={`h-5 w-5 ${loadingAI ? "text-blue-600" : "text-amber-600"}`} />
              <span className="text-sm font-medium flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" />
                {loadingAI ? "AI 正在分析订单..." : suggestions.length > 0 ? "AI 跟单建议" : "AI 跟单建议"}
              </span>
            </div>
            {suggestions.length > 0 || aiError ? (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={loadSuggestions} disabled={loadingAI}>
                <RefreshCw className={`h-3 w-3 mr-1 ${loadingAI ? "animate-spin" : ""}`} />
                刷新
              </Button>
            ) : null}
          </div>

          {loadingAI && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
              <span className="text-sm text-blue-700">正在通过 DeepSeek 分析订单...</span>
            </div>
          )}

          {aiError && !loadingAI && (
            <div className="text-sm text-muted-foreground py-2">
              {aiError === "请先在设置中配置 AI 提供商" ? (
                <div className="text-center py-4">
                  <p className="mb-2">配置 AI 后即可获取跟单建议</p>
                  <Link href="/app/settings">
                    <Button size="sm" variant="outline">去设置页配置 AI</Button>
                  </Link>
                </div>
              ) : (
                <p>AI 分析暂时不可用: {aiError}</p>
              )}
            </div>
          )}

          {suggestions.length > 0 && !loadingAI && suggestions.map((sg, i) => {
            const iconMap: Record<string, any> = { risk: AlertTriangle, opportunity: Lightbulb, action: Bell, reminder: Bell };
            const Icon = iconMap[sg.type] || Bell;
            const colorMap: Record<string, string> = {
              risk: "text-red-700 border-red-200 bg-red-50",
              opportunity: "text-green-700 border-green-200 bg-green-50",
              action: "text-blue-700 border-blue-200 bg-blue-50",
              reminder: "text-amber-700 border-amber-200 bg-amber-50",
            };
            return (
              <div key={i} className={`rounded-lg border p-3 ${colorMap[sg.type] || "bg-white"}`}>
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{sg.title}</p>
                    <p className="text-xs mt-1 opacity-80">{sg.description}</p>
                    {sg.actionLabel && (
                      <Button variant="outline" size="sm" className="h-7 text-xs mt-2">{sg.actionLabel}</Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {suggestions.length === 0 && !loadingAI && !aiError && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">点击下方按钮分析订单风险与跟单建议</p>
              <Button size="sm" onClick={loadSuggestions}>
                <Lightbulb className="h-3.5 w-3.5 mr-1" />
                分析订单风险与跟单建议
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Order Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">订单信息</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">客户</span><span>{order.contactName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">金额</span><span>${(order.totalAmount || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">贸易术语</span><span>{order.tradeTerm || "FOB"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">交期</span><span className="font-medium">{order.deliveryDate || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">进度</span><span>{order.progressPercent || 0}%</span></div>
          </CardContent>
        </Card>

        {/* Progress Timeline */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">生产进度</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {generateMilestones(order).map((ms) => (
                <div key={ms.name} className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    ms.status === "completed" ? "bg-green-500" :
                    ms.status === "delayed" ? "bg-red-500" :
                    "bg-gray-300"
                  }`} />
                  <div className="flex-1 flex justify-between">
                    <span className={`text-sm ${ms.status === "pending" ? "text-muted-foreground" : ""}`}>
                      {ms.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{ms.status === "in_progress" ? "进行中" : ms.status === "completed" ? "✅" : "⏳"}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => { const t = prompt("输入沟通内容:"); if (t) { toast.success("沟通已记录"); } }}><MessageSquare className="h-4 w-4 mr-2" /> 记录沟通</Button>
        <Button variant="outline" onClick={async () => {
          try {
            const res = await fetch("/api/documents/generate", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: params.id }),
            });
            const data = await res.json();
            if (res.ok) toast.success(`已生成 ${data.count} 份单证`);
            else toast.error(data.error || "生成失败");
          } catch (e: any) { toast.error(e.message); }
        }}><FileText className="h-4 w-4 mr-2" /> 生成单证</Button>
        <Button onClick={() => { toast.success("已跳转到出货页面"); window.location.href = "/app/shipments"; }}><Ship className="h-4 w-4 mr-2" /> 创建出货</Button>
      </div>

      {/* Communication History */}
      <Card>
        <CardHeader><CardTitle className="text-base">沟通历史</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(order?.comms || []).length > 0 && order.comms.map((c: any, i: number) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{c.from} · {c.date}</span>
                <Badge variant="outline" className="h-5 text-xs">{c.channel}</Badge>
              </div>
              <p className="text-sm mt-1">{c.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
