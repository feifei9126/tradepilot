"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Loader2,
  RefreshCw,
  Copy,
  MessageSquareQuote,
} from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";
import type { StoredInquiry } from "@/lib/store";

export default function InquiryDetailPage() {
  const params = useParams();
  const [inquiry, setInquiry] = useState<StoredInquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiReply, setAiReply] = useState("");
  const [replying, setReplying] = useState(false);
  const { getTaskProvider } = useAIConfig();

  useEffect(() => {
    if (params.id) {
      fetch(`/api/inquiries/${params.id}`)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "询盘加载失败");
          return data;
        })
        .then((data) => {
          setInquiry(data);
          setAiReply(data.aiReply || "");
        })
        .catch((error: unknown) => {
          toast.error(error instanceof Error ? error.message : "询盘加载失败");
        })
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  async function handleAIReply() {
    const aiConfig = getTaskProvider("inquiry_reply");
    if (!aiConfig) {
      toast.error("请先在设置中为询盘回复配置 AI 模型");
      return;
    }

    setReplying(true);
    try {
      const res = await fetch(`/api/inquiries/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...aiConfig, provider: aiConfig.providerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiReply(data.reply);
        setInquiry((prev) =>
          prev ? { ...prev, aiReply: data.reply, status: "quoted" } : prev,
        );
        toast.success("AI 回复生成成功");
      } else {
        toast.error(data.error || "AI 回复失败");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "AI 回复失败");
    } finally {
      setReplying(false);
    }
  }

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );
  if (!inquiry)
    return (
      <div className="p-8 text-center text-muted-foreground">未找到询盘</div>
    );

  const STATUS_MAP: Record<
    string,
    {
      label: string;
      variant: "default" | "secondary" | "outline" | "destructive";
    }
  > = {
    pending: { label: "待处理", variant: "secondary" },
    quoted: { label: "已有草稿", variant: "default" },
    converted: { label: "已成交", variant: "outline" },
    lost: { label: "已丢失", variant: "destructive" },
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          render={<Link href="/app/inquiries" />}
          nativeButton={false}
          variant="ghost"
          size="icon"
          aria-label="返回询盘列表"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{inquiry.subject}</h1>
          <p className="text-sm text-muted-foreground">
            {inquiry.customer} · {inquiry.source} · {inquiry.createdAt}
          </p>
        </div>
        <Badge
          variant={STATUS_MAP[inquiry.status]?.variant || "outline"}
          className="ml-auto"
        >
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

      <Card
        className={`border ${aiReply ? "border-green-200" : "border-amber-200"}`}
      >
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot
                className={`h-4 w-4 ${aiReply ? "text-green-600" : "text-amber-600"}`}
              />
              {aiReply ? "AI 回复草稿" : "AI 回复草稿"}
            </div>
            <div className="flex gap-2">
              {aiReply && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(aiReply)
                      .then(() => toast.success("已复制"))
                      .catch(() => toast.error("复制失败，请检查浏览器权限"));
                  }}
                >
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
            <p className="text-sm text-muted-foreground">
              点击「生成回复」按钮，AI 将根据询盘内容生成专业的外贸回复。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
