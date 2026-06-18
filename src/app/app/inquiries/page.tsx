"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Search, MessageSquareQuote, Bot, Loader2, Send, Sparkles, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useAIConfig } from "@/hooks/useAIConfig";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "待处理", variant: "secondary" },
  quoted: { label: "已回复", variant: "default" },
  converted: { label: "已成交", variant: "outline" },
  lost: { label: "已丢失", variant: "destructive" },
};

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [replyDialog, setReplyDialog] = useState<string | null>(null);
  const [aiReply, setAiReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [newInquiryOpen, setNewInquiryOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCustomer, setNewCustomer] = useState("");
  const [newSource, setNewSource] = useState("邮件");
  const [creating, setCreating] = useState(false);
  const { config } = useAIConfig();

  useEffect(() => {
    fetch("/api/inquiries").then(r => r.json()).then(data => { setInquiries(data); setLoading(false); });
  }, []);

  async function handleAIReply(inquiry: any) {
    const provider = config.taskMapping?.quotation || "deepseek:deepseek-chat";
    const [pid, m] = provider.split(":");
    const pcfg = config.providers[pid];
    if (!pcfg?.apiKey) { toast.error("请先在设置中配置 AI 提供商"); return; }

    setReplying(true);
    setAiReply("");
    setReplySent(false);
    try {
      const res = await fetch(`/api/inquiries/${inquiry.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: pcfg.apiKey, provider: pid, model: m }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiReply(data.reply);
        setReplySent(true);
        // Refresh list
        fetch("/api/inquiries").then(r => r.json()).then(setInquiries);
      } else {
        toast.error(data.error || "AI 回复失败");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReplying(false);
    }
  }

  async function handleCreateInquiry() {
    if (!newCustomer.trim() || !newSubject.trim() || !newContent.trim()) {
      toast.error("请填写完整信息"); return;
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
        fetch("/api/inquiries").then(r => r.json()).then(setInquiries);
      } else {
        toast.error("创建失败");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  const filtered = inquiries.filter(i => i.customer?.includes(search) || i.subject?.includes(search));

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">询盘</h1>
          <p className="text-sm text-muted-foreground mt-1">处理和管理客户询盘，AI 自动回复</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setNewInquiryOpen(true)}>
            <MessageSquareQuote className="h-4 w-4 mr-2" />客户询盘
          </Button>
          <Dialog open={newInquiryOpen} onOpenChange={setNewInquiryOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>录入客户询盘</DialogTitle>
                <DialogDescription>记录客户发来的询盘信息，方便后续跟进和 AI 回复</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>客户名称</Label>
                  <Input value={newCustomer} onChange={e => setNewCustomer(e.target.value)} placeholder="客户名或公司名" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>询盘主题</Label>
                    <Input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="如: 产品报价咨询" className="mt-1" />
                  </div>
                  <div>
                    <Label>来源渠道</Label>
                    <Select value={newSource} onValueChange={(v) => v && setNewSource(v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
                  <Textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="粘贴客户发来的消息内容..." className="mt-1 min-h-[120px]" />
                </div>
                <Button onClick={handleCreateInquiry} disabled={creating} className="w-full">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {creating ? "创建中..." : "保存询盘"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜索询盘..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                      <p className="text-sm font-medium truncate">{inquiry.subject}</p>
                      <p className="text-xs text-muted-foreground">{inquiry.customer} · {inquiry.source}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{inquiry.content}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{inquiry.createdAt}</span>
                    <Badge variant={STATUS_MAP[inquiry.status]?.variant || "outline"}>
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
                      setReplyDialog(replyDialog === inquiry.id ? null : inquiry.id);
                      if (replyDialog !== inquiry.id && !inquiry.aiReply) {
                        handleAIReply(inquiry);
                      }
                    }}
                    disabled={replying && replyDialog === inquiry.id}
                  >
                    {replying && replyDialog === inquiry.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Bot className="h-3 w-3 mr-1" />
                    )}
                    AI 自动回复
                  </Button>
                  <Link href={`/app/inquiries/${inquiry.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      详情
                    </Button>
                  </Link>
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
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(aiReply); toast.success("已复制到剪贴板"); }}>
                        <Send className="h-3 w-3 mr-1" /> 复制回复
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAIReply(inquiry)}>
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
