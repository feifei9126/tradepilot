import { boundedJson } from "@/lib/request-json";
import { mutationOrigin } from "@/lib/api-config/access";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore, currentWorkspace } from "@/lib/workspace-context";
import { withTenant } from "@/lib/tenant-route";
import { CrmError } from "@/lib/crm-repository";
import { BillingError } from "@/lib/billing";
import type { StoredEmail } from "@/lib/store";
import { isValidEmail } from "@/lib/validation";
import { assertMarketingRecipientsAllowed } from "@/lib/email/compliance";
import { sendTenantEmail } from "@/lib/email/smtp";
import { finishEmailSend, publicEmailSendEvent, reserveEmailSend } from "@/lib/email/sending";

const draftInput = z.object({
  action: z.literal("save-draft"),
  to: z.string().trim().min(1).max(1000),
  subject: z.string().trim().min(1).max(500),
  body: z.string().max(100000).default(""),
}).strict();
const sendInput = z.object({
  action: z.literal("send"),
  accountId: z.string().trim().min(1).max(240),
  to: z.union([z.string().trim().min(1).max(8000), z.array(z.string().trim().min(1).max(320)).min(1).max(100)]),
  subject: z.string().trim().min(1).max(500),
  body: z.string().max(100000).default(""),
  html: z.string().max(200000).optional(),
  marketing: z.boolean().optional().transform(() => true),
  contactId: z.string().trim().max(240).optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
}).strict();
const patchInput = z.object({
  id: z.string().trim().min(1).max(240),
  isRead: z.boolean().optional(),
  contactId: z.string().trim().max(240).optional(),
}).strict().refine(value => value.isRead !== undefined || value.contactId !== undefined);
const folders = ["inbox", "sent", "draft", "trash"];

function parseRecipients(value: string | string[]) {
  const parts = (Array.isArray(value) ? value : value.split(/[;,\n]/)).map(item => item.trim().toLowerCase()).filter(Boolean);
  const recipients = [...new Set(parts)];
  if (!recipients.length || recipients.some(item => !isValidEmail(item))) throw new CrmError("收件人邮箱格式不正确");
  if (recipients.length > 100) throw new CrmError("一次最多发送给 100 个收件人");
  return recipients;
}

async function handleGET(req: Request) {
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") || "inbox";
  if (!folders.includes(folder)) throw new CrmError("邮件文件夹不存在");
  const search = (url.searchParams.get("q") || "").toLowerCase();
  const emails = (await getStore().emails.list()).filter(email =>
    email.folder === folder && (!search || [email.subject, email.from, email.to, email.body]
      .some(value => value.toLowerCase().includes(search))),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ emails, mode: "smtp-imap" });
}

