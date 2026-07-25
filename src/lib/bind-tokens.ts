import { randomUUID } from "node:crypto";

export interface PendingBindToken {
  token: string;
  channel: "whatsapp" | "wechat";
  phone: string;
  expiresAt: number;
}

type BindTokenGlobal = typeof globalThis & {
  __bindTokens?: Record<string, PendingBindToken>;
};

function tokenStore() {
  const runtime = globalThis as BindTokenGlobal;
  runtime.__bindTokens ??= {};
  return runtime.__bindTokens;
}

export function createBindToken(channel: PendingBindToken["channel"], phone: string, now = Date.now()) {
  const pending: PendingBindToken = {
    token: randomUUID(),
    channel,
    phone,
    expiresAt: now + 5 * 60 * 1000,
  };
  tokenStore()[pending.token] = pending;
  return pending;
}

export function consumeBindToken(token: string, now = Date.now()) {
  const tokens = tokenStore();
  const pending = tokens[token];
  if (!pending) return { error: "无效或已使用的二维码" } as const;
  delete tokens[token];
  if (now > pending.expiresAt) return { error: "二维码已过期" } as const;
  return { pending } as const;
}
