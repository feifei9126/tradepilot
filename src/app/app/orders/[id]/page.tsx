"use client";

import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  AlertTriangle,
  Lightbulb,
  Bell,
  FileText,
  Ship,
  MessageSquare,
  Loader2,
  RefreshCw,
  Sparkles,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAIConfig } from "@/hooks/useAIConfig";
import type { LucideIcon } from "lucide-react";
import type { StoredOrder, StoredShipment } from "@/lib/store";
import { formatMoney } from "@/lib/currency";

function generateMilestones(order: StoredOrder | null) {
  if (!order) return [];
  const progressFloor: Record<string, number> = {
    confirmed: 0,
    in_production: 30,
    inspection: 70,
    ready: 90,
    shipped: 100,
    completed: 100,
    cancelled: 0,
  };
  const progress = Math.max(
    Math.min(Number(order.progressPercent) || 0, 100),
    progressFloor[order.status] || 0,
  );
  const statusAt = (threshold: number, previousThreshold: number) =>
    progress >= threshold
      ? "completed"
      : progress > previousThreshold
        ? "in_progress"
        : "pending";
  const allMilestones = [
    { name: "确认订单", status: "completed" },
    { name: "备料完成", status: statusAt(15, 0) },
    { name: "样品确认", status: statusAt(30, 15) },
    { name: "生产制造", status: statusAt(70, 30) },
    { name: "质量检验", status: statusAt(90, 70) },
    { name: "包装入库", status: statusAt(100, 90) },
    {
      name: "安排发货",
      status:
        order?.status === "shipped" || order?.status === "completed"
          ? "completed"
          : "pending",
    },
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
    confirmed: "已确认",
    in_production: "生产中",
    inspection: "验货中",
    ready: "待发货",
    shipped: "已发货",
    completed: "已完成",
    cancelled: "已取消",
  };
  return map[status] || status;
}

