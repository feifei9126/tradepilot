import { NextResponse } from "next/server";

import { store, type StoredShipment } from "@/lib/store";

const MILESTONES = ["订舱", "工厂提货", "报关", "装船", "清关", "派送"] as const;

function completedMilestones(status: StoredShipment["status"]) {
  if (status === "delivered") return 6;
  if (status === "in_transit") return 4;
  if (status === "departed") return 4;
  return 1;
}

export async function GET() {
  const tracking = store.shipments.list().map(shipment => {
    const completed = completedMilestones(shipment.status);
    return {
      id: shipment.id,
      orderNo: shipment.orderNo,
      customer: shipment.customer,
      containerNo: shipment.referenceNo || "待补充",
      status: shipment.status === "delivered" ? "delivered" : shipment.status === "booked" ? "processing" : "in_transit",
      milestones: MILESTONES.map((name, index) => ({
        name,
        status: index < completed ? "done" : "pending",
        date: name === "装船" ? shipment.etd || null : name === "派送" && shipment.status === "delivered" ? shipment.eta || null : null,
        note: name === "订舱" ? `${shipment.carrier || "承运商待定"} · ${shipment.method}` : undefined,
      })),
    };
  });
  return NextResponse.json(tracking);
}
