"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Mail,
  Send,
  Inbox,
  FileText,
  Star,
  Trash2,
  Search,
  RefreshCw,
  Reply,
  Forward,
  Bot,
  Loader2,
  Plus,
  Settings,
  Eye,
  AlertCircle,
  Save,
} from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  folder: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  contactId?: string;
}

interface EmailAccount {
  id: string;
  name: string;
  email: string;
  provider: "smtp_imap" | "resend";
}

export default function EmailPage() {
  const router = useRouter();
  const { getTaskProvider } = useAIConfig();
  const searchParams = useSearchParams();
  const requestedTo = searchParams.get("to") || "";
  const [emails, setEmails] = useState<Email[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [emailMode, setEmailMode] = useState<"loading" | "local-draft" | "configured">("loading");
  const [folder, setFolder] = useState("inbox");
  const [selected, setSelected] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompose, setShowCompose] = useState(Boolean(requestedTo));
  const [composeTo, setComposeTo] = useState(requestedTo);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [aiComposing, setAiComposing] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadEmails() {
    setLoading(true);
    try {
      const url =
        "/api/email?folder=" +
        folder +
        (searchQuery ? "&q=" + encodeURIComponent(searchQuery) : "") +
        (accountId ? "&accountId=" + encodeURIComponent(accountId) : "");
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "邮件加载失败");
      setEmails(d.emails || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "邮件加载失败");
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/email?folder=${folder}${accountId ? `&accountId=${encodeURIComponent(accountId)}` : ""}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "邮件加载失败");
        return data;
      })
      .then((data) => {
        if (!cancelled) setEmails(data.emails || []);
      })
      .catch(() => {
        if (!cancelled) toast.error("邮件加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [folder, accountId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/email/accounts")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Email accounts could not be loaded");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const nextAccounts = Array.isArray(data.accounts) ? data.accounts : [];
        setAccounts(nextAccounts);
        setAccountId((current) => current || nextAccounts[0]?.id || "");
        setEmailMode(data.mode === "configured" ? "configured" : "local-draft");
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Email accounts could not be loaded");
      });
    return () => { cancelled = true; };
  }, []);

  async function submitMessage(action: "save-draft" | "send") {
    if (!composeTo.trim() || !composeSubject.trim()) {
      toast.error("收件人和主题必填");
      return;
    }
    if (emailMode === "configured" && !accountId) {
      toast.error("Select an email account first");
      return;
    }
    setSending(true);
    try {
      const r = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          accountId: accountId || undefined,
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || (action === "send" ? "Email could not be queued" : "Draft could not be saved"));
      toast.success(action === "send" ? "Email queued for delivery" : "Draft saved");
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      if (folder === (action === "send" ? "sent" : "draft")) await loadEmails();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Email could not be submitted");
    }
    setSending(false);
  }

  function handleSaveDraft() { void submitMessage("save-draft"); }
  function handleSend() { void submitMessage("send"); }

  async function handleAICompose(openAsReply = false) {
    const aiConfig = getTaskProvider("email_compose");
    if (!aiConfig) {
      toast.error("请先在设置中为邮件草稿配置 AI 模型");
      return;
    }
    if (openAsReply && selected) openCompose("reply");
    setAiComposing(true);
    try {
      const response = await fetch("/api/ai/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...aiConfig,
          provider: aiConfig.providerId,
          type: selected ? "quotation_reply" : "cold_email",
          context: selected
            ? {
                contactName: selected.from,
                lastCommunication: selected.body,
                language: "英文",
                tone: "专业、友好",
              }
            : {
                contactName: composeTo || "潜在客户",
                customerSummary: "信息待补充",
                productInfo: "产品信息待补充",
                language: "英文",
                tone: "专业、简洁",
              },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI 草稿生成失败");
      if (!data.content?.trim()) throw new Error("AI 未返回有效邮件内容");
      setComposeBody(data.content);
      toast.success("AI 草稿已生成，请检查并编辑");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "AI 草稿生成失败");
    } finally {
      setAiComposing(false);
    }
  }

  function openCompose(mode: "reply" | "forward") {
    if (!selected) return;
    const header = `\n\n--- 原邮件 ---\nFrom: ${selected.from}\nDate: ${selected.date}\n\n${selected.body}`;
    setShowCompose(true);
    setComposeTo(mode === "reply" ? selected.from : "");
    setComposeSubject(
      `${mode === "reply" ? "Re" : "Fwd"}: ${selected.subject.replace(/^(Re|Fwd):\s*/i, "")}`,
    );
    setComposeBody(mode === "reply" ? `\n\n${header}` : header);
  }

  async function associateCustomer() {
    if (!selected) return;
    if (selected.contactId) {
      router.push(`/app/contacts/${selected.contactId}`);
      return;
    }
    try {
      const contactResponse = await fetch("/api/contacts");
      const contacts = await contactResponse.json();
      if (!contactResponse.ok || !Array.isArray(contacts))
        throw new Error("客户数据加载失败");
      const match = contacts.find(
        (contact: { id: string; email?: string }) =>
          contact.email?.toLowerCase() === selected.from.toLowerCase(),
      );
      if (!match) {
        toast.info("未找到邮箱匹配的客户，请先在客户管理中创建客户");
        return;
      }
      const response = await fetch("/api/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, contactId: match.id }),
      });
      if (!response.ok) throw new Error("关联客户失败");
      const updated = { ...selected, contactId: match.id };
      setSelected(updated);
      setEmails((current) =>
        current.map((email) => (email.id === updated.id ? updated : email)),
      );
      toast.success(`已关联客户 ${match.name}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "关联客户失败");
    }
  }

  async function selectEmail(email: Email) {
    setSelected(email);
    if (!email.isRead) {
      try {
        const response = await fetch("/api/email", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: email.id, isRead: true }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "邮件状态更新失败");
        const readEmail = { ...email, isRead: true };
        setSelected(readEmail);
        setEmails((current) =>
          current.map((item) => (item.id === email.id ? readEmail : item)),
        );
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "邮件状态更新失败",
        );
      }
    }
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
          <p className="text-sm text-muted-foreground mt-0.5">
            收件、草稿和发件
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={loadEmails}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            刷新
          </Button>
          <Button
            size="sm"
            className="h-9"
            onClick={() => setShowCompose(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            写草稿
          </Button>
        </div>
      </div>

      {emailMode === "local-draft" && <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>本地演示模式只保存草稿，不会向外部邮箱投递。</p>
      </div>}

      <div className="grid gap-4 md:grid-cols-4">
        {/* Left: Folders */}
        <div className="space-y-1">
          {[
            { id: "inbox", label: "收件箱", icon: Inbox },
            { id: "sent", label: "已发送", icon: Send },
            { id: "draft", label: "草稿箱", icon: FileText },
            { id: "trash", label: "已删除", icon: Trash2 },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                type="button"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${folder === f.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
                onClick={() => {
                  setLoading(true);
                  setFolder(f.id);
                  setSelected(null);
                }}
              >
                <Icon className="h-4 w-4" />
                {f.label}
              </button>
            );
          })}
          <Separator className="my-3" />
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => {
              router.push("/app/email/settings");
            }}
          >
            <Settings className="h-4 w-4" />
            邮箱设置
          </button>
        </div>

        {/* Middle: Email List */}
        <div className="md:col-span-1 border rounded-lg overflow-hidden bg-white">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                className="h-9 pl-9 text-sm"
                placeholder="搜索邮件..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadEmails()}
              />
            </div>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                加载中...
              </div>
            ) : emails.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">暂无邮件</p>
              </div>
            ) : (
              emails.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`block w-full p-3 text-left hover:bg-muted/50 transition-colors ${selected?.id === e.id ? "bg-primary/5 border-l-2 border-primary" : ""} ${!e.isRead ? "bg-blue-50/50" : ""}`}
                  onClick={() => {
                    void selectEmail(e);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm truncate flex-1 ${!e.isRead ? "font-semibold" : ""}`}
                    >
                      {e.from}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {formatDate(e.date)}
                    </span>
                  </div>
                  <p
                    className={`text-sm truncate mt-0.5 ${!e.isRead ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {e.subject}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {e.labels.map((l) => (
                      <Badge
                        key={l}
                        variant="secondary"
                        className="text-[10px] h-4 px-1.5"
                      >
                        {l}
                      </Badge>
                    ))}
                    {e.isStarred && <Star className="h-3 w-3 text-amber-400" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Email Detail / Compose */}
        <div className="md:col-span-2 border rounded-lg overflow-hidden bg-white">
          {showCompose ? (
            /* Compose */
            <div className="p-4 space-y-3">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                邮件草稿
              </h3>
              {emailMode === "configured" && <Select value={accountId} onValueChange={(value) => setAccountId(value || "")}>
                <SelectTrigger><SelectValue placeholder="Select email account" /></SelectTrigger>
                <SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} - {account.email}</SelectItem>)}</SelectContent>
              </Select>}
              <Input
                placeholder="收件人"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                className="h-9 text-sm"
              />
              <Input
                placeholder="主题"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="h-9 text-sm"
              />
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    void handleAICompose();
                  }}
                  disabled={aiComposing}
                >
                  {aiComposing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 mr-1" />
                  )}
                  AI 辅助
                </Button>
              </div>
              <Textarea
                placeholder="邮件正文..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={12}
                className="text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCompose(false)}
                >
                  取消
                </Button>
                <Button size="sm" onClick={handleSaveDraft} disabled={sending}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  保存草稿
                </Button>
                {emailMode === "configured" && <Button size="sm" onClick={handleSend} disabled={sending || !accountId}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  发送
                </Button>}
              </div>
            </div>
          ) : selected ? (
            /* Email Detail */
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-base">
                    {selected.subject}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">
                      {selected.from}
                    </span>
                    <span className="mx-2">→</span>
                    {selected.to}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selected.date).toLocaleString("zh-CN")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openCompose("reply")}
                    title="回复"
                    aria-label="回复"
                  >
                    <Reply className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openCompose("forward")}
                    title="转发"
                    aria-label="转发"
                  >
                    <Forward className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="text-sm whitespace-pre-wrap leading-relaxed min-h-[200px]">
                {selected.body}
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    void handleAICompose(true);
                  }}
                  disabled={aiComposing}
                >
                  {aiComposing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 mr-1" />
                  )}
                  AI 回复建议
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={associateCustomer}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  关联客户
                </Button>
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="p-12 text-center">
              <Mail className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">选择一封邮件查看详情</p>
              <p className="text-xs text-muted-foreground mt-1">
                或点击「写草稿」准备邮件内容
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
