import { NextResponse } from "next/server";

export type BusinessErrorCode =
  | "UNAUTHORIZED"
  | "TENANT_CONTEXT_INVALID"
  | "DATABASE_NOT_CONFIGURED"
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_SCHEMA_OUTDATED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class BusinessError extends Error {
  constructor(
    public readonly code: BusinessErrorCode,
    message: string,
    public readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BusinessError";
  }
}

export function businessErrorResponse(error: unknown) {
  if (error instanceof BusinessError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { error: "服务暂时不可用，请稍后重试", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
