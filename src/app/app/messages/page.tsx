"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Save,
  MessageSquare,
  Loader2,
  CheckCheck,
  Phone,
  Mail,
  Globe,
} from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";
import type { LucideIcon } from "lucide-react";
import type { StoredMessage } from "@/lib/store";

interface ContactSummary {
  name: string;
  channel: StoredMessage["channel"];
  unread: number;
  lastMsg: string;
}

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  whatsapp: MessageSquare,
  wechat: Phone,
  email: Mail,
  other: Globe,
};
const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  wechat: "微信",
  email: "邮件",
  other: "其他",
};
const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "text-green-600",
  wechat: "text-green-500",
  email: "text-blue-500",
  other: "text-gray-500",
};

export default function MessagesPage() {
  const router = useRouter();
  const { getTaskProvider } = useAIConfig();
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [replying, setReplying] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/messages")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data))
          throw new Error(data.error || "消息加载失败");
        setMessages(data);
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "消息加载失败"),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get unique contacts with unread counts
  const allContacts = messages.reduce<ContactSummary[]>((acc, m) => {
    const existing = acc.find((c) => c.name === m.contactName);
    if (existing) {
      if (!m.read) existing.unread++;
      existing.channel = m.channel;
      existing.lastMsg = m.content.slice(0, 40);
    } else
      acc.push({
        name: m.contactName,
        channel: m.channel,
        unread: m.read ? 0 : 1,
        lastMsg: m.content.slice(0, 40),
      });
    return acc;
  }, []);
  const contacts = allContacts.filter(
    (c) => channelFilter === "all" || c.channel === channelFilter,
  );

  // Messages for selected contact
  const contactMessages = selectedContact
    ? messages
        .filter((m) => m.contactName === selectedContact)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];

  async function handleSend() {
    if (!inputText.trim() || !selectedContact) return;
    setSending(true);
    try {
      const channel =
        allContacts.find((contact) => contact.name === selectedContact)
          ?.channel || "other";
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: selectedContact,
          content: inputText,
          direction: "out",
          channel,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "回复记录保存失败");
      setMessages((current) => [...current, data]);
      setInputText("");
      toast.success("回复已保存到本地消息记录");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "回复记录保存失败");
    } finally {
      setSending(false);
    }
  }

  async function selectContact(contactName: string) {
    setSelectedContact(contactName);
    try {
      const response = await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "消息状态更新失败");
      setMessages((current) =>
        current.map((message) =>
          message.contactName === contactName
            ? { ...message, read: true }
            : message,
        ),
      );
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "消息状态更新失败");
    }
  }

  async function handleAIReply(msg: StoredMessage) {
    const aiConfig = getTaskProvider("message_reply");
    if (!aiConfig) {
      toast.error("请先在设置中为消息回复配置 AI 模型");
      return;
    }
    setReplying(msg.id);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...aiConfig,
          provider: aiConfig.providerId,
          messages: [
            {
              role: "system",
              content:
                "You are an international trade sales assistant. Draft a concise, professional reply. Do not claim the message has been sent and do not use name placeholders.",
            },
            {
              role: "user",
              content: `Customer: ${msg.contactName}\nChannel: ${msg.channel}\nMessage: ${msg.content}`,
            },
          ],
          maxTokens: 500,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (!data.content?.trim()) throw new Error("AI 未返回有效回复内容");
        setInputText(data.content);
        toast.success("AI 回复草稿已填入输入框，请检查后保存");
      } else toast.error(data.error || "AI 回复失败");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "AI 回复失败");
    } finally {
      setReplying(null);
    }
  }

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">加载中...</div>
    );

  return (
    <div className="-m-4 space-y-3 sm:-m-6">
      <div className="mx-3 mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:mx-6 sm:mt-6">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        消息页当前保存内部沟通记录，尚未接入
        WhatsApp、微信或邮件发送通道。保存不会把内容投递给客户。
      </div>
      <div className="flex h-[calc(100dvh-10rem)] sm:h-[calc(100vh-11rem)]">
        {/* Left Panel - Contact List */}
        <div
          className={`${selectedContact ? "hidden md:flex" : "flex"} w-full flex-col border-r bg-background md:w-72 md:shrink-0`}
        >
          <div className="p-3 border-b">
            <h1 className="mb-2 text-sm font-semibold">消息</h1>
            <div className="flex gap-1 flex-wrap">
              {["all", "whatsapp", "wechat", "email"].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannelFilter(ch)}
                  className={
                    "px-2 py-1 rounded text-[11px] font-medium " +
                    (channelFilter === ch
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80")
                  }
                >
                  {ch === "all" ? "全部" : CHANNEL_LABELS[ch] || ch}
                  {ch !== "all" &&
                    messages.filter((m) => m.channel === ch && !m.read).length >
                      0 &&
                    ` (${messages.filter((m) => m.channel === ch && !m.read).length})`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {contacts.map((c) => {
              const Icon = CHANNEL_ICONS[c.channel] || MessageSquare;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    void selectContact(c.name);
                  }}
                  aria-pressed={selectedContact === c.name}
                  className={
                    "block w-full p-3 text-left hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (selectedContact === c.name ? "bg-muted" : "")
                  }
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={
                        "h-4 w-4 shrink-0 " +
                        (CHANNEL_COLORS[c.channel] || "text-gray-500")
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {c.unread > 0 && (
                          <Badge className="h-4 min-w-4 text-[10px] px-1">
                            {c.unread}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        <span
                          className={"text-[10px] " + CHANNEL_COLORS[c.channel]}
                        >
                          {CHANNEL_LABELS[c.channel]}
                        </span>{" "}
                        · {c.lastMsg}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
            {contacts.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground text-center">
                暂无消息
              </p>
            )}
          </div>
        </div>

        {/* Right Panel - Chat View */}
        <div
          className={`${selectedContact ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-muted/10`}
        >
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="p-3 border-b bg-background flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="md:hidden"
                    onClick={() => setSelectedContact(null)}
                    aria-label="返回联系人列表"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">{selectedContact}</span>
                  <Badge variant="outline" className="h-5 text-[10px]">
                    {CHANNEL_LABELS[
                      allContacts.find((c) => c.name === selectedContact)
                        ?.channel || "other"
                    ] || "其他"}
                  </Badge>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {contactMessages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      "flex " +
                      (m.direction === "out" ? "justify-end" : "justify-start")
                    }
                  >
                    <div
                      className={
                        "max-w-[75%] rounded-xl p-3 text-sm " +
                        (m.direction === "out"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-white border rounded-bl-md")
                      }
                    >
                      <p>{m.content}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] opacity-60">
                          {m.createdAt}
                        </span>
                        {m.direction === "out" && (
                          <CheckCheck className="h-3 w-3 opacity-60" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input + AI Reply */}
              <div className="p-3 border-t bg-background space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="输入要保存的回复记录..."
                    className="flex-1 h-9 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) handleSend();
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-9"
                    onClick={handleSend}
                    disabled={sending || !inputText.trim()}
                    aria-label="保存回复记录"
                    title="保存回复记录"
                  >
                    {sending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => {
                      router.push("/app/email");
                    }}
                  >
                    <Bot className="h-3 w-3 mr-1" />
                    AI 写邮件
                  </Button>
                  {contactMessages
                    .filter((m) => m.direction === "in" && !m.aiReply)
                    .slice(-3)
                    .map((m) => (
                      <Button
                        key={m.id}
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => handleAIReply(m)}
                        disabled={replying !== null}
                      >
                        {replying === m.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Bot className="h-3 w-3 mr-1" />
                        )}
                        生成回复草稿
                      </Button>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  选择联系人查看消息
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  按 WhatsApp / 微信 / 邮件来源分类的本地记录
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
