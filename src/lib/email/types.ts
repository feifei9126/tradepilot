export type EmailProvider = "resend" | "smtp_imap";
export type EmailAccountStatus = "active" | "disabled";
export type EmailHealthStatus = "unknown" | "healthy" | "error";
export type EmailDirection = "inbound" | "outbound";
export type EmailFolder = "inbox" | "sent" | "draft" | "trash";

export interface EmailAddress {
  email: string;
  name?: string | null;
}

export interface EmailAccount {
  id: string;
  companyId: string;
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
  encryptedCredentials: string | null;
  credentialsConfigured: boolean;
  status: EmailAccountStatus;
  healthStatus: EmailHealthStatus;
  lastError: string | null;
  syncCursor: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EmailThread {
  id: string;
  companyId: string;
  accountId: string;
  subject: string;
  participants: EmailAddress[];
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessage {
  id: string;
  companyId: string;
  accountId: string;
  threadId: string;
  normalizedMessageKey: string;
  providerMessageId: string | null;
  externalId: string | null;
  direction: EmailDirection;
  folder: EmailFolder;
  from: EmailAddress[];
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  rawMimeObjectKey: string | null;
  isRead: boolean;
  isStarred: boolean;
  status: string;
  errorCode: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboundEmailInput {
  companyId: string;
  accountId: string;
  threadId: string;
  normalizedMessageKey: string;
  providerMessageId?: string | null;
  direction: "inbound";
  folder: "inbox";
  from: EmailAddress[];
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
  rawMimeObjectKey?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
}

export interface OutboundEmailInput {
  companyId: string;
  accountId: string;
  threadId: string;
  normalizedMessageKey: string;
  externalId?: string | null;
  folder: "draft" | "sent";
  from: EmailAddress[];
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
  status: "draft" | "sent";
  sentAt?: string | null;
}

export interface EmailOutboxItem {
  id: string;
  companyId: string;
  accountId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  status: string;
  attemptCount: number;
  nextAttemptAt: string;
  leasedUntil: string | null;
  externalId: string | null;
  lastErrorCode: string | null;
  lastError: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderEmailEvent {
  id: string;
  companyId: string;
  accountId: string | null;
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  receivedAt: string;
  processedAt: string | null;
}

export interface EmailRepository {
  listAccounts(companyId: string): Promise<EmailAccount[]>;
  findActiveResendAccountByEmail(email: string): Promise<EmailAccount | null>;
  createAccount(input: EmailAccount): Promise<EmailAccount>;
  updateAccount(companyId: string, id: string, patch: Partial<EmailAccount>): Promise<EmailAccount | null>;
  deactivateAccount(companyId: string, id: string): Promise<EmailAccount | null>;
  listThreads(companyId: string, options?: { accountId?: string; limit?: number }): Promise<EmailThread[]>;
  listMessages(companyId: string, options?: { accountId?: string; threadId?: string; folder?: string; limit?: number }): Promise<EmailMessage[]>;
  updateMessage(companyId: string, id: string, patch: Pick<Partial<EmailMessage>, "isRead" | "isStarred">): Promise<EmailMessage | null>;
  insertInboundMessage(input: InboundEmailInput): Promise<EmailMessage>;
  saveOutboundMessage(input: OutboundEmailInput): Promise<EmailMessage>;
  enqueue(input: EmailOutboxItem): Promise<EmailOutboxItem>;
  leaseOutbox(input: { now: string; leasedUntil: string; limit: number; providers?: EmailProvider[] }): Promise<EmailOutboxItem[]>;
  markOutbox(companyId: string, id: string, patch: Partial<EmailOutboxItem>): Promise<EmailOutboxItem | null>;
  recordProviderEvent(input: ProviderEmailEvent): Promise<{ event: ProviderEmailEvent; created: boolean }>;
  markProviderEventProcessed(provider: string, providerEventId: string, processedAt: string): Promise<ProviderEmailEvent | null>;
}
