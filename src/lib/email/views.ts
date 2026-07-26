import type { EmailAccount } from "./types";

export type EmailAccountView = Omit<EmailAccount, "encryptedCredentials" | "syncCursor">;

export function toEmailAccountView(account: EmailAccount): EmailAccountView {
  return {
    id: account.id,
    companyId: account.companyId,
    name: account.name,
    email: account.email,
    provider: account.provider,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    smtpSecure: account.smtpSecure,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapSecure: account.imapSecure,
    imapMailbox: account.imapMailbox,
    credentialsConfigured: account.credentialsConfigured,
    status: account.status,
    healthStatus: account.healthStatus,
    lastError: account.lastError,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
