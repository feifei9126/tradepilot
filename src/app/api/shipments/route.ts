import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { store, type StoredShipment } from "@/lib/store";
import { isValidIsoDate } from "@/lib/validation";

const METHODS = new Set<StoredShipment["method"]>(["sea", "air", "express"]);

export async function GET() {
  return NextResponse.json(store.shipments.list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const carrier = typeof body.carrier === "string" ? body.carrier.trim() : "";
  const referenceNo =
    typeof body.referenceNo === "string" ? body.referenceNo.trim() : "";
  const method = METHODS.has(body.method) ? body.method : "sea";
  const order = store.orders.get(orderId);

  if (!order)
    return NextResponse.json({ error: "请选择有效订单" }, { status: 400 });
  if (["cancelled", "completed"].includes(order.status)) {
    return NextResponse.json(
      { error: "已取消或已完成订单不能创建出货" },
      { status: 409 },
    );
  }
  if (
    store.shipments.list().some((shipment) => shipment.orderId === order.id)
  ) {
    return NextResponse.json({ error: "该订单已有出货记录" }, { status: 409 });
  }
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
  if (etd && eta && eta < etd) {
    return NextResponse.json(
      { error: "预计到港日期不能早于离港日期" },
      { status: 400 },
    );
  }

  const shipment: StoredShipment = {
    id: `sh_${randomUUID()}`,
    orderId: order.id,
    orderNo: order.no,
    customer: order.contactName,
    method,
    carrier,
    referenceNo,
    etd,
    eta,
    status: "booked",
    createdAt: new Date().toISOString(),
  };
  store.shipments.add(shipment);
  return NextResponse.json(shipment, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const shipment = store.shipments.get(id);
  if (!shipment) {
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
  if (statuses.indexOf(status) < statuses.indexOf(shipment.status)) {
    return NextResponse.json({ error: "出货状态不能回退" }, { status: 409 });
  }
  const order = store.orders.get(shipment.orderId);
  if (!order) {
    return NextResponse.json({ error: "关联订单不存在" }, { status: 409 });
  }
  if (order.status === "cancelled") {
    return NextResponse.json(
      { error: "已取消订单不能推进出货" },
      { status: 409 },
    );
  }

  const updated = store.shipments.update(id, { status });
  if (status === "departed" || status === "in_transit") {
    store.orders.update(shipment.orderId, {
      status: "shipped",
      progressPercent: 100,
    });
  } else if (status === "delivered") {
    store.orders.update(shipment.orderId, {
      status: "completed",
      progressPercent: 100,
    });
  }
  return NextResponse.json(updated);
}
