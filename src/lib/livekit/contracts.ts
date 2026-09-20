import { z } from "zod";

export const sessionRequestSchema = z
  .object({
    mode: z.enum(["support", "marketing"]),
    language: z.enum(["zh", "en"]),
    brief: z.string().trim().max(4000).default(""),
    consent: z.literal(true),
  })
  .strict();

export type SessionRequest = z.infer<typeof sessionRequestSchema>;
export interface VoiceConnection {
  serverUrl: string;
  participantToken: string;
  roomName: string;
}

export const AGENT_EVENT_TOPIC = "tradepilot.agent.events";
export const agentEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: z.string().uuid(),
      type: z.literal("lead"),
      name: z.string().trim().min(1).max(200),
      company: z.string().max(200),
      email: z
        .string()
        .max(254)
        .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
      phone: z.string().max(80),
      requirement: z.string().min(1).max(2000),
      consent: z.literal(true),
    })
    .strict(),
  z
    .object({
      id: z.string().uuid(),
      type: z.literal("handoff"),
      reason: z.string().min(1).max(1000),
    })
    .strict(),
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;
export type LeadEvent = Extract<AgentEvent, { type: "lead" }>;
