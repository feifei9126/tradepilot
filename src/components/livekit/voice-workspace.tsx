"use client";
import Link from "next/link";

import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { Download, Headphones, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type {
  AgentEvent,
  SessionRequest,
  VoiceConnection,
} from "@/lib/livekit/contracts";
import { Conversation, type Transcript } from "./conversation";
import { LeadDraft } from "./lead-draft";
import "@livekit/components-styles";

export function VoiceWorkspace() {
  const [mode, setMode] = useState<SessionRequest["mode"]>("support");
  const [language, setLanguage] = useState<SessionRequest["language"]>("zh");
  const [brief, setBrief] = useState("");
  const [consent, setConsent] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connection, setConnection] = useState<VoiceConnection | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [ended, setEnded] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const startingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/livekit/session", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("无法读取配置，请确认已登录并刷新页面。");
        return response.json();
      })
      .then((data) => setConfigured(data.configured === true))
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => {
      controller.abort();
      requestRef.current?.abort();
    };
  }, []);
  const onEvent = useCallback((event: AgentEvent) => {
    setEvents((previous) =>
      previous.some((item) => item.id === event.id)
        ? previous
        : [...previous, event].slice(-50),
    );
  }, []);
  const end = useCallback(() => {
    setConnection(null);
    setEnded(true);
  }, []);

  async function start() {
    if (startingRef.current || connection) return;
    startingRef.current = true;
    const controller = new AbortController();
    requestRef.current = controller;
    setStarting(true);
    setError("");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "语音需要 HTTPS 或 localhost，以及支持麦克风的浏览器。",
        );
      // Check permissions before minting a token/dispatching a potentially billable agent.
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      media.getTracks().forEach((track) => track.stop());
      if (controller.signal.aborted) return;
      const response = await fetch("/api/livekit/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ mode, language, brief, consent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "创建会话失败");
      setTranscript([]);
      setEvents([]);
      setEnded(false);
      setConnection(data);
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "麦克风权限被拒绝，请在浏览器设置中允许访问。"
            : err instanceof Error
              ? err.message
              : "连接失败，请重试。",
        );
    } finally {
      startingRef.current = false;
      if (!controller.signal.aborted) setStarting(false);
    }
  }
  function download() {
    const text = [
      ...transcript.map((line) => `${line.speaker}：${line.text}`),
      ...events.map((event) =>
        event.type === "handoff"
          ? `待人工跟进：${event.reason}`
          : `待确认线索：${event.name} / ${event.company}\n${event.email} ${event.phone}\n${event.requirement}`,
      ),
    ].join("\n\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tradepilot-voice-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <Headphones className="size-4" />
          LiveKit Agents
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">AI 语音客服</h1>
        <p className="text-sm text-muted-foreground">
          客服答疑、需求识别与营销线索采集。当前为登录后的内部试用工作台，不是公开访客入口。
        </p>
      </header>
      {configured === false && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          尚未配置 LiveKit 或语音模型。请在 <Link href="/app/api-config" className="underline">系统 → API 配置中心</Link> 完成语音服务引导，并启动 Agent Worker。
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <section className="space-y-5 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">会话设置</h2>
          <fieldset
            disabled={!!connection || starting}
            className="space-y-5 disabled:opacity-60"
          >
            <div className="space-y-2">
              <Label htmlFor="voice-mode">业务场景</Label>
              <select
                id="voice-mode"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as SessionRequest["mode"])
                }
              >
                <option value="support">客户服务 · 答疑与问题分流</option>
                <option value="marketing">营销顾问 · 需求与意向采集</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-language">首选语言</Label>
              <select
                id="voice-language"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={language}
                onChange={(e) =>
                  setLanguage(e.target.value as SessionRequest["language"])
                }
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-brief">已核实的业务资料（可选）</Label>
              <Textarea
                id="voice-brief"
                rows={7}
                maxLength={4000}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="例如：产品功能、适用场景、公开售后政策。未提供的信息会交由人工核实。不要填写密码、内部成本或敏感订单资料。"
              />
              <p className="text-xs text-muted-foreground">
                {brief.length}/4000 · 仅用于本次会话，不自动读取 CRM 数据。
              </p>
            </div>
            <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <input
                type="checkbox"
                className="mt-1"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              我同意本次音频、转写和业务资料由配置的 LiveKit 与 AI
              服务处理，并已取得必要的参与者许可。
            </label>
          </fieldset>
          {!connection && (
            <Button
              className="w-full"
              onClick={start}
              disabled={!configured || !consent || starting}
            >
              {starting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Headphones className="size-4" />
              )}
              {starting
                ? "准备连接…"
                : ended
                  ? "开始新会话（清空当前记录）"
                  : "开始语音会话"}
            </Button>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            不会录制音频。字幕和待确认事项仅保留在当前页面，刷新或开始新会话将清空；可先下载记录。模型服务的数据留存策略以你配置的提供商为准。
          </p>
        </section>
        <section className="space-y-5 rounded-2xl border bg-card p-5">
          {connection ? (
            <LiveKitRoom
              key={connection.roomName}
              serverUrl={connection.serverUrl}
              token={connection.participantToken}
              connect
              audio
              video={false}
              onDisconnected={end}
              onError={() => {
                setError(
                  "语音连接失败，请检查 LiveKit 地址、网络和 Worker 状态后重试。",
                );
                end();
              }}
              onMediaDeviceFailure={() =>
                setError("麦克风不可用，请检查设备和浏览器权限。")
              }
            >
              <Conversation
                onTranscript={setTranscript}
                onEvent={onEvent}
                onEnd={end}
                onError={setError}
              />
            </LiveKitRoom>
          ) : (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl bg-muted/40 text-muted-foreground">
              <Headphones className="size-8" />
              <p className="text-sm">
                {ended
                  ? "会话已结束，记录仍可查看或下载"
                  : "配置会话后，开始与 AI 客服对话"}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">实时对话</h2>
            <Button
              size="sm"
              variant="outline"
              disabled={!transcript.length && !events.length}
              onClick={download}
            >
              <Download className="size-4" />
              下载记录
            </Button>
          </div>
          <div
            className="max-h-[420px] min-h-52 space-y-3 overflow-y-auto"
            role="log"
            aria-label="实时对话字幕"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {!transcript.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                识别后的对话字幕会显示在这里
              </p>
            )}
            {transcript.map((line) => (
              <div
                key={line.id}
                className={`rounded-xl p-3 text-sm ${line.speaker === "我" ? "bg-primary/5" : "bg-muted/50"}`}
              >
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {line.speaker}
                </p>
                <p className="whitespace-pre-wrap">{line.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      {events.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">待处理事项</h2>
          {events.map((event) =>
            event.type === "lead" ? (
              <LeadDraft key={event.id} event={event} />
            ) : (
              <div
                key={event.id}
                role="status"
                className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
              >
                <p className="font-medium">人工跟进请求（尚未转接）</p>
                <p className="mt-1 whitespace-pre-wrap">{event.reason}</p>
                <p className="mt-2 text-xs">
                  请操作员自行安排跟进；本功能不会呼叫人工坐席或自动创建工单。
                </p>
              </div>
            ),
          )}
        </section>
      )}
    </div>
  );
}
