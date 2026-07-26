import { NextRequest, NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/business/context";
import { businessErrorResponse } from "@/lib/business/errors";
import { getBusinessRepository } from "@/lib/repositories";

export async function GET(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const orderId = req.nextUrl.searchParams.get("orderId");
    return NextResponse.json(
      orderId
        ? await repository.documents.listByOrder(orderId)
        : await repository.documents.list(),
    );
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID必填" }, { status: 400 });
    const ok = await repository.documents.remove(id);
    if (ok) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  } catch (error: unknown) {
    return businessErrorResponse(error);
  }
}
