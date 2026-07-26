import nodemailer from "tradepilot-nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { ProviderSendError, type EmailProviderAdapter, type ProviderSendResult, type SendEmailInput } from "./contracts";

type SmtpTransportFactory = (
  options: SMTPTransport.Options,
) => Transporter<SMTPTransport.SentMessageInfo, SMTPTransport.Options>;

export interface SmtpProviderOptions { host: string; port: number; secure: boolean; username: string; password: string; transportFactory?: SmtpTransportFactory; }

export class SmtpEmailProvider implements EmailProviderAdapter {
  constructor(private readonly options: SmtpProviderOptions) {}
  async send(input: SendEmailInput): Promise<ProviderSendResult> {
    const transportOptions: SMTPTransport.Options = { host: this.options.host, port: this.options.port, secure: this.options.secure, auth: { user: this.options.username, pass: this.options.password }, connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 };
    const transport = this.options.transportFactory
      ? this.options.transportFactory(transportOptions)
      : nodemailer.createTransport(transportOptions);
    try {
      const result = await transport.sendMail({ from: input.from, to: input.to, cc: input.cc, bcc: input.bcc, replyTo: input.replyTo, subject: input.subject, text: input.text, html: input.html || undefined, headers: input.idempotencyKey ? { "X-TradePilot-Idempotency-Key": input.idempotencyKey } : undefined });
      const externalId = String(result.messageId || "").trim();
      if (!externalId) throw new ProviderSendError("PROVIDER_RESPONSE_INVALID", "SMTP server returned no message id", false);
      return { externalId };
    } catch (error) {
      if (error instanceof ProviderSendError) throw error;
      const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
      if (code === "EAUTH") throw new ProviderSendError("PROVIDER_AUTH_FAILED", "SMTP authentication failed", false);
      if (["EENVELOPE", "EMESSAGE"].includes(code)) throw new ProviderSendError("PROVIDER_INVALID_REQUEST", "SMTP message was rejected", false);
      throw new ProviderSendError("PROVIDER_NETWORK_ERROR", "SMTP delivery failed", true);
    } finally {
      transport.close();
    }
  }
}

export function createSmtpProvider(options: SmtpProviderOptions) { return new SmtpEmailProvider(options); }
