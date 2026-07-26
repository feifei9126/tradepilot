import { BusinessError } from "@/lib/business/errors";

import type { EmailAddress, EmailAccountStatus, EmailProvider } from "./types";

export const MAX_EMAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_EMAIL_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const MAX_SUBJECT_LENGTH = 500;
const MAX_BODY_LENGTH = 1_000_000;
const SMTP_PORTS = new Set([465, 587]);
const IMAP_PORTS = new Set([143, 993]);
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

type Environment = Record<string, string | undefined>;

export interface ParsedEmailAccountInput {
  name: string;
  email: string;
  provider: EmailProvider;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapMailbox: string | null;
  status: EmailAccountStatus;
  credentials: Record<string, string>;
}

export interface ParsedEmailAttachment {
  name: string;
  contentType: string;
  sizeBytes: number;
}

export interface ParsedEmailMessageInput {
  action: "save-draft" | "send";
  accountId: string | null;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  body: string;
  html: string | null;
  attachments: ParsedEmailAttachment[];
}

function invalid(message: string): never {
  throw new BusinessError("VALIDATION_ERROR", message, 400);
}

function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid("Email input must be an object");
  }
  return value as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== "string") return invalid(`${label} is required`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\0\r\n]/.test(normalized)) {
    return invalid(`${label} is invalid`);
  }
  return normalized;
}

function optionalCredential(
  input: Record<string, unknown>,
  name: string,
  maxLength: number,
) {
  const nested = input.credentials && typeof input.credentials === "object" && !Array.isArray(input.credentials)
    ? input.credentials as Record<string, unknown>
    : {};
  const raw = input[name] === undefined ? nested[name] : input[name];
  if (typeof raw !== "string") return invalid(`Email ${name} is required`);
  const value = raw.trim();
  if (!value || value.length > maxLength || /[\0\r\n]/.test(value)) {
    return invalid(`Email ${name} is invalid`);
  }
  return value;
}

function optionalCredentialIfPresent(
  input: Record<string, unknown>,
  name: string,
  maxLength: number,
) {
  const nested = input.credentials && typeof input.credentials === "object" && !Array.isArray(input.credentials)
    ? input.credentials as Record<string, unknown>
    : {};
  const raw = input[name] === undefined ? nested[name] : input[name];
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") return invalid(`Email ${name} is invalid`);
  const value = raw.trim();
  if (!value || value.length > maxLength || /[\0\r\n]/.test(value)) {
    return invalid(`Email ${name} is invalid`);
  }
  return value;
}

export function normalizeEmailAddress(value: unknown) {
  if (typeof value !== "string") return invalid("Email address is invalid");
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  const local = at > 0 ? email.slice(0, at) : "";
  if (
    !email ||
    email.length > 255 ||
    local.length > 64 ||
    !EMAIL_PATTERN.test(email) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  ) {
    return invalid("Email address is invalid");
  }
  return email;
}

function port(value: unknown, allowed: ReadonlySet<number>, label: string) {
  const parsed = typeof value === "string" && value.trim()
    ? Number(value)
    : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed) || !allowed.has(parsed)) {
    return invalid(`${label} port is invalid`);
  }
  return parsed;
}

function ipv4Parts(host: string) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split(".").map(Number);
  return parts.every((part) => part >= 0 && part <= 255) ? parts : null;
}

function isPrivateIpv4(parts: number[]) {
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

function normalizeUrlHost(value: string) {
  const candidate = value.endsWith(".") ? value.slice(0, -1) : value;
  const withBrackets = candidate.includes(":") && !candidate.startsWith("[")
    ? `[${candidate}]`
    : candidate;
  try {
    const parsed = new URL(`http://${withBrackets}`);
    if (
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return invalid("Mail host is invalid");
    }
    return parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return invalid("Mail host is invalid");
  }
}

function normalizeMailHost(value: unknown, environment: Environment) {
  if (typeof value !== "string") return invalid("Mail host is required");
  const raw = value.trim().toLowerCase();
  if (
    !raw ||
    raw.length > 253 ||
    /[^\x21-\x7e]/.test(raw) ||
    /\s|\/|\\|@/.test(raw) ||
    raw.includes("://")
  ) {
    return invalid("Mail host is invalid");
  }

  const host = normalizeUrlHost(raw);
  const allowPrivate = environment.TRADEPILOT_ALLOW_PRIVATE_MAIL_HOSTS === "true";
  const metadataNames = new Set([
    "metadata.google.internal",
    "metadata.goog",
    "instance-data.ec2.internal",
  ]);
  if (metadataNames.has(host) || host === "100.100.100.200") {
    return invalid("Mail host is not allowed");
  }

  const address = ipv4Parts(host);
  if (address) {
    const [first, second, third, fourth] = address;
    if (
      first === 0 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      first >= 224 ||
      (first === 255 && second === 255 && third === 255 && fourth === 255)
    ) {
      return invalid("Mail host is not allowed");
    }
    if (isPrivateIpv4(address) && !allowPrivate) {
      return invalid("Private mail hosts are not allowed");
    }
    return host;
  }

  if (host.includes(":")) {
    const compact = host.toLowerCase();
    if (
      compact === "::" ||
      compact === "::1" ||
      compact.startsWith("fe8") ||
      compact.startsWith("fe9") ||
      compact.startsWith("fea") ||
      compact.startsWith("feb") ||
      compact.startsWith("::ffff:") ||
      compact === "fd00:ec2::254"
    ) {
      return invalid("Mail host is not allowed");
    }
    if ((compact.startsWith("fc") || compact.startsWith("fd")) && !allowPrivate) {
      return invalid("Private mail hosts are not allowed");
    }
    return host;
  }

  if (
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)
  ) {
    return invalid("Mail host is invalid");
  }
  if (host === "localhost" || host.endsWith(".localhost")) {
    return invalid("Mail host is not allowed");
  }
  if (
    (!host.includes(".") ||
      host.endsWith(".internal") ||
      host.endsWith(".local") ||
      host.endsWith(".lan") ||
      host.endsWith(".home") ||
      host.endsWith(".home.arpa") ||
      host.endsWith(".corp") ||
      host.endsWith(".private")) &&
    !allowPrivate
  ) {
    return invalid("Private mail hosts are not allowed");
  }
  return host;
}

