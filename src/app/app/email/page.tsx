"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Mail, Send, Inbox, FileText, Star, Trash2, Search, RefreshCw,
  Paperclip, Reply, Forward, Bot, Sparkles, Loader2, Plus, Settings, Eye
} from "lucide-react";

interface Email {
  id: string; from: string; to: string; subject: string; body: string;
  date: string; folder: string; isRead: boolean; isStarred: boolean;
  labels: string[]; contactId?: string;
}

export default function EmailPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [folder, setFolder] = useState("inbox");
  const [selected, setSelected] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadEmails(); }, [folder]);

  async function loadEmails() {
    setLoading(true);
    try {
      const url = "/api/email?folder=" + folder + (searchQuery ? "&q=" + encodeURIComponent(searchQuery) : "");
      const r = await fetch(url);
      const d = await r.json();
      setEmails(d.emails || []);
    } catch {}
    setLoading(false);
  }

  async function handleSend() {
    if (!composeTo.trim() || !composeSubject.trim()) { toast.error("收件人和主题必填"); return; }
    setSending(true);
    try {
      const r = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody }),
      });
      if (r.ok) { toast.success("邮件已发送"); setShowCompose(false); setComposeTo(""); setComposeSubject(""); setComposeBody(""); loadEmails(); }
      else toast.error("发送失败");
    } catch { toast.error("发送失败"); }
    setSending(false);
  }

  async function handleAICompose() {
    const ctx = selected ? `客户: ${selected.from}, 主题: ${selected.subject}` : "新客户开发信";
    setComposeBody(`[AI Draft based on context: ${ctx}]\n\nDear [Name],\n\n[Body]\n\nBest regards,\n[Your Name]`);
    toast.success("AI 草稿已生成，请检查并编辑");
  }

  function formatDate(d: string) {
    const date = new Date(d);
    const now = new Date();
    return date.toDateString() === now.toDateString()
      ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            邮件中心
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">多邮箱绑定、AI 智能回复</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={loadEmails} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button size="sm" className="h-9" onClick={() => setShowCompose(true)}>
            <Plus className="h-4 w-4 mr-1.5" />写邮件
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {/* Left: Folders */}
        <div className="space-y-1">
          {[
            { id: "inbox", label: "收件箱", icon: Inbox },
            { id: "sent", label: "已发送", icon: Send },
            { id: "draft", label: "草稿箱", icon: FileText },
            { id: "trash", label: "已删除", icon: Trash2 },
          ].map(f => {
            const Icon = f.icon;
            return (
              <button key={f.id}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${folder === f.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
                onClick={() => { setFolder(f.id); setSelected(null); }}>
                <Icon className="h-4 w-4" />{f.label}
              </button>
            );
          })}
          <Separator className="my-3" />
          <button
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => window.open('/app/email/settings', '_self')}>
            <Settings className="h-4 w-4" />邮箱设置
          </button>
        </div>

        {/* Middle: Email List */}
        <div className="md:col-span-1 border rounded-lg overflow-hidden bg-white">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input className="h-9 pl-9 text-sm" placeholder="搜索邮件..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loadEmails()} />
            </div>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">加载中...</div>
            ) : emails.length === 0 ? (
              <div className="p-8 text-center"><Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">暂无邮件</p></div>
            ) : emails.map(e => (
              <div key={e.id}
                className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${selected?.id === e.id ? "bg-primary/5 border-l-2 border-primary" : ""} ${!e.isRead ? "bg-blue-50/50" : ""}`}
                onClick={() => setSelected(e)}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm truncate flex-1 ${!e.isRead ? "font-semibold" : ""}`}>{e.from}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDate(e.date)}</span>
                </div>
                <p className={`text-sm truncate mt-0.5 ${!e.isRead ? "font-medium" : "text-muted-foreground"}`}>{e.subject}</p>
                <div className="flex gap-1 mt-1">
                  {e.labels.map(l => <Badge key={l} variant="secondary" className="text-[10px] h-4 px-1.5">{l}</Badge>)}
                  {e.isStarred && <Star className="h-3 w-3 text-amber-400" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Email Detail / Compose */}
        <div className="md:col-span-2 border rounded-lg overflow-hidden bg-white">
          {showCompose ? (
            /* Compose */
            <div className="p-4 space-y-3">
              <h3 className="font-medium text-sm flex items-center gap-2"><Send className="h-4 w-4 text-primary" />新邮件</h3>
              <Input placeholder="收件人" value={composeTo} onChange={e => setComposeTo(e.target.value)} className="h-9 text-sm" />
              <Input placeholder="主题" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} className="h-9 text-sm" />
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleAICompose}>
                  <Bot className="h-3.5 w-3.5 mr-1" />AI 辅助
                </Button>
              </div>
              <Textarea placeholder="邮件正文..." value={composeBody} onChange={e => setComposeBody(e.target.value)} rows={12} className="text-sm" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCompose(false)}>取消</Button>
                <Button size="sm" onClick={handleSend} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  发送
                </Button>
              </div>
            </div>
          ) : selected ? (
            /* Email Detail */
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-base">{selected.subject}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{selected.from}</span>
                    <span className="mx-2">→</span>
                    {selected.to}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(selected.date).toLocaleString("zh-CN")}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Reply className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Forward className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowCompose(true); setComposeTo(selected.from); setComposeSubject("Re: " + selected.subject); }}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="text-sm whitespace-pre-wrap leading-relaxed min-h-[200px]">{selected.body}</div>
              <Separator />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleAICompose}>
                  <Bot className="h-3.5 w-3.5 mr-1" />AI 回复建议
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Sparkles className="h-3.5 w-3.5 mr-1" />AI 翻译
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Eye className="h-3.5 w-3.5 mr-1" />关联客户
                </Button>
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="p-12 text-center">
              <Mail className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">选择一封邮件查看详情</p>
              <p className="text-xs text-muted-foreground mt-1">或点击「写邮件」开始新邮件</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

