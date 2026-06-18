"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ship, Plus, ExternalLink } from "lucide-react";
import { useState } from "react";

const MOCK_SHIPMENTS = [
  { id: "1", orderNo: "ORD-2026-086", method: "sea", carrier: "COSCO", containerNo: "COSU1234567", etd: "2026-06-02", eta: "2026-06-20", status: "departed" },
  { id: "2", orderNo: "ORD-2026-085", method: "sea", carrier: "MSC", containerNo: "MSC9876543", etd: "2026-06-05", eta: "2026-06-22", status: "booked" },
  { id: "3", orderNo: "ORD-2026-084", method: "express", carrier: "DHL", trackingNo: "EX987654321CN", status: "in_transit" },
];

export default function ShipmentsPage() {
  const [shipOpen, setShipOpen] = useState(false);
  const [shipForm, setShipForm] = useState({ orderNo: "", carrier: "COSCO", method: "sea", containerNo: "", etd: "", eta: "" });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">出货</h1>
          <p className="text-sm text-muted-foreground mt-1">物流和出货管理</p>
        </div>
        <Button onClick={() => setShipOpen(true)}><Plus className="h-4 w-4 mr-2" /> 创建出货</Button>
      </div>

      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>创建出货</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">关联订单</label>
              <select className="w-full mt-1 rounded-lg border p-2 text-sm bg-background"
                value={shipForm.orderNo} onChange={(e) => setShipForm({...shipForm, orderNo: e.target.value})}>
                <option value="">选择订单...</option>
                <option value="ORD-2026-088">ORD-2026-088 (BestBuy Co.)</option>
                <option value="ORD-2026-089">ORD-2026-089 (EuroTech GmbH)</option>
                <option value="ORD-2026-090">ORD-2026-090 (Sakura Trading)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">承运商</label>
                <input className="w-full mt-1 rounded-lg border p-2 text-sm bg-background"
                  value={shipForm.carrier} onChange={(e) => setShipForm({...shipForm, carrier: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">运输方式</label>
                <select className="w-full mt-1 rounded-lg border p-2 text-sm bg-background"
                  value={shipForm.method} onChange={(e) => setShipForm({...shipForm, method: e.target.value})}>
                  <option value="sea">海运</option>
                  <option value="air">空运</option>
                  <option value="express">快递</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">柜号 / 运单号</label>
              <input className="w-full mt-1 rounded-lg border p-2 text-sm bg-background" placeholder="如: COSU1234567"
                value={shipForm.containerNo} onChange={(e) => setShipForm({...shipForm, containerNo: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">预计离港</label>
                <input type="date" className="w-full mt-1 rounded-lg border p-2 text-sm bg-background"
                  value={shipForm.etd} onChange={(e) => setShipForm({...shipForm, etd: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">预计到港</label>
                <input type="date" className="w-full mt-1 rounded-lg border p-2 text-sm bg-background"
                  value={shipForm.eta} onChange={(e) => setShipForm({...shipForm, eta: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShipOpen(false)}>取消</Button>
              <Button className="flex-1" onClick={() => { setShipOpen(false); toast.success("出货已创建"); }}>确认创建</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {MOCK_SHIPMENTS.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ship className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{s.orderNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.carrier} · {s.method === "sea" ? "海运 · " + s.containerNo : "快递 · " + s.trackingNo}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{s.etd || ""}</span>
                  <Badge variant="secondary">{s.status === "departed" ? "已离港" : s.status === "booked" ? "已订舱" : s.status === "in_transit" ? "运输中" : s.status === "delivered" ? "已送达" : s.status}</Badge>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
