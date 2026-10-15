import { createTransport, type Transporter } from "nodemailer";
import { getEmailAccount, getEmailCredentials } from "./credentials";
import { resolveMailEndpoint } from "./network-policy";
import { assertMarketingRecipientsAllowed, buildUnsubscribeUrl } from "./compliance";
import { BillingError } from "@/lib/billing";

async function transportFor(account: { smtpHost: string; smtpPort: number; smtpSecure: boolean }, credentials: { smtpUsername: string; smtpPassword: string }) {
  if (!credentials.smtpUsername || !credentials.smtpPassword) throw new BillingError("该邮箱尚未配置 SMTP 用户名和密码", 503, "SMTP_NOT_CONFIGURED");
  const target = await resolveMailEndpoint({ host: account.smtpHost, port: account.smtpPort, secure: account.smtpSecure, protocol: "smtp" });
  return createTransport({ host: target.address, port: account.smtpPort, secure: account.smtpSecure, requireTLS: !account.smtpSecure, ignoreTLS: false, disableFileAccess: true, disableUrlAccess: true, auth: { user: credentials.smtpUsername, pass: credentials.smtpPassword }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000, tls: { rejectUnauthorized: true, minVersion: "TLSv1.2", servername: target.servername } });
}
function escapeHtml(value: string) { return value.replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[char] || char); }
function plainToHtml(value: string) { return escapeHtml(value).replace(/\r?\n/g, "<br>"); }

export async function testSmtpConnection(companyId: string, accountId: string) {
  const account = await getEmailAccount(companyId, accountId); const credentials = await getEmailCredentials(companyId, accountId);
  if (!account || !credentials) throw new BillingError("邮箱账号或 SMTP 凭据不存在", 404, "SMTP_ACCOUNT_NOT_FOUND");
  const transport = await transportFor(account, credentials); try { await transport.verify(); } finally { transport.close(); }
}

export async function sendTenantEmail(input: { companyId: string; accountId: string; recipients: string[]; subject: string; text: string; html?: string; marketing?: boolean }) {
  const account = await getEmailAccount(input.companyId, input.accountId); const credentials = await getEmailCredentials(input.companyId, input.accountId);
  if (!account || !credentials) throw new BillingError("邮箱账号或 SMTP 凭据不存在", 404, "SMTP_ACCOUNT_NOT_FOUND");
  const recipients = [...new Set(input.recipients.map(value => value.trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) throw new BillingError("请填写至少一个收件人", 400, "EMAIL_RECIPIENT_REQUIRED");
  await assertMarketingRecipientsAllowed(input.companyId, recipients);
  if (recipients.some(email => !buildUnsubscribeUrl(input.companyId, email))) throw new BillingError("营销邮件需要配置 AUTH_URL 或 NEXTAUTH_URL 生成退订链接", 503, "EMAIL_UNSUBSCRIBE_URL_NOT_CONFIGURED");
  const transport: Transporter = await transportFor(account, credentials);
  const accepted: string[] = []; const rejected: string[] = []; const messageIds: string[] = [];
  try {
    for (const recipient of recipients) {
      await assertMarketingRecipientsAllowed(input.companyId, [recipient]);
      const unsubscribe = buildUnsubscribeUrl(input.companyId, recipient);
      const footerText = unsubscribe ? `\n\n---\n不再接收营销邮件？点击退订：${unsubscribe}` : "";
      const footerHtml = unsubscribe ? `<hr><p style=\"font-size:12px;color:#666\">不再接收营销邮件？<a href=\"${escapeHtml(unsubscribe)}\">点击退订</a>。</p>` : "";
      const info = await transport.sendMail({
        from: `"${account.name.replace(/[\r\n\"]+/g, " ").slice(0, 100)}" <${account.email}>`,
        to: recipient,
        subject: input.subject,
        text: `${input.text}${footerText}`,
        html: input.html ? `${input.html}${footerHtml}` : `${plainToHtml(input.text)}${footerHtml}`,
        headers: unsubscribe ? { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
      });
      accepted.push(...(info.accepted ?? []).map(String)); rejected.push(...(info.rejected ?? []).map(String)); if (info.messageId) messageIds.push(info.messageId);
    }
    if (!accepted.length && rejected.length) throw new BillingError("SMTP 已连接，但服务商拒绝了全部收件人", 502, "SMTP_ALL_RECIPIENTS_REJECTED");
    return { messageId: messageIds.join(","), accepted, rejected };
  } finally { transport.close(); }
}

/** The sole non-marketing exception is this server-owned verification template.
 * Callers cannot supply a subject, body or a destination different from the challenge. */
export async function sendConsentConfirmation(companyId: string, accountId: string, recipient: string, confirmationUrl: string) {
  const account = await getEmailAccount(companyId,accountId), credentials = await getEmailCredentials(companyId,accountId);
  if (!account || !credentials) throw new BillingError("订阅确认邮箱未配置",503,"SMTP_NOT_CONFIGURED");
  const transport = await transportFor(account,credentials);
  try {
    const result = await transport.sendMail({ from: account.email, to: recipient, subject: "请确认订阅营销邮件", text: `你申请订阅该工作区的营销邮件。请打开链接并点击确认（30 分钟有效）：\n${confirmationUrl}\n如果不是你本人申请，请忽略此邮件；不会自动订阅。` });
    if (!result.accepted?.length) throw new BillingError("确认邮件未被服务商接受",502,"CONSENT_DELIVERY_FAILED");
  } finally { transport.close(); }
}
