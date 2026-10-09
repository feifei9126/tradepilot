import { query } from "@/db";
import { decryptTenantSecret, encryptTenantSecret } from "@/lib/tenant-secret";
import type { StoredEmailAccount } from "@/lib/store";

export type EmailCredentials = {
  smtpUsername: string;
  smtpPassword: string;
  imapUsername: string;
  imapPassword: string;
};

export async function getEmailAccount(companyId: string, accountId: string) {
  const result = await query<{ data: StoredEmailAccount }>("SELECT data FROM crm_records WHERE company_id=$1 AND kind='email_accounts' AND id=$2", [companyId, accountId]);
  return result.rows[0]?.data;
}

export async function getEmailCredentials(companyId: string, accountId: string): Promise<EmailCredentials | null> {
  const result = await query(`SELECT smtp_username,smtp_password_ciphertext,imap_username,imap_password_ciphertext FROM email_account_secrets WHERE company_id=$1 AND account_id=$2`, [companyId, accountId]);
  const row = result.rows[0];
  if (!row?.smtp_password_ciphertext && !row?.imap_password_ciphertext) return null;
  return {
    smtpUsername: String(row.smtp_username || ""),
    smtpPassword: row.smtp_password_ciphertext ? decryptTenantSecret(row.smtp_password_ciphertext, "smtp-password", companyId) : "",
    imapUsername: String(row.imap_username || ""),
    imapPassword: row.imap_password_ciphertext ? decryptTenantSecret(row.imap_password_ciphertext, "imap-password", companyId) : "",
  };
}

export async function saveEmailCredentials(companyId: string, accountId: string, input: { smtpUsername?: string; smtpPassword?: string; imapUsername?: string; imapPassword?: string; clearSmtp?: boolean; clearImap?: boolean }) {
  const current = await query("SELECT * FROM email_account_secrets WHERE company_id=$1 AND account_id=$2", [companyId, accountId]);
  const row = current.rows[0];
  const smtpCipher = input.clearSmtp ? null : input.smtpPassword ? encryptTenantSecret(input.smtpPassword, "smtp-password", companyId) : row?.smtp_password_ciphertext || null;
  const imapCipher = input.clearImap ? null : input.imapPassword ? encryptTenantSecret(input.imapPassword, "imap-password", companyId) : row?.imap_password_ciphertext || null;
  const smtpUser = input.smtpUsername?.trim() || row?.smtp_username || null;
  const imapUser = input.imapUsername?.trim() || row?.imap_username || null;
  await query(`INSERT INTO email_account_secrets(company_id,account_id,smtp_username,smtp_password_ciphertext,imap_username,imap_password_ciphertext)
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(company_id,account_id) DO UPDATE SET smtp_username=EXCLUDED.smtp_username,smtp_password_ciphertext=EXCLUDED.smtp_password_ciphertext,imap_username=EXCLUDED.imap_username,imap_password_ciphertext=EXCLUDED.imap_password_ciphertext,updated_at=now()`, [companyId, accountId, smtpUser, smtpCipher, imapUser, imapCipher]);
}

export async function emailCredentialStatus(companyId: string, accountId: string) {
  const result = await query(`SELECT smtp_password_ciphertext IS NOT NULL AS smtp_configured, imap_password_ciphertext IS NOT NULL AS imap_configured, smtp_last_tested_at, imap_last_tested_at, smtp_last_error, imap_last_error FROM email_account_secrets WHERE company_id=$1 AND account_id=$2`, [companyId, accountId]);
  const row = result.rows[0];
  return {
    smtpConfigured: row?.smtp_configured === true, imapConfigured: row?.imap_configured === true,
    smtpLastTestedAt: row?.smtp_last_tested_at ? new Date(row.smtp_last_tested_at).toISOString() : null,
    imapLastTestedAt: row?.imap_last_tested_at ? new Date(row.imap_last_tested_at).toISOString() : null,
    smtpLastError: row?.smtp_last_error || null, imapLastError: row?.imap_last_error || null,
  };
}

export async function markEmailConnectionTest(companyId: string, accountId: string, protocol: "smtp" | "imap", error?: string) {
  const timeColumn = protocol === "smtp" ? "smtp_last_tested_at" : "imap_last_tested_at";
  const errorColumn = protocol === "smtp" ? "smtp_last_error" : "imap_last_error";
  await query(`UPDATE email_account_secrets SET ${timeColumn}=now(),${errorColumn}=$3,updated_at=now() WHERE company_id=$1 AND account_id=$2`, [companyId, accountId, error ? error.slice(0, 255) : null]);
}