async function handlePOST(req: Request) {
  const denied = mutationOrigin(req);
  if (denied) return denied;
  const raw = await boundedJson(req, 256000);
  const action = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { action?: unknown }).action : undefined;
  if (action === "save-draft") {
    const parsed = draftInput.safeParse(raw);
    if (!parsed.success) throw new CrmError("收件人、主题或草稿内容格式不正确");
    const now = new Date().toISOString();
    const { to, subject, body } = parsed.data;
    const email: StoredEmail = {
      to, subject, body, id: randomUUID(), accountId: "local", messageId: randomUUID(),
      from: "local-draft", date: now, folder: "draft", isRead: true,
      isStarred: false, labels: ["数据库草稿"], createdAt: now,
    };
    await getStore().emails.add(email);
    return NextResponse.json({ ok: true, email, mode: "database-draft" }, { status: 201 });
  }
  if (action !== "send") throw new BillingError("只支持保存草稿或真实 SMTP 发送", 400, "EMAIL_ACTION_INVALID");
  const parsed = sendInput.safeParse(raw);
  if (!parsed.success) throw new BillingError("发件账号、收件人、主题或正文格式不正确", 400, "EMAIL_INPUT_INVALID");
  const workspace = currentWorkspace();
  if (!workspace) throw new BillingError("工作区上下文不存在", 500, "WORKSPACE_CONTEXT_MISSING");
  const recipients = parseRecipients(parsed.data.to);
  const account = await getStore().emailAccounts.get(parsed.data.accountId);
  if (!account) throw new BillingError("发件邮箱不存在或不属于当前工作区", 404, "EMAIL_ACCOUNT_NOT_FOUND");
  if (parsed.data.contactId && !await getStore().contacts.get(parsed.data.contactId)) throw new BillingError("关联客户不存在或不属于当前工作区", 404, "CONTACT_NOT_FOUND");
  await assertMarketingRecipientsAllowed(workspace.companyId, recipients);
  const idempotencyKey = parsed.data.idempotencyKey || req.headers.get("idempotency-key") || "";
  const reservation = await reserveEmailSend({ companyId: workspace.companyId, accountId: account.id, recipientCount: recipients.length, marketing: parsed.data.marketing, idempotencyKey });
  if (reservation.duplicate) {
    const status = String(reservation.event.status);
    if (status === "pending") throw new BillingError("相同邮件正在发送，请稍后查询结果", 409, "EMAIL_SEND_IN_PROGRESS");
    if (status === "sent") return NextResponse.json({ ok: true, duplicate: true, event: publicEmailSendEvent(reservation.event) });
    throw new BillingError("相同幂等请求之前发送失败，请更换请求编号后重试", 409, "EMAIL_SEND_PREVIOUSLY_FAILED");
  }
  try {
    const result = await sendTenantEmail({ companyId: workspace.companyId, accountId: account.id, recipients, subject: parsed.data.subject, text: parsed.data.body, html: parsed.data.html, marketing: parsed.data.marketing });
    const sendStatus = result.accepted.length ? "sent" : "failed";
    await finishEmailSend(reservation.event.id, { status: sendStatus, providerMessageId: result.messageId || undefined, failureCode: sendStatus === "failed" ? "smtp_rejected" : undefined });
    if (sendStatus === "failed") throw new BillingError("SMTP 未接受任何收件人", 502, "SMTP_ALL_RECIPIENTS_REJECTED");
    const now = new Date().toISOString();
    const email: StoredEmail = {
      id: randomUUID(), accountId: account.id, messageId: result.messageId || randomUUID(), from: account.email,
      to: recipients.join(", "), subject: parsed.data.subject, body: parsed.data.body, htmlBody: parsed.data.html,
      date: now, folder: "sent", isRead: true, isStarred: false,
      labels: ["SMTP 已发送", ...(parsed.data.marketing ? ["营销邮件"] : [])], contactId: parsed.data.contactId, createdAt: now,
    };
    await getStore().emails.add(email);
    return NextResponse.json({ ok: true, duplicate: false, email, accepted: result.accepted, rejected: result.rejected, event: publicEmailSendEvent({ ...reservation.event, status: sendStatus, provider_message_id: result.messageId }) }, { status: 201 });
  } catch (error) {
    await finishEmailSend(reservation.event.id, { status: "failed", failureCode: error instanceof BillingError ? error.code : "smtp_send_failed" }).catch(() => {});
    if (error instanceof BillingError) throw error;
    throw new BillingError("SMTP 发送失败，请检查邮箱服务商、端口和凭据；详细信息已记录在服务端", 502, "SMTP_SEND_FAILED");
  }
}

async function handlePATCH(req: Request) {
  const denied = mutationOrigin(req);
  if (denied) return denied;
  const parsed = patchInput.safeParse(await boundedJson(req));
  if (!parsed.success) throw new CrmError("没有可更新的邮件字段或格式不正确");
  const { id, ...patch } = parsed.data;
  const email = await getStore().emails.update(id, {
    ...patch,
    ...(patch.contactId !== undefined ? { contactId: patch.contactId || undefined } : {}),
  });
  if (!email) throw new CrmError("邮件不存在", 404);
  return NextResponse.json({ email });
}

export const GET = withTenant(handleGET);
export const POST = withTenant(handlePOST);
export const PATCH = withTenant(handlePATCH);
