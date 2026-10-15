import { withTenant } from "@/lib/tenant-route";
import { getStore, currentWorkspace } from "@/lib/workspace-context";
import { CrmError } from "@/lib/crm-repository";
import type { StoredEmailAccount } from "@/lib/store";
import { NextResponse } from "next/server";
import { isValidEmail } from "@/lib/validation";
import { boundedJson } from "@/lib/request-json";
import { emailCredentialStatus, saveEmailCredentials } from "@/lib/email/credentials";

import { resolveMailEndpoint } from "@/lib/email/network-policy";

function validPort(value: unknown, fallback: number) {
  const port = value === undefined || value === "" ? fallback : Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : null;
}

function validHost(value: string) {
  return value.length > 0 && value.length <= 253 && !/\s|\/|^https?:/i.test(value);
}

async function handleGET() {
  const accounts = await getStore().emailAccounts.list();
  const enriched = await Promise.all(accounts.map(async account => ({ ...account, credentials: await emailCredentialStatus(getStore().companyId, account.id) })));
  return NextResponse.json({ accounts: enriched, mode: "smtp-imap" });
}

async function handlePOST(req: Request) {
  if (!["owner", "admin"].includes(currentWorkspace()?.role || "")) throw new CrmError("仅工作区所有者或管理员可以保存邮箱参数", 403);
  const rawBody = await boundedJson(req, 32_000);
  const body = rawBody && typeof rawBody === "object" && !Array.isArray(rawBody) ? rawBody as Record<string, unknown> : {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const imapHost = typeof body.imapHost === "string" ? body.imapHost.trim() : "";
  const smtpHost = typeof body.smtpHost === "string" ? body.smtpHost.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const smtpUsername = typeof body.smtpUsername === "string" ? body.smtpUsername.trim() : username || email;
  const imapUsername = typeof body.imapUsername === "string" ? body.imapUsername.trim() : username || email;
  const smtpPassword = typeof body.smtpPassword === "string" ? body.smtpPassword : "";
  const imapPassword = typeof body.imapPassword === "string" ? body.imapPassword : "";
  const imapPort = validPort(body.imapPort, 993);
  const smtpPort = validPort(body.smtpPort, 465);
  if (!name || !email || !imapHost || !smtpHost) return NextResponse.json({ error: "显示名称、邮箱和服务器地址必填" }, { status: 400 });
  if (name.length > 100 || username.length > 320 || smtpUsername.length > 320 || imapUsername.length > 320 || smtpPassword.length > 1000 || imapPassword.length > 1000 || !isValidEmail(email) || !validHost(imapHost) || !validHost(smtpHost) || imapPort === null || smtpPort === null) return NextResponse.json({ error: "邮箱、服务器地址或端口格式无效" }, { status: 400 });
  const account: StoredEmailAccount = { id: crypto.randomUUID(), name, email, imapHost, imapPort, imapSecure: body.imapSecure !== false, smtpHost, smtpPort, smtpSecure: body.smtpSecure !== false, syncEnabled: body.syncEnabled === true, username: username || email, createdAt: new Date().toISOString() };
  await Promise.all([
    resolveMailEndpoint({ host: smtpHost, port: smtpPort, secure: account.smtpSecure, protocol: "smtp" }),
    resolveMailEndpoint({ host: imapHost, port: imapPort, secure: account.imapSecure, protocol: "imap" }),
  ]);
  const repository = getStore();
  await repository.write(async client => {
    const existing = await client.query("SELECT data->>'email' AS email FROM crm_records WHERE company_id=$1 AND kind='email_accounts'", [repository.companyId]);
    if (existing.rows.some(row => row.email === email)) throw new CrmError("该邮箱参数已经保存", 409);
    if (existing.rowCount! >= 20) throw new CrmError("每个工作区最多保存 20 个邮箱参数", 409);
    await repository.save(client, "email_accounts", account, true);
    await repository.auditIn(client, "email_accounts.create", account.id, { smtpConfigured: Boolean(smtpPassword), imapConfigured: Boolean(imapPassword) });
  });
  if (smtpPassword || imapPassword) await saveEmailCredentials(repository.companyId, account.id, { smtpUsername, smtpPassword: smtpPassword || undefined, imapUsername, imapPassword: imapPassword || undefined });
  return NextResponse.json({ ok: true, account: { ...account, credentials: await emailCredentialStatus(repository.companyId, account.id) }, mode: "smtp-imap" });
}

export const GET = withTenant(handleGET);
export const POST = withTenant(handlePOST);
