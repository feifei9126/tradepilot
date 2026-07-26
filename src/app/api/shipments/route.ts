import { NextRequest, NextResponse } from "next/server";

import { requireBusinessContext } from "@/lib/business/context";
import { BusinessError, businessErrorResponse } from "@/lib/business/errors";
import { getBusinessRepository } from "@/lib/repositories";
import type { StoredShipment } from "@/lib/store";
import { isValidIsoDate } from "@/lib/validation";

const METHODS = new Set<StoredShipment["method"]>(["sea", "air", "express"]);

export async function GET(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    return NextResponse.json(await repository.shipments.list());
  } catch (error) {
    return businessErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const body = await req.json();
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const carrier = typeof body.carrier === "string" ? body.carrier.trim() : "";
    const referenceNo =
      typeof body.referenceNo === "string" ? body.referenceNo.trim() : "";
    const method = METHODS.has(body.method) ? body.method : "sea";
    if (!orderId)
      return NextResponse.json({ error: "请选择有效订单" }, { status: 400 });
    if (!carrier || !referenceNo) {
      return NextResponse.json(
        { error: "承运商和柜号/运单号必填" },
        { status: 400 },
      );
    }
    if (carrier.length > 200 || referenceNo.length > 200) {
      return NextResponse.json(
        { error: "承运商或运单号超出长度限制" },
        { status: 413 },
      );
    }
    const etd = typeof body.etd === "string" ? body.etd.trim() : "";
    const eta = typeof body.eta === "string" ? body.eta.trim() : "";
    if (!isValidIsoDate(etd) || !isValidIsoDate(eta)) {
      return NextResponse.json(
        { error: "预计离港或到港日期格式无效" },
        { status: 400 },
      );
    }
    if (eta < etd) {
      return NextResponse.json(
        { error: "预计到港日期不能早于离港日期" },
        { status: 400 },
      );
    }
    const shipment = await repository.shipments.create({
      orderId,
      method,
      carrier,
      referenceNo,
      etd,
      eta,
    });
    return NextResponse.json(shipment, { status: 201 });
  } catch (error) {
    if (error instanceof BusinessError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "请选择有效订单" }, { status: 400 });
    }
    return businessErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const repository = await getBusinessRepository(requireBusinessContext(req));
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "出货记录不存在" }, { status: 404 });
    }
    const statuses: StoredShipment["status"][] = [
      "booked",
      "departed",
      "in_transit",
      "delivered",
    ];
    const status = statuses.includes(body.status) ? body.status : null;
    if (!status) {
      return NextResponse.json({ error: "出货状态无效" }, { status: 400 });
    }
    return NextResponse.json(await repository.shipments.advanceStatus(id, status));
  } catch (error) {
    return businessErrorResponse(error);
  }
}
