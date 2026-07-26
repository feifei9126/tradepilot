import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";

import PostalMime, { type Address, type Email, type RawEmail } from "postal-mime";
import sanitizeHtml from "sanitize-html";

import type { EmailRepository, InboundEmailInput, EmailAddress } from "./types";

export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

export interface InboundNormalizationOptions {
  companyId: string;
  accountId: string;
  threadId?: string;
  provider?: string;
  providerMessageId?: string | null;
  rawMime: RawEmail;
}

export interface CloudflareInboundOptions extends Omit<InboundNormalizationOptions, "rawMime"> {
  raw?: RawEmail;
  from?: string;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  date?: string;
  messageId?: string;
  text?: string;
  html?: string;
  headers?: Headers | Record<string, string>;
}

export interface InboundEmailResult extends InboundEmailInput {
  provider: string;
  providerEventId?: string;
}

export type InboundEmail = InboundEmailResult;

export interface IngestInboundOptions extends InboundNormalizationOptions {
  repository: EmailRepository;
  providerEventId?: string | null;
  eventType?: string;
  eventPayload?: Record<string, unknown>;
}

function headerValue(email: Email, key: string) {
  const found = email.headers.find((header) => header.key.toLowerCase() === key.toLowerCase());
  return found?.value || "";
}

function flattenAddress(value: Address | undefined): EmailAddress[] {
  if (!value) return [];
  if ("group" in value && Array.isArray(value.group)) {
    return value.group.flatMap((item) => flattenAddress(item));
  }
  if ("address" in value && typeof value.address === "string" && value.address.trim()) {
    const email = value.address.trim().toLowerCase();
    const name = typeof value.name === "string" ? value.name.trim() : "";
    return [{ email, ...(name ? { name } : {}) }];
  }
  return [];
}

function flattenAddresses(values: Address[] | undefined) {
  return values?.flatMap((value) => flattenAddress(value)) || [];
}