function hasConnectionValue(input: Record<string, unknown>) {
  return ["smtpHost", "smtpPort", "imapHost", "imapPort", "imapMailbox"]
    .some((key) => input[key] !== undefined && input[key] !== null && input[key] !== "");
}

export function parseEmailAccountInput(
  value: unknown,
  environment: Environment = process.env,
): ParsedEmailAccountInput {
  const input = objectInput(value);
  const name = requiredString(input.name, "Account name", 100);
  const email = normalizeEmailAddress(input.email);
  const provider = input.provider === undefined ? "smtp_imap" : input.provider;
  const status = input.status === undefined ? "active" : input.status;
  if (provider !== "smtp_imap" && provider !== "resend") {
    return invalid("Email provider is invalid");
  }
  if (status !== "active" && status !== "disabled") {
    return invalid("Email account status is invalid");
  }

  if (provider === "resend") {
    if (hasConnectionValue(input)) {
      return invalid("Resend accounts cannot include SMTP or IMAP settings");
    }
    const webhookSecret = optionalCredentialIfPresent(input, "webhookSecret", 4_096);
    return {
      name,
      email,
      provider,
      smtpHost: null,
      smtpPort: null,
      smtpSecure: true,
      imapHost: null,
      imapPort: null,
      imapSecure: true,
      imapMailbox: null,
      status,
      credentials: {
        apiKey: optionalCredential(input, "apiKey", 4_096),
        ...(webhookSecret ? { webhookSecret } : {}),
      },
    };
  }

  const smtpPort = port(input.smtpPort ?? 465, SMTP_PORTS, "SMTP");
  const imapPort = port(input.imapPort ?? 993, IMAP_PORTS, "IMAP");
  return {
    name,
    email,
    provider,
    smtpHost: normalizeMailHost(input.smtpHost, environment),
    smtpPort,
    smtpSecure: smtpPort === 465,
    imapHost: normalizeMailHost(input.imapHost, environment),
    imapPort,
    imapSecure: imapPort === 993,
    imapMailbox: requiredString(input.imapMailbox ?? "INBOX", "IMAP mailbox", 255),
    status,
    credentials: {
      username: optionalCredential(
        { ...input, username: input.username ?? email },
        "username",
        320,
      ),
      password: optionalCredential(input, "password", 100_000),
    },
  };
}

function parseAddresses(value: unknown, label: string, required: boolean) {
  const values = typeof value === "string"
    ? value.split(/[;,]/).map((item) => item.trim()).filter(Boolean)
    : Array.isArray(value)
      ? value
      : [];
  if (required && values.length === 0) return invalid(`${label} is required`);
  if (values.length > 100) return invalid(`${label} contains too many addresses`);
  return values.map((item): EmailAddress => {
    if (typeof item === "string") return { email: normalizeEmailAddress(item) };
    const address = objectInput(item);
    const name = address.name === undefined || address.name === null || address.name === ""
      ? null
      : requiredString(address.name, `${label} name`, 200);
    return { email: normalizeEmailAddress(address.email), name };
  });
}

function parseAttachments(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 50) {
    return invalid("Email attachments are invalid");
  }
  let totalBytes = 0;
  return value.map((item): ParsedEmailAttachment => {
    const attachment = objectInput(item);
    const size = attachment.sizeBytes ?? attachment.size;
    if (
      typeof size !== "number" ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > MAX_EMAIL_ATTACHMENT_BYTES
    ) {
      return invalid("Email attachment exceeds the 10 MiB limit");
    }
    totalBytes += size;
    if (totalBytes > MAX_EMAIL_TOTAL_ATTACHMENT_BYTES) {
      return invalid("Email attachments exceed the 25 MiB total limit");
    }
    return {
      name: requiredString(attachment.name ?? attachment.filename, "Attachment name", 500),
      contentType: requiredString(
        attachment.contentType ?? attachment.type ?? "application/octet-stream",
        "Attachment content type",
        255,
      ).toLowerCase(),
      sizeBytes: size,
    };
  });
}

export function parseEmailMessageInput(value: unknown): ParsedEmailMessageInput {
  const input = objectInput(value);
  if (input.action !== "save-draft" && input.action !== "send") {
    return invalid("Email action must be save-draft or send");
  }
  const subject = requiredString(input.subject, "Email subject", MAX_SUBJECT_LENGTH);
  const body = typeof input.body === "string" ? input.body : "";
  if (body.length > MAX_BODY_LENGTH) return invalid("Email body is too long");
  const html = input.html === undefined || input.html === null
    ? null
    : typeof input.html === "string" && input.html.length <= MAX_BODY_LENGTH
      ? input.html
      : invalid("Email HTML body is too long");
  const accountId = input.accountId === undefined || input.accountId === null || input.accountId === ""
    ? null
    : requiredString(input.accountId, "Email account id", 100);

  return {
    action: input.action,
    accountId,
    to: parseAddresses(input.to, "Email recipient", true),
    cc: parseAddresses(input.cc, "Email CC", false),
    bcc: parseAddresses(input.bcc, "Email BCC", false),
    subject,
    body,
    html,
    attachments: parseAttachments(input.attachments),
  };
}
