"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bot, Send, MessageSquare, Loader2, CheckCheck, ArrowLeft, Phone, Mail, Globe } from "lucide-react";
import { useAIConfig } from "@/hooks/useAIConfig";

const CHANNEL_ICONS: Record<string, any> = { whatsapp: MessageSquare, wechat: Phone, email: Mail, other: Globe };
const CHANNEL_LABELS: Record<string, string> = { whatsapp: "WhatsApp", wechat: "微信", email: "邮件", other: "其他" };
const CHANNEL_COLORS: Record<string, string> = { whatsapp: "text-green-600", wechat: "text-green-500", email: "text-blue-500", other: "text-gray-500" };

export default function MessagesPage() {
  const { config, loaded } = useAIConfig();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [replying, setReplying] = useState<string | null>(null);
  const [autoEnabled, setAutoEnabled] = useState<Record<string, boolean>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch("/api/messages").then(r => r.json()).then(d => { setMessages(d); setLoading(false); }); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Get unique contacts with unread counts
  const contacts = messages.reduce((acc: any[], m: any) => {
    const existing = acc.find(c => c.name === m.contactName);
    if (existing) { if (!m.read) existing.unread++; } else acc.push({ name: m.contactName, channel: m.channel, unread: m.read ? 0 : 1, lastMsg: m.content.slice(0, 40) });
    return acc;
  }, []).filter((c: any) => channelFilter === "all" || c.channel === channelFilter);

  // Messages for selected contact
  const contactMessages = selectedContact ? messages.filter(m => m.contactName === selectedContact).sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt)) : [];

  async function handleSend() {
    if (!inputText.trim() || !selectedContact) return;
    setSending(true);
    await fetch("/api/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactName: selectedContact, content: inputText, direction: "out" }),
    });
    const res = await fetch("/api/messages?contact=" + encodeURIComponent(selectedContact));
    setMessages(await res.json());
    setInputText("");
    setSending(false);
  }

  async function handleAIReply(msg: any) {
    const pid = Object.keys(config.providers)[0] || "deepseek";
    const pcfg = config.providers[pid];
    if (!pcfg?.apiKey) { toast.error("请先在设置中配置 AI 提供商"); return; }
    setReplying(msg.id);
    try {
      const res = await fetch("/api/messages/ai-reply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msg.id, contactName: msg.contactName, content: msg.content, channel: msg.channel, apiKey: pcfg.apiKey, provider: pid, model: pcfg.model }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetch("/api/messages", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactName: msg.contactName, content: data.reply, direction: "out", channel: msg.channel }),
        });
        const refresh = await fetch("/api/messages?contact=" + encodeURIComponent(msg.contactName));
        setMessages(await refresh.json());
        toast.success("AI 回复已发送");
      } else toast.error(data.error || "AI 回复失败");
    } catch (e: any) { toast.error(e.message); }
    finally { setReplying(null); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6">
      {/* Left Panel - Contact List */}
      <div className="w-72 border-r bg-background flex flex-col shrink-0">
        <div className="p-3 border-b">
          <h2 className="text-sm font-semibold mb-2">消息</h2>
          <div className="flex gap-1 flex-wrap">
            {["all", "whatsapp", "wechat", "email"].map(ch => (
              <button key={ch} onClick={() => setChannelFilter(ch)}
                className={"px-2 py-1 rounded text-[11px] font-medium " + (channelFilter === ch ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                {ch === "all" ? "全部" : CHANNEL_LABELS[ch] || ch}
                {ch !== "all" && messages.filter(m => m.channel === ch && !m.read).length > 0 && ` (${messages.filter(m => m.channel === ch && !m.read).length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {contacts.map((c: any) => {
            const Icon = CHANNEL_ICONS[c.channel] || MessageSquare;
            return (
              <div key={c.name} onClick={() => setSelectedContact(c.name)}
                className={"p-3 cursor-pointer hover:bg-muted/50 transition-colors " + (selectedContact === c.name ? "bg-muted" : "")}>
                <div className="flex items-center gap-2">
                  <Icon className={"h-4 w-4 shrink-0 " + (CHANNEL_COLORS[c.channel] || "text-gray-500")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.unread > 0 && <Badge className="h-4 min-w-4 text-[10px] px-1">{c.unread}</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      <span className={"text-[10px] " + CHANNEL_COLORS[c.channel]}>{CHANNEL_LABELS[c.channel]}</span> · {c.lastMsg}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          {contacts.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">暂无消息</p>}
        </div>
      </div>

      {/* Right Panel - Chat View */}
      <div className="flex-1 flex flex-col bg-muted/10">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b bg-background flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{selectedContact}</span>
                <Badge variant="outline" className="h-5 text-[10px]">
                  {CHANNEL_LABELS[contacts.find((c: any) => c.name === selectedContact)?.channel] || "其他"}
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {contactMessages.map((m: any) => (
                <div key={m.id} className={"flex " + (m.direction === "out" ? "justify-end" : "justify-start")}>
                  <div className={"max-w-[75%] rounded-xl p-3 text-sm " + (m.direction === "out" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-white border rounded-bl-md")}>
                    <p>{m.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] opacity-60">{m.createdAt}</span>
                      {m.direction === "out" && <CheckCheck className="h-3 w-3 opacity-60" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input + AI Reply */}
            <div className="p-3 border-t bg-background space-y-2">
              <div className="flex gap-2">
                <Input value={inputText} onChange={e => setInputText(e.target.value)}
                  placeholder="输入回复..." className="flex-1 h-9 text-sm"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) handleSend(); }} />
                <Button size="sm" className="h-9" onClick={handleSend} disabled={sending || !inputText.trim()}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-6 text-[10px]"
                  onClick={() => window.open("/app/inquiries/new", "_blank")} >
                  <Bot className="h-3 w-3 mr-1" />AI 写邮件
                </Button>
                {contactMessages.filter(m => m.direction === "in" && !m.aiReply).slice(-3).map((m: any) => (
                  <Button key={m.id} variant="outline" size="sm" className="h-6 text-[10px]"
                    onClick={() => handleAIReply(m)} disabled={replying === m.id}>
                    {replying === m.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Bot className="h-3 w-3 mr-1" />}
                    AI 回复此条
                  </Button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">选择联系人查看消息</p>
              <p className="text-xs text-muted-foreground mt-1">支持 WhatsApp / 微信 / 邮件渠道</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
