import { NextResponse } from "next/server";

import { companies, organizationMemberships } from "@/db/schema";
import { getDb } from "@/db";
import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { getOrganizationStore } from "@/lib/organizations/runtime";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET(request: Request) {
  try {
    const context = requireBusinessContext(request);
    const store = await getOrganizationStore();
    return NextResponse.json({
      organizations: await store.listOrganizationsForUser(context.userId),
      currentCompanyId: context.companyId,
    });
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = requireBusinessContext(request);
    const body = (await request.json()) as { name?: unknown; slug?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const baseSlug = slugify(
      typeof body.slug === "string" && body.slug.trim() ? body.slug : name,
    );
    if (!name || name.length > 120 || !baseSlug) {
      throw new BusinessError("VALIDATION_ERROR", "Organization name is invalid", 400);
    }
    const db = getDb();
    if (!db) {
      throw new BusinessError(
        "DATABASE_NOT_CONFIGURED",
        "Organization creation requires PostgreSQL",
        503,
      );
    }
    const created = await db.transaction(async (transaction) => {
      const [company] = await transaction
        .insert(companies)
        .values({ name, slug: baseSlug })
        .returning();
      if (!company) throw new Error("organization insert returned no row");
      await transaction.insert(organizationMemberships).values({
        companyId: company.id,
        userId: context.userId,
        role: "owner",
        status: "active",
        createdBy: context.userId,
      });
      return company;
    });
    return NextResponse.json(
      { organization: { companyId: created.id, name: created.name, slug: created.slug } },
      { status: 201 },
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      String(error.code) === "23505"
    ) {
      return businessErrorResponse(
        new BusinessError("SLUG_CONFLICT", "Organization slug is already used", 409),
      );
    }
    return businessErrorResponse(error);
  }
}