function getSuggestionDestination(actionLabel?: string) {
  const action = actionLabel?.toLowerCase() || "";
  if (
    action.includes("发货") ||
    action.includes("出货") ||
    action.includes("shipment")
  )
    return "shipment";
  if (
    ["邮件", "email", "联系客户", "通知客户", "回复客户"].some((keyword) =>
      action.includes(keyword),
    )
  )
    return "email";
  return null;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getTaskProvider } = useAIConfig();
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [existingShipmentId, setExistingShipmentId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [communicationText, setCommunicationText] = useState("");
  const [savingCommunication, setSavingCommunication] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState("confirmed");
  const [draftProgress, setDraftProgress] = useState("0");
  const [draftDeliveryDate, setDraftDeliveryDate] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);

  useEffect(() => {
    if (params.id) {
      Promise.all([
        fetch(`/api/orders/${params.id}`).then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "订单加载失败");
          return data as StoredOrder;
        }),
        fetch("/api/shipments").then(async (response) => {
          const data = await response.json();
          if (!response.ok || !Array.isArray(data))
            throw new Error("出货数据加载失败");
          return data as StoredShipment[];
        }),
      ])
        .then(([orderData, shipments]) => {
          setOrder(orderData);
          setExistingShipmentId(
            shipments.find((shipment) => shipment.orderId === orderData.id)
              ?.id || null,
          );
        })
        .catch((error: unknown) =>
          toast.error(error instanceof Error ? error.message : "订单加载失败"),
        )
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  async function loadSuggestions() {
    if (!order) return;
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
          ...aiConfig,
          apiKey: aiConfig.apiKey,
          provider: aiConfig.providerId,
          model: aiConfig.model,
          orderContext: {
            orderNo: order.no,
            status: order.status,
            customerName: order.contactName,
            total: formatMoney(order.totalAmount, order.currency),
            deliveryDate: order.deliveryDate || "Not set",
            progressPercent: order.progressPercent,
            milestones: generateMilestones(order).map((m) => ({
              milestone: m.name,
              status: m.status,
              plannedDate: "-",
            })),
            recentCommunications:
              order.comms
                ?.map((c) => `${c.from}(${c.date}): ${c.text}`)
                .join("\n") || "No recent communications",
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
      } else {
        setAiError(data.error || "AI 未返回有效建议");
      }
    } catch (error: unknown) {
      setAiError(error instanceof Error ? error.message : "AI 建议加载失败");
    } finally {
      setLoadingAI(false);
    }
  }

  function handleSuggestionAction(suggestion: AISuggestion) {
    if (!order) return;
    const destination = getSuggestionDestination(suggestion.actionLabel);
    if (destination === "shipment") {
      router.push(`/app/shipments?orderId=${encodeURIComponent(order.id)}`);
      return;
    }
    if (destination === "email") {
      router.push("/app/email");
    }
  }

  async function recordCommunication() {
    if (!order) return;
    const text = communicationText.trim();
    if (!text) return;
    const communication = {
      from: "我",
      date: new Date().toISOString().slice(0, 10),
      channel: "内部记录",
      text,
    };
    setSavingCommunication(true);
    try {
      const response = await fetch(`/api/orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comms: [...(order.comms || []), communication],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "沟通记录保存失败");
      setOrder(data);
      setCommunicationText("");
      setCommunicationOpen(false);
      toast.success("沟通已记录");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "沟通记录保存失败");
    } finally {
      setSavingCommunication(false);
    }
  }

  function openProgressEditor() {
    if (!order) return;
    setDraftStatus(order.status);
    setDraftProgress(String(order.progressPercent || 0));
    setDraftDeliveryDate(order.deliveryDate || "");
    setProgressOpen(true);
  }

  async function updateProgress() {
    if (!order) return;
    setSavingProgress(true);
    try {
      const response = await fetch(`/api/orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draftStatus,
          progressPercent: Number(draftProgress),
          deliveryDate: draftDeliveryDate,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "订单进度更新失败");
      setOrder(data);
      setProgressOpen(false);
      toast.success("订单进度已更新");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "订单进度更新失败");
    } finally {
      setSavingProgress(false);
    }
  }

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );
  if (!order)
    return (
      <div className="p-8 text-center text-muted-foreground">未找到订单</div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          render={<Link href="/app/orders" />}
          nativeButton={false}
          variant="ghost"
          size="icon"
          aria-label="返回订单列表"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{order.no}</h1>
          <p className="text-sm text-muted-foreground">
            {order.contactName} ·{" "}
            {formatMoney(order.totalAmount, order.currency)} ·{" "}
            {order.tradeTerm || "贸易术语未录入"}
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">
          {getStatusLabel(order.status)}
        </Badge>
      </div>

      {/* AI Suggestions - Real API */}
      {/* Risk Dashboard */}
      {order && (
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 bg-green-50 border-green-200">
            <p className="text-xs text-green-600 font-medium">订单状态</p>
            <p className="text-sm font-bold text-green-800 mt-1">
              {getStatusLabel(order.status)}
            </p>
          </div>
          <div className="rounded-lg border p-3 bg-blue-50 border-blue-200">
            <p className="text-xs text-blue-600 font-medium">生产进度</p>
            <p className="text-sm font-bold text-blue-800 mt-1">
              {order.progressPercent || 0}%
            </p>
          </div>
          <div className="rounded-lg border p-3 bg-amber-50 border-amber-200">
            <p className="text-xs text-amber-600 font-medium">交期</p>
            <p className="text-sm font-bold text-amber-800 mt-1">
              {order.deliveryDate || "-"}
            </p>
          </div>
          <div className="rounded-lg border p-3 bg-purple-50 border-purple-200">
            <p className="text-xs text-purple-600 font-medium">订单金额</p>
            <p className="text-sm font-bold text-purple-800 mt-1">
              {formatMoney(order.totalAmount, order.currency)}
            </p>
          </div>
        </div>
      )}

      <Card
        className={`border ${loadingAI ? "border-blue-200 bg-blue-50" : suggestions.length > 0 ? "border-amber-200 bg-amber-50" : "border-gray-200"}`}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb
                className={`h-5 w-5 ${loadingAI ? "text-blue-600" : "text-amber-600"}`}
              />
              <span className="text-sm font-medium flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                {loadingAI
                  ? "AI 正在分析订单..."
                  : suggestions.length > 0
                    ? "AI 跟单建议"
                    : "AI 跟单建议"}
              </span>
            </div>
            {suggestions.length > 0 || aiError ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={loadSuggestions}
                disabled={loadingAI}
              >
                <RefreshCw
                  className={`h-3 w-3 mr-1 ${loadingAI ? "animate-spin" : ""}`}
                />
                刷新
              </Button>
            ) : null}
          </div>

          {loadingAI && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
              <span className="text-sm text-blue-700">
                正在通过已配置的模型分析订单...
              </span>
            </div>
          )}

          {aiError && !loadingAI && (
            <div className="text-sm text-muted-foreground py-2">
              {aiError === "请先在设置中配置 AI 提供商" ? (
                <div className="text-center py-4">
                  <p className="mb-2">配置 AI 后即可获取跟单建议</p>
                  <Button
                    render={<Link href="/app/settings" />}
                    nativeButton={false}
                    size="sm"
                    variant="outline"
                  >
                    去设置页配置 AI
                  </Button>
                </div>
              ) : (
                <p>AI 分析暂时不可用: {aiError}</p>
              )}
            </div>
          )}

          {suggestions.length > 0 &&
            !loadingAI &&
            suggestions.map((sg, i) => {
              const iconMap: Record<string, LucideIcon> = {
                risk: AlertTriangle,
                opportunity: Lightbulb,
                action: Bell,
                reminder: Bell,
              };
              const Icon = iconMap[sg.type] || Bell;
              const colorMap: Record<string, string> = {
                risk: "text-red-700 border-red-200 bg-red-50",
                opportunity: "text-green-700 border-green-200 bg-green-50",
                action: "text-blue-700 border-blue-200 bg-blue-50",
                reminder: "text-amber-700 border-amber-200 bg-amber-50",
              };
              const destination = getSuggestionDestination(sg.actionLabel);
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${colorMap[sg.type] || "bg-white"}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{sg.title}</p>
                      <p className="text-xs mt-1 opacity-80">
                        {sg.description}
                      </p>
                      {sg.actionLabel && destination && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs mt-2"
                          onClick={() => handleSuggestionAction(sg)}
                        >
                          {sg.actionLabel}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          {suggestions.length === 0 && !loadingAI && !aiError && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">
                点击下方按钮分析订单风险与跟单建议
              </p>
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
          <CardHeader>
            <CardTitle className="text-base">订单信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">客户</span>
              <span>{order.contactName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">金额</span>
              <span>{formatMoney(order.totalAmount, order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">贸易术语</span>
              <span>{order.tradeTerm || "未录入"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">交期</span>
              <span className="font-medium">{order.deliveryDate || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">进度</span>
              <span>{order.progressPercent || 0}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Progress Timeline */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">生产进度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {generateMilestones(order).map((ms) => (
                <div key={ms.name} className="flex items-center gap-3">
                  <div
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      ms.status === "completed"
                        ? "bg-green-500"
                        : ms.status === "in_progress"
                          ? "bg-blue-500"
                          : "bg-gray-300"
                    }`}
                  />
                  <div className="flex-1 flex justify-between">
                    <span
                      className={`text-sm ${ms.status === "pending" ? "text-muted-foreground" : ""}`}
                    >
                      {ms.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ms.status === "in_progress"
                        ? "进行中"
                        : ms.status === "completed"
                          ? "✅"
                          : "⏳"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={openProgressEditor}>
          <Settings2 className="h-4 w-4 mr-2" /> 更新订单进度
        </Button>
        <Button variant="outline" onClick={() => setCommunicationOpen(true)}>
          <MessageSquare className="h-4 w-4 mr-2" /> 记录沟通
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const res = await fetch("/api/documents/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: params.id }),
              });
              const data = await res.json();
              if (res.ok)
                toast.success(
                  data.createdCount > 0
                    ? `已生成 ${data.createdCount} 份单证草稿`
                    : "该订单的标准单证草稿已存在",
                );
              else toast.error(data.error || "生成失败");
            } catch (error: unknown) {
              toast.error(error instanceof Error ? error.message : "生成失败");
            }
          }}
        >
          <FileText className="h-4 w-4 mr-2" /> 生成单证
        </Button>
        {existingShipmentId ? (
          <Button
            render={
              <Link
                href={`/app/shipments?orderId=${encodeURIComponent(order.id)}`}
              />
            }
            nativeButton={false}
          >
            <Ship className="h-4 w-4 mr-2" /> 查看出货
          </Button>
        ) : (
          <Button
            disabled={["cancelled", "completed"].includes(order.status)}
            title={
              ["cancelled", "completed"].includes(order.status)
                ? "已取消或已完成订单不能创建出货"
                : undefined
            }
            onClick={() => {
              router.push(
                `/app/shipments?orderId=${encodeURIComponent(order.id)}`,
              );
            }}
          >
            <Ship className="h-4 w-4 mr-2" /> 创建出货
          </Button>
        )}
      </div>

      <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>更新订单进度</DialogTitle>
            <DialogDescription>
              手动维护业务状态、完成百分比和预计交期。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="order-status" className="text-sm font-medium">
                订单状态
              </label>
              <select
                id="order-status"
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={draftStatus}
                onChange={(event) => setDraftStatus(event.target.value)}
              >
                <option value="confirmed">已确认</option>
                <option value="in_production">生产中</option>
                <option value="inspection">验货中</option>
                <option value="ready">待发货</option>
                <option value="shipped">已发货</option>
                <option value="completed">已完成</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="order-progress" className="text-sm font-medium">
                完成百分比
              </label>
              <input
                id="order-progress"
                type="number"
                min="0"
                max="100"
                step="1"
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={draftProgress}
                onChange={(event) => setDraftProgress(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="order-delivery-date"
                className="text-sm font-medium"
              >
                预计交期
              </label>
              <input
                id="order-delivery-date"
                type="date"
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={draftDeliveryDate}
                onChange={(event) => setDraftDeliveryDate(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProgressOpen(false)}
              disabled={savingProgress}
            >
              取消
            </Button>
            <Button onClick={updateProgress} disabled={savingProgress}>
              {savingProgress && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              保存进度
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={communicationOpen} onOpenChange={setCommunicationOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>记录客户沟通</DialogTitle>
            <DialogDescription>
              记录与 {order.contactName} 的电话、邮件或即时消息要点。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={communicationText}
            onChange={(event) => setCommunicationText(event.target.value)}
            placeholder="输入沟通内容..."
            className="min-h-28"
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCommunicationOpen(false)}
              disabled={savingCommunication}
            >
              取消
            </Button>
            <Button
              onClick={recordCommunication}
              disabled={savingCommunication || !communicationText.trim()}
            >
              {savingCommunication && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              保存记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Communication History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">沟通历史</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(order.comms || []).length > 0 &&
            order.comms?.map((c, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {c.from} · {c.date}
                  </span>
                  <Badge variant="outline" className="h-5 text-xs">
                    {c.channel}
                  </Badge>
                </div>
                <p className="text-sm mt-1">{c.text}</p>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
