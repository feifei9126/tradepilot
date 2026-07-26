import { NextResponse } from "next/server";

import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { resolveStorageMode } from "@/lib/business/runtime";
import {
  authorizeEmailContext,
  getPostgresEmailRepository,
} from "@/lib/email/runtime";
import {
  createEmailAccount,
  requireEmailCredentialsKey,
  updateEmailAccount,
} from "@/lib/email/service";
import { parseEmailAccountInput } from "@/lib/email/validation";
import { toEmailAccountView } from "@/lib/email/views";

async function readJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    throw new BusinessError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
  }
}

function duplicateAccountError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    String(error.code) === "23505"
  ) {
    return new BusinessError("CONFLICT", "Email account already exists", 409);
  }
  return error;
}

export async function GET(request: Request) {
  try {
    const context = await authorizeEmailContext(
      requireBusinessContext(request),
      "email:use",
    );
    if (resolveStorageMode() === "memory") {
      return NextResponse.json({ accounts: [], mode: "local-draft" });
    }
    const accounts = await getPostgresEmailRepository().listAccounts(context.companyId);
    return NextResponse.json({
      accounts: accounts.map(toEmailAccountView),
      mode: "configured",
    });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await authorizeEmailContext(
      requireBusinessContext(request),
      "email:configure",
    );
    const body = await readJson(request);
    if (resolveStorageMode() === "memory") {
      parseEmailAccountInput(body);
      throw new BusinessError(
        "PROVIDER_NOT_CONFIGURED",
        "Email accounts require PostgreSQL; local mode only saves message drafts",
        503,
      );
    }
    const account = await createEmailAccount(
      getPostgresEmailRepository(),
      context,
      body,
      requireEmailCredentialsKey(),
    );
    return NextResponse.json({ ok: true, account, mode: "configured" }, { status: 201 });
  } catch (error) {
    return businessErrorResponse(duplicateAccountError(error));
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await authorizeEmailContext(
      requireBusinessContext(request),
      "email:configure",
    );
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BusinessError("VALIDATION_ERROR", "Email account input is invalid", 400);
    }
    const id = typeof (body as Record<string, unknown>).id === "string"
      ? (body as Record<string, unknown>).id as string
      : "";
    if (!id.trim() || id.length > 100) {
      throw new BusinessError("VALIDATION_ERROR", "Email account id is invalid", 400);
    }
    if (resolveStorageMode() === "memory") {
      throw new BusinessError(
        "PROVIDER_NOT_CONFIGURED",
        "Email accounts require PostgreSQL; local mode only saves message drafts",
        503,
      );
    }
    const account = await updateEmailAccount(
      getPostgresEmailRepository(),
      context,
      id.trim(),
      body,
      requireEmailCredentialsKey(),
    );
    return NextResponse.json({ ok: true, account, mode: "configured" });
  } catch (error) {
    return businessErrorResponse(duplicateAccountError(error));
  }
}
