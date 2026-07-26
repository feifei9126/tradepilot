export type EmailAddressInput = string | string[];

export interface SendEmailInput {
  from: string;
  to: EmailAddressInput;
  subject: string;
  html: string;
  text: string;
  cc?: EmailAddressInput;
  bcc?: EmailAddressInput;
  replyTo?: EmailAddressInput;
  idempotencyKey?: string;
}

export interface ProviderSendResult {
  externalId: string;
}

export interface EmailProviderAdapter {
  send(input: SendEmailInput): Promise<ProviderSendResult>;
}

export type ProviderFailureCode =
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_NETWORK_ERROR"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_INVALID_REQUEST"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_RESPONSE_INVALID";

export class ProviderSendError extends Error {
  readonly name = "ProviderSendError";

  constructor(
    public readonly code: ProviderFailureCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export { ProviderSendError as ProviderError };
export type { SendEmailInput as EmailSendInput };
