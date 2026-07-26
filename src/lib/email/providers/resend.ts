import {
  ProviderSendError,
  type EmailAddressInput,
  type ProviderSendResult,
  type SendEmailInput,
} from "./contracts";

export { ProviderSendError } from "./contracts";
export { ProviderSendError as ProviderError } from "./contracts";
export type { EmailProviderAdapter, SendEmailInput, EmailSendInput, ProviderSendResult } from "./contracts";

export interface ResendProviderOptions {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  endpoint?: string;
}

export interface ResendReceivedEmailOptions {
  apiKey: string;
  emailId: string;
  fetch?: typeof globalThis.fetch;
  endpoint?: string;
}

export type ResendProviderError = ProviderSendError;

function safeAddress(value: EmailAddressInput | undefined) {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : value;
}

function safeProviderCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_.-]{0,63}$/.test(normalized) ? normalized : null;
}

async function readProviderCode(response: Response) {
  try {
    const body = await response.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const record = body as Record<string, unknown>;
    const error = record.error && typeof record.error === "object" && !Array.isArray(record.error)
      ? record.error as Record<string, unknown>
      : undefined;
    return safeProviderCode(record.code) || safeProviderCode(record.name) || safeProviderCode(error?.code) || safeProviderCode(error?.name);
  } catch {
    return null;
  }
}

function statusFailure(status: number, providerCode: string | null) {
  if (status === 408) return new ProviderSendError("PROVIDER_TIMEOUT", "Email provider request timed out", true, status);
  if (status === 425 || status === 429) return new ProviderSendError("PROVIDER_RATE_LIMITED", "Email provider rate limit reached", true, status);
  if (status >= 500) return new ProviderSendError("PROVIDER_UNAVAILABLE", "Email provider is temporarily unavailable", true, status);
  if (status === 401 || status === 403) return new ProviderSendError("PROVIDER_AUTH_FAILED", "Email provider authentication failed", false, status);
  return new ProviderSendError("PROVIDER_INVALID_REQUEST", providerCode ? `Email provider rejected the request (${providerCode})` : "Email provider rejected the request", false, status);
}

function requestBody(input: SendEmailInput) {
  return {
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(input.cc !== undefined ? { cc: safeAddress(input.cc) } : {}),
    ...(input.bcc !== undefined ? { bcc: safeAddress(input.bcc) } : {}),
    ...(input.replyTo !== undefined ? { reply_to: safeAddress(input.replyTo) } : {}),
  };
}

export class ResendEmailProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly endpoint: string;

  constructor(options: ResendProviderOptions) {
    if (!options.apiKey || options.apiKey.trim().length < 4) {
      throw new ProviderSendError("PROVIDER_AUTH_FAILED", "Email provider credentials are invalid", false);
    }
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch || globalThis.fetch;
    this.endpoint = options.endpoint || "https://api.resend.com/emails";
  }

  async send(input: SendEmailInput): Promise<ProviderSendResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
        },
        body: JSON.stringify(requestBody(input)),
      });
    } catch {
      throw new ProviderSendError(
        "PROVIDER_NETWORK_ERROR",
        "Email provider network request failed",
        true,
        undefined,
      );
    }

    if (!response.ok) {
      throw statusFailure(response.status, await readProviderCode(response));
    }

    try {
      const body = await response.json() as unknown;
      const id = body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).id
        : undefined;
      const externalId = typeof id === "string" ? id.trim() : "";
      if (!externalId || externalId.length > 512) {
        throw new Error("missing provider id");
      }
      return { externalId };
    } catch (error) {
      if (error instanceof ProviderSendError) throw error;
      throw new ProviderSendError("PROVIDER_RESPONSE_INVALID", "Email provider returned an invalid response", false, response.status);
    }
  }
}

export const ResendProvider = ResendEmailProvider;

export function createResendProvider(options: ResendProviderOptions) {
  return new ResendEmailProvider(options);
}

export const createResendAdapter = createResendProvider;

export async function sendWithResend(options: ResendProviderOptions, input: SendEmailInput) {
  return new ResendEmailProvider(options).send(input);
}

export async function fetchResendReceivedEmail(options: ResendReceivedEmailOptions) {
  const apiKey = options.apiKey.trim();
  const emailId = options.emailId.trim();
  if (apiKey.length < 4) throw new ProviderSendError("PROVIDER_AUTH_FAILED", "Email provider credentials are invalid", false);
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(emailId)) throw new ProviderSendError("PROVIDER_INVALID_REQUEST", "Received email id is invalid", false);
  const endpoint = (options.endpoint || "https://api.resend.com/emails/receiving").replace(/\/$/, "");
  let response: Response;
  try {
    response = await (options.fetch || globalThis.fetch)(`${endpoint}/${encodeURIComponent(emailId)}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    throw new ProviderSendError("PROVIDER_NETWORK_ERROR", "Email provider network request failed", true);
  }
  if (!response.ok) throw statusFailure(response.status, await readProviderCode(response));
  try {
    const body = await response.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid response");
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ProviderSendError) throw error;
    throw new ProviderSendError("PROVIDER_RESPONSE_INVALID", "Email provider returned an invalid response", false, response.status);
  }
}
