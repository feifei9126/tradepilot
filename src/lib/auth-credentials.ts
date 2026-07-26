import { findUserByCredentials } from "@/lib/registration";
import {
  DEMO_COMPANY_ID,
  DEMO_USER_ID,
  resolveStorageMode,
} from "@/lib/business/runtime";

export const DEMO_EMAIL = "demo@tradepilot.dev";
export const DEMO_PASSWORD = "12345678";

export interface AuthorizedUser {
  id: string;
  email: string;
  name: string;
  companyId: string;
  role: string;
}

interface AuthorizationOptions {
  nodeEnv?: string;
  databaseUrl?: string;
}

function demoUser(): AuthorizedUser {
  return {
    id: DEMO_USER_ID,
    email: DEMO_EMAIL,
    name: "TradePilot Demo",
    companyId: DEMO_COMPANY_ID,
    role: "owner",
  };
}

export function matchesDemoCredentials(email: string, password: string) {
  return email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
}

export async function authorizeCredentials(
  email: string,
  password: string,
  options: AuthorizationOptions = {},
): Promise<AuthorizedUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const mode = resolveStorageMode({
    nodeEnv: options.nodeEnv ?? process.env.NODE_ENV,
    databaseUrl: options.databaseUrl ?? process.env.DATABASE_URL,
  });
  if (mode === "memory") {
    return matchesDemoCredentials(normalizedEmail, password) ? demoUser() : null;
  }
  return findUserByCredentials(normalizedEmail, password);
}
