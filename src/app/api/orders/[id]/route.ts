import { NextRequest, NextResponse } from "next/server";
import { store, type StoredOrder } from "@/lib/store";
import { isValidIsoDate } from "@/lib/validation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = store.orders.get(id);
  if (!order) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = store.orders.get(id);
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404 });
  const body = await req.json();
  const patch: Partial<StoredOrder> = {};
  if (Array.isArray(body.comms)) {
    if (body.comms.length > 500)
      return NextResponse.json(
        { error: "沟通记录数量超出限制" },
        { status: 400 },
      );
    const comms = body.comms.map((entry: unknown) => {
      const item = entry as Record<string, unknown>;
      return {
        from:
          typeof item.from === "string" ? item.from.trim().slice(0, 100) : "",
        date: typeof item.date === "string" ? item.date.slice(0, 10) : "",
        channel:
          typeof item.channel === "string"
            ? item.channel.trim().slice(0, 80)
            : "",
        text:
          typeof item.text === "string"
            ? item.text.trim().slice(0, 20_000)
            : "",
      };
    });
    if (
      comms.some(
        (entry: {
          from: string;
          date: string;
          channel: string;
          text: string;
        }) => !entry.from || !entry.date || !entry.channel || !entry.text,
      )
    ) {
      return NextResponse.json({ error: "沟通记录格式无效" }, { status: 400 });
    }
    patch.comms = comms;
  }
  if (typeof body.deliveryDate === "string") {
    const deliveryDate = body.deliveryDate.trim();
    if (!isValidIsoDate(deliveryDate)) {
      return NextResponse.json({ error: "交付日期格式无效" }, { status: 400 });
    }
    patch.deliveryDate = deliveryDate;
  }
  if (Number.isFinite(Number(body.progressPercent))) {
    patch.progressPercent = Math.min(
      100,
      Math.max(0, Number(body.progressPercent)),
    );
  }
  if (
    [
      "confirmed",
      "in_production",
      "inspection",
      "ready",
      "shipped",
      "completed",
      "cancelled",
    ].includes(body.status)
  ) {
    patch.status = body.status;
  }
  const effectiveStatus = patch.status || existing.status;
  const minimumProgress: Record<string, number> = {
    in_production: 30,
    inspection: 70,
    ready: 90,
    shipped: 100,
    completed: 100,
  };
  const statusMinimum = minimumProgress[effectiveStatus];
  if (statusMinimum !== undefined) {
    patch.progressPercent = Math.max(
      patch.progressPercent ?? existing.progressPercent,
      statusMinimum,
    );
  }
  if (Object.keys(patch).length === 0)
    return NextResponse.json(
      { error: "没有可更新的订单字段" },
      { status: 400 },
    );
  const updated = store.orders.update(id, patch);
  if (!updated) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return NextResponse.json(updated);
}
