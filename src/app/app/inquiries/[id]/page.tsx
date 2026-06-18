"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Bot, Loader2, RefreshCw, Send, Copy, MessageSquareQuote } from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";

export default function InquiryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [inquiry, setInquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiReply, setAiReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [intentAnalysis, setIntentAnalysis] = useState<any>(null);
  const { config } = useAIConfig();

  async function handleIntentAnalysis() {
    if (!inquiry) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/ai/intent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inquiry.content, customerInfo: inquiry.customer }),
      });
      const data = await res.json();
      if (res.ok) setIntentAnalysis(data.analysis);
      else toast.error(data.error || "分析失败");
    } catch (e: any) { toast.error(e.message); }
    finally { setAnalyzing(false); }
  }

  useEffect(() => {
    if (params.id) {
      fetch(`/api/inquiries/${params.id}`).then(r => r.json()).then(data => {
        setInquiry(data);
        setAiReply(data.aiReply || "");
        setLoading(false);
      });
    }
  }, [params.id]);

  async function handleAIReply() {
    const provider = config.taskMapping?.quotation || "deepseek:deepseek-chat";
    const [pid, m] = provider.split(":");
    const pcfg = config.providers[pid];
    if (!pcfg?.apiKey) { toast.error("请先在设置中配置 AI 提供商"); return; }

    setReplying(true);
    try {
      const res = await fetch(`/api/inquiries/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: pcfg.apiKey, provider: pid, model: m }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiReply(data.reply);
        setInquiry((prev: any) => ({ ...prev, aiReply: data.reply, status: "quoted" }));
        toast.success("AI 回复生成成功");
      } else {
        toast.error(data.error || "AI 回复失败");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReplying(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  if (!inquiry) return <div className="p-8 text-center text-muted-foreground">未找到询盘</div>;

  const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { label: "待处理", variant: "secondary" },
    quoted: { label: "已回复", variant: "default" },
    converted: { label: "已成交", variant: "outline" },
    lost: { label: "已丢失", variant: "destructive" },
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{inquiry.subject}</h1>
          <p className="text-sm text-muted-foreground">{inquiry.customer} · {inquiry.source} · {inquiry.createdAt}</p>
        </div>
        <Badge variant={STATUS_MAP[inquiry.status]?.variant || "outline"} className="ml-auto">
          {STATUS_MAP[inquiry.status]?.label || inquiry.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquareQuote className="h-4 w-4" />
            客户询盘内容
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{inquiry.content}</p>
        </CardContent>
      </Card>

      <Card className={`border ${aiReply ? "border-green-200" : "border-amber-200"}`}>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className={`h-4 w-4 ${aiReply ? "text-green-600" : "text-amber-600"}`} />
              {aiReply ? "AI 回复" : "AI 自动回复"}
            </div>
            <div className="flex gap-2">
              {aiReply && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(aiReply); toast.success("已复制"); }}>
                  <Copy className="h-3 w-3 mr-1" /> 复制
                </Button>
              )}
              <Button
                variant={aiReply ? "outline" : "default"}
                size="sm"
                className="h-7 text-xs"
                onClick={handleAIReply}
                disabled={replying}
              >
                {replying ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : aiReply ? (
                  <RefreshCw className="h-3 w-3 mr-1" />
                ) : (
                  <Bot className="h-3 w-3 mr-1" />
                )}
                {replying ? "生成中..." : aiReply ? "重新生成" : "生成回复"}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {replying ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI 正在分析询盘并生成回复...
            </div>
          ) : aiReply ? (
            <p className="text-sm whitespace-pre-wrap">{aiReply}</p>
          ) : (
            <p className="text-sm text-muted-foreground">点击「生成回复」按钮，AI 将根据询盘内容生成专业的外贸回复。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
