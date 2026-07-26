import { BusinessError } from "@/lib/business/errors";
import {
  openSecret,
  sealSecret,
  type SealedSecret,
} from "@/lib/security/envelope";

import type { EmailAccount, EmailRepository } from "./types";
import { parseEmailAccountInput } from "./validation";
import { toEmailAccountView, type EmailAccountView } from "./views";

interface EmailActor {
  companyId: string;
  userId: string;
}

type CredentialsKey = string | Uint8Array;

function credentialAad(account: Pick<EmailAccount, "companyId" | "id">) {
  return {
    companyId: account.companyId,
    recordId: account.id,
    purpose: "email",
  } as const;
}

function parseSealedCredentials(value: string): SealedSecret {
  try {
    const parsed = JSON.parse(value) as SealedSecret;
    if (!parsed || parsed.version !== "v1") throw new Error("Invalid envelope");
    return parsed;
  } catch (error) {
    throw new BusinessError(
      "CREDENTIALS_DECRYPT_FAILED",
      "Credential decryption failed",
      500,
      error instanceof Error ? { cause: error } : undefined,
    );
  }
}

export function requireEmailCredentialsKey() {
  const key = process.env.TRADEPILOT_CREDENTIALS_KEY?.trim();
  if (!key) {
    throw new BusinessError(
      "CREDENTIALS_KEY_INVALID",
      "Credential encryption key is not configured",
      503,
    );
  }
  return key;
}

export async function openEmailAccountCredentials(
  account: EmailAccount,
  key: CredentialsKey,
): Promise<Record<string, string>> {
  if (!account.encryptedCredentials) {
    throw new BusinessError(
      "CREDENTIALS_DECRYPT_FAILED",
      "Credential decryption failed",
      500,
    );
  }
  const plaintext = await openSecret(
    parseSealedCredentials(account.encryptedCredentials),
    key,
    credentialAad(account),
  );
  try {
    const credentials = JSON.parse(plaintext) as Record<string, unknown>;
    if (
      !credentials ||
      typeof credentials !== "object" ||
      Array.isArray(credentials) ||
      Object.values(credentials).some((value) => typeof value !== "string")
    ) {
      throw new Error("Invalid credentials");
    }
    return credentials as Record<string, string>;
  } catch (error) {
    throw new BusinessError(
      "CREDENTIALS_DECRYPT_FAILED",
      "Credential decryption failed",
      500,
      error instanceof Error ? { cause: error } : undefined,
    );
  }
}

async function sealedCredentials(
  credentials: Record<string, string>,
  key: CredentialsKey,
  account: Pick<EmailAccount, "companyId" | "id">,
) {
  return JSON.stringify(
    await sealSecret(JSON.stringify(credentials), key, credentialAad(account)),
  );
}

export async function createEmailAccount(
  repository: EmailRepository,
  actor: EmailActor,
  input: unknown,
  key: CredentialsKey,
): Promise<EmailAccountView> {
  const parsed = parseEmailAccountInput(input);
  const now = new Date().toISOString();
  const accountId = crypto.randomUUID();
  const account: EmailAccount = {
    id: accountId,
    companyId: actor.companyId,
    name: parsed.name,
    email: parsed.email,
    provider: parsed.provider,
    smtpHost: parsed.smtpHost,
    smtpPort: parsed.smtpPort,
    smtpSecure: parsed.smtpSecure,
    imapHost: parsed.imapHost,
    imapPort: parsed.imapPort,
    imapSecure: parsed.imapSecure,
    imapMailbox: parsed.imapMailbox,
    encryptedCredentials: null,
    credentialsConfigured: true,
    status: parsed.status,
    healthStatus: "unknown",
    lastError: null,
    syncCursor: {},
    createdAt: now,
    updatedAt: now,
  };
  account.encryptedCredentials = await sealedCredentials(
    parsed.credentials,
    key,
    account,
  );
  return toEmailAccountView(await repository.createAccount(account));
}

export async function updateEmailAccount(
  repository: EmailRepository,
  actor: EmailActor,
  accountId: string,
  input: unknown,
  key: CredentialsKey,
): Promise<EmailAccountView> {
  const current = (await repository.listAccounts(actor.companyId))
    .find((account) => account.id === accountId);
  if (!current) {
    throw new BusinessError("NOT_FOUND", "Email account not found", 404);
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BusinessError("VALIDATION_ERROR", "Email account input is invalid", 400);
  }
  const patch = input as Record<string, unknown>;
  const currentCredentials = await openEmailAccountCredentials(current, key);
  const merged = {
    name: patch.name ?? current.name,
    email: patch.email ?? current.email,
    provider: patch.provider ?? current.provider,
    smtpHost: patch.smtpHost ?? current.smtpHost,
    smtpPort: patch.smtpPort ?? current.smtpPort,
    imapHost: patch.imapHost ?? current.imapHost,
    imapPort: patch.imapPort ?? current.imapPort,
    imapMailbox: patch.imapMailbox ?? current.imapMailbox,
    status: patch.status ?? current.status,
    credentials: {
      ...currentCredentials,
      ...(patch.credentials && typeof patch.credentials === "object" && !Array.isArray(patch.credentials)
        ? patch.credentials as Record<string, unknown>
        : {}),
    },
    ...(patch.username !== undefined ? { username: patch.username } : {}),
    ...(patch.password !== undefined ? { password: patch.password } : {}),
    ...(patch.apiKey !== undefined ? { apiKey: patch.apiKey } : {}),
  };
  const parsed = parseEmailAccountInput(merged);
  const encryptedCredentials = await sealedCredentials(parsed.credentials, key, current);
  const updated = await repository.updateAccount(actor.companyId, accountId, {
    name: parsed.name,
    email: parsed.email,
    provider: parsed.provider,
    smtpHost: parsed.smtpHost,
    smtpPort: parsed.smtpPort,
    smtpSecure: parsed.smtpSecure,
    imapHost: parsed.imapHost,
    imapPort: parsed.imapPort,
    imapSecure: parsed.imapSecure,
    imapMailbox: parsed.imapMailbox,
    encryptedCredentials,
    credentialsConfigured: true,
    status: parsed.status,
    healthStatus: "unknown",
    lastError: null,
  });
  if (!updated) throw new BusinessError("NOT_FOUND", "Email account not found", 404);
  return toEmailAccountView(updated);
}
