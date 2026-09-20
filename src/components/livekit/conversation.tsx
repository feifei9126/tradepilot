"use client";

import { useEffect, useState } from "react";
import {
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  useDataChannel,
  useRoomContext,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { PhoneOff, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AGENT_EVENT_TOPIC,
  agentEventSchema,
  type AgentEvent,
} from "@/lib/livekit/contracts";

export type Transcript = { id: string; speaker: string; text: string };
const states: Record<string, string> = {
  disconnected: "未连接",
  connecting: "正在连接 Agent",
  initializing: "Agent 准备中",
  listening: "正在聆听",
  thinking: "正在思考",
  speaking: "正在回复",
  failed: "Agent 不可用",
};

export function Conversation({
  onTranscript,
  onEvent,
  onEnd,
  onError,
}: {
  onTranscript: (lines: Transcript[]) => void;
  onEvent: (event: AgentEvent) => void;
  onEnd: () => void;
  onError: (error: string) => void;
}) {
  const room = useRoomContext();
  const { state, agent } = useVoiceAssistant();
  const transcriptions = useTranscriptions();
  const [waitingTooLong, setWaitingTooLong] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaitingTooLong(true), 25_000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!transcriptions.length) return;
    onTranscript(
      transcriptions.slice(-300).map((line) => ({
        id: line.streamInfo.id,
        speaker:
          line.participantInfo.identity === room.localParticipant.identity
            ? "我"
            : "AI 客服",
        text: line.text,
      })),
    );
  }, [transcriptions, onTranscript, room]);
  useDataChannel(AGENT_EVENT_TOPIC, (message) => {
    // Other human participants must never be able to impersonate an agent/tool result.
    if (
      !message.from?.isAgent ||
      message.from.identity !== agent?.identity ||
      message.payload.byteLength > 16_000
    )
      return;
    try {
      const parsed = agentEventSchema.safeParse(
        JSON.parse(new TextDecoder().decode(message.payload)),
      );
      if (parsed.success) onEvent(parsed.data);
    } catch {
      /* Ignore malformed data packets. */
    }
  });
  return (
    <div className="space-y-4" data-lk-theme="default">
      <div
        className="flex items-center gap-3 rounded-xl bg-slate-950 p-5 text-white"
        role="status"
      >
        <Radio
          className={
            state === "speaking"
              ? "animate-pulse text-emerald-400"
              : "text-sky-400"
          }
        />
        <div>
          <p className="font-medium">{states[state] || state}</p>
          <p className="text-xs text-slate-400">
            实时语音 · 可随时打断 · 最长 15 分钟
          </p>
        </div>
      </div>
      {waitingTooLong && !agent && (
        <p role="alert" className="text-sm text-amber-700">
          尚未检测到 Agent。请确认独立 Worker 已启动，且 LIVEKIT_AGENT_NAME 与
          Web 端一致；可结束后重试。
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <TrackToggle
          source={Track.Source.Microphone}
          onChange={(enabled) => setMuted(!enabled)}
          onDeviceError={() =>
            onError("无法使用麦克风，请检查浏览器权限和设备。")
          }
        >
          {muted ? "开启麦克风" : "静音"}
        </TrackToggle>
        <StartAudio label="点击开启声音播放" />
        <Button variant="destructive" onClick={onEnd}>
          <PhoneOff className="size-4" />
          结束会话
        </Button>
      </div>
      <RoomAudioRenderer />
    </div>
  );
}
