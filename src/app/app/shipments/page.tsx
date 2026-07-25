"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Plus, Ship } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Order = { id: string; no: string; contactName: string; status: string };
type Shipment = {
  id: string;
  orderId: string;
  orderNo: string;
  customer: string;
  method: "sea" | "air" | "express";
  carrier: string;
  referenceNo: string;
  etd?: string;
  eta?: string;
  status: "booked" | "departed" | "in_transit" | "delivered";
  createdAt: string;
};

const EMPTY_FORM = {
  orderId: "",
  carrier: "",
  method: "sea",
  referenceNo: "",
  etd: "",
  eta: "",
};
const STATUS_LABEL: Record<Shipment["status"], string> = {
  booked: "已订舱",
  departed: "已离港",
  in_transit: "运输中",
  delivered: "已送达",
};
const STATUS_FLOW: Shipment["status"][] = [
  "booked",
  "departed",
  "in_transit",
  "delivered",
];
const METHOD_LABEL: Record<Shipment["method"], string> = {
  sea: "海运",
  air: "空运",
  express: "快递",
};

export default function ShipmentsPage() {
  const [shipOpen, setShipOpen] = useState(false);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [focusedShipmentId, setFocusedShipmentId] = useState<string | null>(
    null,
  );
  const [shipForm, setShipForm] = useState(EMPTY_FORM);
  const availableOrders = orders.filter(
    (order) =>
      !["cancelled", "completed"].includes(order.status) &&
      !shipments.some((shipment) => shipment.orderId === order.id),
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/shipments").then(async (response) => {
        if (!response.ok) throw new Error("出货数据加载失败");
        return response.json();
      }),
      fetch("/api/orders").then(async (response) => {
        if (!response.ok) throw new Error("订单数据加载失败");
        return response.json();
      }),
    ])
      .then(([shipmentData, orderData]) => {
        setShipments(shipmentData);
        setOrders(orderData);
        const requestedOrderId = new URLSearchParams(
          window.location.search,
        ).get("orderId");
        const requestedOrder = orderData.find(
          (order: Order) => order.id === requestedOrderId,
        );
        if (requestedOrderId && requestedOrder) {
          const existingShipment = shipmentData.find(
            (shipment: Shipment) => shipment.orderId === requestedOrderId,
          );
          if (existingShipment) {
            setFocusedShipmentId(existingShipment.id);
          } else if (
            ["cancelled", "completed"].includes(requestedOrder.status)
          ) {
            toast.error("已取消或已完成的订单不能创建出货");
          } else {
            setShipForm((current) => ({
              ...current,
              orderId: requestedOrderId,
            }));
            setShipOpen(true);
          }
        }
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "出货数据加载失败",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  async function createShipment() {
    if (
      !shipForm.orderId ||
      !shipForm.carrier.trim() ||
      !shipForm.referenceNo.trim()
    ) {
      toast.error("请选择订单并填写承运商和柜号/运单号");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shipForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "创建出货失败");
      setShipments((current) => [data, ...current]);
      setShipForm(EMPTY_FORM);
      setShipOpen(false);
      toast.success("出货已创建并加入物流列表");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "创建出货失败");
    } finally {
      setSaving(false);
    }
  }

  async function updateShipmentStatus(
    shipment: Shipment,
    status: Shipment["status"],
  ) {
    setUpdatingId(shipment.id);
    try {
      const response = await fetch("/api/shipments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shipment.id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "出货状态更新失败");
      setShipments((current) =>
        current.map((item) => (item.id === shipment.id ? data : item)),
      );
      toast.success("出货状态已更新");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "出货状态更新失败");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">出货</h1>
          <p className="mt-1 text-sm text-muted-foreground">物流和出货管理</p>
        </div>
        <Button
          onClick={() => setShipOpen(true)}
          disabled={!loading && availableOrders.length === 0}
          title={
            !loading && availableOrders.length === 0
              ? "所有订单都已有出货记录"
              : undefined
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          创建出货
        </Button>
      </div>

      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>创建出货</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium" htmlFor="shipment-order">
                关联订单
              </label>
              <select
                id="shipment-order"
                className="mt-1 w-full rounded-lg border bg-background p-2 text-sm"
                value={shipForm.orderId}
                onChange={(event) =>
                  setShipForm({ ...shipForm, orderId: event.target.value })
                }
              >
                <option value="">选择订单...</option>
                {availableOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.no} ({order.contactName})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="text-sm font-medium"
                  htmlFor="shipment-carrier"
                >
                  承运商
                </label>
                <input
                  id="shipment-carrier"
                  className="mt-1 w-full rounded-lg border bg-background p-2 text-sm"
                  value={shipForm.carrier}
                  onChange={(event) =>
                    setShipForm({ ...shipForm, carrier: event.target.value })
                  }
                />
              </div>
              <div>
                <label
                  className="text-sm font-medium"
                  htmlFor="shipment-method"
                >
                  运输方式
                </label>
                <select
                  id="shipment-method"
                  className="mt-1 w-full rounded-lg border bg-background p-2 text-sm"
                  value={shipForm.method}
                  onChange={(event) =>
                    setShipForm({ ...shipForm, method: event.target.value })
                  }
                >
                  <option value="sea">海运</option>
                  <option value="air">空运</option>
                  <option value="express">快递</option>
                </select>
              </div>
            </div>
            <div>
              <label
                className="text-sm font-medium"
                htmlFor="shipment-reference"
              >
                柜号 / 运单号
              </label>
              <input
                id="shipment-reference"
                className="mt-1 w-full rounded-lg border bg-background p-2 text-sm"
                placeholder="如: COSU1234567"
                value={shipForm.referenceNo}
                onChange={(event) =>
                  setShipForm({ ...shipForm, referenceNo: event.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium" htmlFor="shipment-etd">
                  预计离港
                </label>
                <input
                  id="shipment-etd"
                  type="date"
                  className="mt-1 w-full rounded-lg border bg-background p-2 text-sm"
                  value={shipForm.etd}
                  onChange={(event) =>
                    setShipForm({ ...shipForm, etd: event.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="shipment-eta">
                  预计到港
                </label>
                <input
                  id="shipment-eta"
                  type="date"
                  className="mt-1 w-full rounded-lg border bg-background p-2 text-sm"
                  value={shipForm.eta}
                  onChange={(event) =>
                    setShipForm({ ...shipForm, eta: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShipOpen(false)}
                disabled={saving}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={createShipment}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认创建
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          加载中...
        </div>
      ) : (
        <div className="space-y-3">
          {shipments.map((shipment) => (
            <Card
              key={shipment.id}
              className={
                focusedShipmentId === shipment.id
                  ? "border-primary bg-primary/5"
                  : undefined
              }
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Ship className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{shipment.orderNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {shipment.customer} · {shipment.carrier} ·{" "}
                      {METHOD_LABEL[shipment.method]} · {shipment.referenceNo}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {shipment.etd || shipment.createdAt?.slice(0, 10)}
                  </span>
                  {updatingId === shipment.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Select
                      value={shipment.status}
                      onValueChange={(value) =>
                        value &&
                        void updateShipmentStatus(
                          shipment,
                          value as Shipment["status"],
                        )
                      }
                    >
                      <SelectTrigger
                        className="h-8 w-28 text-xs"
                        aria-label={`${shipment.orderNo} 出货状态`}
                      >
                        <SelectValue>
                          {STATUS_LABEL[shipment.status]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([value, label]) => (
                          <SelectItem
                            key={value}
                            value={value}
                            disabled={
                              STATUS_FLOW.indexOf(value as Shipment["status"]) <
                              STATUS_FLOW.indexOf(shipment.status)
                            }
                          >
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Link
                    href={`/app/orders/${shipment.orderId}`}
                    aria-label={`查看订单 ${shipment.orderNo}`}
                    title="查看订单"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors hover:text-foreground" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
          {shipments.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              暂无出货记录
            </p>
          )}
        </div>
      )}
    </div>
  );
}
