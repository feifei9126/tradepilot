import type { EmailAccount } from "./types";

export interface EmailAccountView {
  id: string;
  companyId: string;
  name: string;
  email: string;
  provider: EmailAccount["provider"];
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapMailbox: string | null;
  credentialsConfigured: boolean;
  status: EmailAccount["status"];
  healthStatus: EmailAccount["healthStatus"];
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

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
