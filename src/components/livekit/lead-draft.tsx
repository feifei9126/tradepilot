"use client";

import { useState } from "react";
import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeadEvent } from "@/lib/livekit/contracts";

export function LeadDraft({ event }: { event: LeadEvent }) {
  const [name, setName] = useState(event.name);
  const [email, setEmail] = useState(event.email);
  const [phone, setPhone] = useState(event.phone);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (pending || saved) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          source: "livekit-agent",
          stage: "new",
          tags: ["AI语音意向"],
          notes: [
            `公司：${event.company || "未提供"}`,
            `需求：${event.requirement}`,
            "AI 采集的联系许可与内容已由操作员确认；请按客户同意的范围跟进。",
          ].join("\n"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "保存失败，请先检查客户列表，避免重复创建。",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-3 rounded-xl border bg-background p-4">
      <p className="flex items-center gap-2 font-medium">
        <UserRoundPlus className="size-4" />
        待确认意向线索
      </p>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {event.company && `${event.company} · `}
        {event.requirement}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`name-${event.id}`}>客户名称</Label>
          <Input
            id={`name-${event.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            disabled={saved || pending}
          />
        </div>
        <div>
          <Label htmlFor={`email-${event.id}`}>邮箱</Label>
          <Input
            id={`email-${event.id}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            disabled={saved || pending}
          />
        </div>
        <div>
          <Label htmlFor={`phone-${event.id}`}>电话</Label>
          <Input
            id={`phone-${event.id}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={80}
            disabled={saved || pending}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        请核实客户同意被联系及字段内容，点击后才会创建客户。不会自动发送营销消息。
      </p>
      <Button
        size="sm"
        onClick={save}
        disabled={pending || saved || !name.trim()}
      >
        {pending ? "保存中…" : saved ? "已创建客户" : "确认许可并创建客户"}
      </Button>
      {saved && (
        <Link className="ml-3 text-sm underline" href="/app/contacts">
          查看客户
        </Link>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
