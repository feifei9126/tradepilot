import { NextRequest } from "next/server";

import type { BusinessContext } from "../../src/lib/business/context";
import {
  DEMO_COMPANY_ID,
  DEMO_USER_ID,
} from "../../src/lib/business/runtime";

export const demoBusinessContext: BusinessContext = {
  userId: DEMO_USER_ID,
  companyId: DEMO_COMPANY_ID,
  role: "owner",
};

type NextRequestInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]>;

export function businessRequest(
  url: string,
  init: NextRequestInit = {},
  context: BusinessContext = demoBusinessContext,
) {
  const headers = new Headers(init.headers);
  headers.set("x-tradepilot-user-id", context.userId);
  headers.set("x-tradepilot-company-id", context.companyId);
  headers.set("x-tradepilot-role", context.role);
  return new NextRequest(url, { ...init, headers });
}
