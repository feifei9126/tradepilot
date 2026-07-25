"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  MessageSquareQuote,
  Bot,
  Loader2,
  Send,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useAIConfig } from "@/hooks/useAIConfig";
import type { StoredInquiry } from "@/lib/store";

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

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<StoredInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [replyDialog, setReplyDialog] = useState<string | null>(null);
  const [aiReply, setAiReply] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [newInquiryOpen, setNewInquiryOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [newSource, setNewSource] = useState("邮件");
  const [creating, setCreating] = useState(false);
  const { getTaskProvider } = useAIConfig();

  useEffect(() => {
    fetch("/api/inquiries")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data))
          throw new Error("询盘数据加载失败");
        setInquiries(data);
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "询盘数据加载失败",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleAIReply(inquiry: StoredInquiry) {
    const aiConfig = getTaskProvider("inquiry_reply");
    if (!aiConfig) {
      toast.error("请先在设置中为询盘回复配置 AI 模型");
      return;
    }

    if (replyingId) return;
    setReplyingId(inquiry.id);
    setAiReply("");
    try {
      const res = await fetch(`/api/inquiries/${inquiry.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...aiConfig, provider: aiConfig.providerId }),
      });
      const data = await res.json();
      if (res.ok && typeof data.reply === "string" && data.reply.trim()) {
        setAiReply(data.reply);
        const refreshResponse = await fetch("/api/inquiries");
        const refreshed = await refreshResponse.json();
        if (!refreshResponse.ok || !Array.isArray(refreshed))
          throw new Error("询盘列表刷新失败");
        setInquiries(refreshed);
      } else {
        toast.error(data.error || "AI 回复失败");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "AI 回复失败");
    } finally {
      setReplyingId(null);
    }
  }

  async function handleCreateInquiry() {
    if (!newCustomer.trim() || !newSubject.trim() || !newContent.trim()) {
      toast.error("请填写完整信息");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: newCustomer,
          subject: newSubject,
          content: newContent,
          source: newSource,
        }),
      });
      if (res.ok) {
        toast.success("询盘已创建");
        setNewInquiryOpen(false);
        setNewCustomer("");
        setNewSubject("");
        setNewContent("");
        const refreshResponse = await fetch("/api/inquiries");
        const refreshed = await refreshResponse.json();
        if (!refreshResponse.ok || !Array.isArray(refreshed))
          throw new Error("询盘列表刷新失败");
        setInquiries(refreshed);
      } else {
        toast.error("创建失败");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  const filtered = inquiries.filter(
    (i) => i.customer?.includes(search) || i.subject?.includes(search),
  );

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">询盘</h1>
          <p className="text-sm text-muted-foreground mt-1">
            处理客户询盘并生成可人工审核的 AI 回复草稿
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setNewInquiryOpen(true)}>
            <MessageSquareQuote className="h-4 w-4 mr-2" />
            客户询盘
          </Button>
          <Dialog open={newInquiryOpen} onOpenChange={setNewInquiryOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>录入客户询盘</DialogTitle>
                <DialogDescription>
                  记录客户发来的询盘信息，方便后续跟进和 AI 回复
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>客户名称</Label>
                  <Input
                    value={newCustomer}
                    onChange={(e) => setNewCustomer(e.target.value)}
                    placeholder="客户名或公司名"
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>询盘主题</Label>
                    <Input
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="如: 产品报价咨询"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>来源渠道</Label>
                    <Select
                      value={newSource}
                      onValueChange={(v) => v && setNewSource(v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="邮件">邮件</SelectItem>
                        <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                        <SelectItem value="微信">微信</SelectItem>
                        <SelectItem value="阿里巴巴">阿里巴巴</SelectItem>
                        <SelectItem value="谷歌">谷歌</SelectItem>
                        <SelectItem value="展会">展会</SelectItem>
                        <SelectItem value="手动录入">手动录入</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>询盘内容</Label>
                  <Textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="粘贴客户发来的消息内容..."
                    className="mt-1 min-h-[120px]"
                  />
                </div>
                <Button
                  onClick={handleCreateInquiry}
                  disabled={creating}
                  className="w-full"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {creating ? "创建中..." : "保存询盘"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索询盘..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map((inquiry) => (
              <div key={inquiry.id} className="p-4 hover:bg-muted/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <MessageSquareQuote className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {inquiry.subject}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inquiry.customer} · {inquiry.source}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {inquiry.content}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {inquiry.createdAt}
                    </span>
                    <Badge
                      variant={STATUS_MAP[inquiry.status]?.variant || "outline"}
                    >
                      {STATUS_MAP[inquiry.status]?.label || inquiry.status}
                    </Badge>
                  </div>
                </div>
                {/* AI reply section */}
                <div className="flex items-center gap-2 mt-2 ml-9">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const opening = replyDialog !== inquiry.id;
                      setReplyDialog(opening ? inquiry.id : null);
                      setAiReply(opening ? inquiry.aiReply || "" : "");
                      if (opening && !inquiry.aiReply)
                        void handleAIReply(inquiry);
                    }}
                    disabled={replyingId !== null}
                  >
                    {replyingId === inquiry.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Bot className="h-3 w-3 mr-1" />
                    )}
                    AI 回复草稿
                  </Button>
                  <Button
                    render={<Link href={`/app/inquiries/${inquiry.id}`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                  >
                    详情
                  </Button>
                </div>
                {/* Reply result */}
                {replyDialog === inquiry.id && aiReply && (
                  <div className="ml-9 mt-2 border rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <Bot className="h-3 w-3" />
                      <span>AI 回复预览</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{aiReply}</p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(aiReply)
                            .then(() => toast.success("已复制到剪贴板"))
                            .catch(() =>
                              toast.error("复制失败，请检查浏览器权限"),
                            );
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" /> 复制回复
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleAIReply(inquiry)}
                        disabled={replyingId !== null}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> 重新生成
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