function safeHeader(value: string | undefined, maxLength: number) {
  return (value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

export const inboundSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: ["a", "abbr", "b", "blockquote", "br", "code", "div", "em", "i", "li", "ol", "p", "pre", "span", "strong", "sub", "sup", "table", "tbody", "td", "th", "thead", "tr", "u", "ul"],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    abbr: ["title"],
    span: ["title"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { a: ["http", "https", "mailto"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
};

export function sanitizeInboundHtml(html: string | null | undefined) {
  return html ? sanitizeHtml(html, inboundSanitizeOptions) : null;
}

function digestFallback(accountId: string, from: EmailAddress[], date: string, subject: string, body: string) {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  return `fallback:${createHash("sha256").update([accountId, from.map((item) => item.email).join(","), date, subject, bodyHash].join("\n")).digest("hex")}`;
}

function threadIdFor(input: Pick<InboundNormalizationOptions, "threadId" | "companyId" | "accountId"> & { normalizedMessageKey: string }) {
  if (input.threadId?.trim()) return input.threadId.trim();
  const bytes = createHash("sha256").update(`${input.companyId}:${input.accountId}:${input.normalizedMessageKey}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function normalizeInboundEmail(input: InboundNormalizationOptions): Promise<InboundEmailResult> {
  const parsed = await PostalMime.parse(input.rawMime);
  const from = flattenAddress(parsed.from);
  const to = flattenAddresses(parsed.to);
  const cc = flattenAddresses(parsed.cc);
  const bcc = flattenAddresses(parsed.bcc);
  const subject = safeHeader(parsed.subject, 500);
  const date = parsed.date || headerValue(parsed, "date");
  const receivedAt = date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : new Date().toISOString();
  const textBody = typeof parsed.text === "string" ? parsed.text.trim() || null : null;
  const htmlBody = sanitizeInboundHtml(typeof parsed.html === "string" ? parsed.html : null);
  const providerMessageId = input.providerMessageId?.trim() || parsed.messageId?.trim() || null;
  const normalizedMessageKey = providerMessageId
    ? `message:${providerMessageId}`
    : digestFallback(input.accountId, from, date, subject, textBody || htmlBody || "");

  return {
    companyId: input.companyId,
    accountId: input.accountId,
    threadId: threadIdFor({ ...input, normalizedMessageKey }),
    normalizedMessageKey,
    providerMessageId,
    direction: "inbound",
    folder: "inbox",
    from,
    to,
    cc,
    bcc,
    subject,
    textBody,
    htmlBody,
    sentAt: receivedAt,
    receivedAt,
    provider: input.provider || "resend",
  };
}

function headerObject(headers: CloudflareInboundOptions["headers"]) {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function addressHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join(", ") : value || "";
}

function synthesizedMime(input: CloudflareInboundOptions) {
  const headers = headerObject(input.headers);
  const lines = [
    `From: ${input.from || headers.from || ""}`,
    `To: ${addressHeader(input.to) || headers.to || ""}`,
    ...(input.cc || headers.cc ? [`Cc: ${addressHeader(input.cc) || headers.cc}`] : []),
    ...(input.bcc || headers.bcc ? [`Bcc: ${addressHeader(input.bcc) || headers.bcc}`] : []),
    `Subject: ${input.subject || headers.subject || ""}`,
    `Date: ${input.date || headers.date || new Date().toUTCString()}`,
    ...(input.messageId || headers["message-id"] ? [`Message-ID: ${input.messageId || headers["message-id"]}`] : []),
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.text || "",
  ];
  return lines.join("\r\n");
}

export async function normalizeCloudflareInboundEmail(input: CloudflareInboundOptions): Promise<InboundEmailResult> {
  const normalized = await normalizeInboundEmail({
    companyId: input.companyId,
    accountId: input.accountId,
    threadId: input.threadId,
    provider: input.provider || "cloudflare_email_routing",
    providerMessageId: input.providerMessageId || input.messageId,
    rawMime: input.raw || synthesizedMime(input),
  });
  const headers = headerObject(input.headers);
  if (input.from || headers.from) normalized.from = parseAddressList(input.from || headers.from);
  if (input.to || headers.to) normalized.to = parseAddressList(addressHeader(input.to) || headers.to);
  if (input.cc || headers.cc) normalized.cc = parseAddressList(addressHeader(input.cc) || headers.cc);
  if (input.bcc || headers.bcc) normalized.bcc = parseAddressList(addressHeader(input.bcc) || headers.bcc);
  if (input.subject || headers.subject) normalized.subject = safeHeader(input.subject || headers.subject, 500);
  if (input.html !== undefined) normalized.htmlBody = sanitizeInboundHtml(input.html);
  if (input.text !== undefined) normalized.textBody = input.text;
  return normalized;
}

function parseAddressList(value: string) {
  return value.split(",").map((entry) => {
    const match = entry.trim().match(/^(?:\"?([^\"]*)\"?\s*)?<([^>]+)>$/);
    const email = (match?.[2] || entry).trim().toLowerCase();
    const name = (match?.[1] || "").trim();
    return { email, ...(name ? { name } : {}) };
  }).filter((entry) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entry.email));
}

export async function ingestInboundEmail(input: IngestInboundOptions) {
  const provider = input.provider || "resend";
  const providerEventId = input.providerEventId?.trim() || undefined;
  const normalized = await normalizeInboundEmail(input);
  const message = await input.repository.insertInboundMessage(normalized);
  if (providerEventId) {
    const recorded = await input.repository.recordProviderEvent({
      id: randomUUID(),
      companyId: input.companyId,
      accountId: input.accountId,
      provider,
      providerEventId,
      eventType: input.eventType || "email.received",
      payload: input.eventPayload || {},
      receivedAt: new Date().toISOString(),
      processedAt: null,
    });
    return { created: recorded.created, event: recorded.event, message };
  }
  return { created: true, event: null, message };
}

export interface ResendSignatureHeaders {
  "svix-id"?: string | null;
  "svix-timestamp"?: string | null;
  "svix-signature"?: string | null;
}

function header(headers: ResendSignatureHeaders | Headers, name: string) {
  if (headers instanceof Headers) return headers.get(name);
  const entries = headers as Record<string, string | null | undefined>;
  return entries[name as keyof typeof entries] || entries[name.toLowerCase() as keyof typeof entries] || null;
}

function webhookKey(secret: string) {
  if (!secret.startsWith("whsec_")) return Buffer.from(secret);
  const encoded = secret.slice("whsec_".length);
  try {
    const decoded = Buffer.from(encoded, "base64");
    if (decoded.length > 0) return decoded;
  } catch {
    // Fall through to raw secret for local/test deployments.
  }
  return Buffer.from(secret);
}

export function verifyResendWebhookSignature(options: {
  rawBody: string;
  headers: ResendSignatureHeaders | Headers;
  secret: string;
  now?: number;
  toleranceSeconds?: number;
}) {
  const id = header(options.headers, "svix-id");
  const timestamp = header(options.headers, "svix-timestamp");
  const signature = header(options.headers, "svix-signature");
  const timestampNumber = Number(timestamp);
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const tolerance = options.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp) || !Number.isSafeInteger(timestampNumber) || Math.abs(now - timestampNumber) > tolerance) return false;
  const signed = `${id}.${timestamp}.${options.rawBody}`;
  const expected = createHmac("sha256", webhookKey(options.secret)).update(signed).digest("base64");
  return signature.split(/\s+/).some((candidate) => {
    const [version, supplied] = candidate.split(",", 2);
    if (version !== "v1" || !supplied) return false;
    const actual = Buffer.from(supplied);
    const wanted = Buffer.from(expected);
    return actual.length === wanted.length && timingSafeEqual(actual, wanted);
  });
}

export const verifySvixSignature = verifyResendWebhookSignature;
export const verifyWebhookSignature = verifyResendWebhookSignature;
export const parseInboundEmail = normalizeInboundEmail;
export const normalizeCloudflareEmail = normalizeCloudflareInboundEmail;
export const ingestEmailInbound = ingestInboundEmail;
