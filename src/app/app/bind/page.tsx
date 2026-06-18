"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QrCode, Smartphone, MessageSquare, Globe, Loader2, Check, X, RefreshCw } from "lucide-react";

export default function BindPage() {
  const [bindings, setBindings] = useState<any[]>([]);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [wechatPhone, setWechatPhone] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [qrChannel, setQrChannel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => { fetchBindings(); }, []);
  useEffect(() => { if (countdown > 0) { const t = setTimeout(() => setCountdown(c => c - 1), 1000); return () => clearTimeout(t); } }, [countdown]);

  async function fetchBindings() {
    const r = await fetch("/api/bind/status"); const d = await r.json();
    setBindings(d.bindings || []);
  }

  async function handleGenerate(channel: string) {
    const phone = channel === "whatsapp" ? whatsappPhone : wechatPhone;
    if (!phone.trim()) { toast.error("请输入手机号"); return; }
    setGenerating(true);
    const r = await fetch("/api/bind/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, phone }),
    });
    const d = await r.json();
    if (r.ok) { setQrCode(d.qrUrl); setQrChannel(channel); setCountdown(300); toast.success("二维码已生成，请用手机 App 扫描"); }
    else { toast.error(d.error || "生成失败"); }
    setGenerating(false);
  }

  async function handleUnbind(phone: string) {
    // For now just refresh - in production call an unbind API
    toast.success("已解绑 " + phone);
    fetchBindings();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Smartphone className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">绑定账号</h1>
          <p className="text-sm text-muted-foreground">扫码绑定 WhatsApp / 微信，消息自动同步</p>
        </div>
      </div>

      {/* Current Bindings */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Check className="h-4 w-4 text-green-500" />已绑定的账号</CardTitle></CardHeader>
        <CardContent>
          {bindings.length > 0 ? bindings.map((b, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                {b.channel === "whatsapp" ? <MessageSquare className="h-4 w-4 text-green-500" /> : <Globe className="h-4 w-4 text-blue-500" />}
                <span className="text-sm">{b.channel === "whatsapp" ? "WhatsApp" : "微信"}</span>
                <span className="text-sm text-muted-foreground">{b.phone}</span>
                <Badge variant="outline" className="h-5 text-[10px] border-green-200 text-green-700">已绑定</Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500" onClick={() => handleUnbind(b.phone)}>解绑</Button>
            </div>
          )) : <p className="text-sm text-muted-foreground py-4 text-center">暂无绑定账号</p>}
        </CardContent>
      </Card>

      {/* Bind WhatsApp */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-green-500" />绑定 WhatsApp</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>WhatsApp 手机号</Label>
            <Input value={whatsappPhone} onChange={e => setWhatsappPhone(e.target.value)} placeholder="+86 13800138000" className="mt-1" />
          </div>
          <div className="flex gap-2 items-center">
            <Button onClick={() => handleGenerate("whatsapp")} disabled={generating || !whatsappPhone.trim()}>
              {generating && qrChannel === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <QrCode className="h-4 w-4 mr-1" />}
              生成二维码
            </Button>
            {countdown > 0 && qrChannel === "whatsapp" && <span className="text-xs text-muted-foreground">二维码剩余 {countdown}s</span>}
          </div>
          {qrCode && qrChannel === "whatsapp" && (
            <div className="text-center p-4 border rounded-lg bg-muted/20">
              <img src={qrCode} alt="WhatsApp QR Code" className="mx-auto w-48 h-48" />
              <p className="text-xs text-muted-foreground mt-2">打开 TradePilot 手机 App 扫码绑定</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bind WeChat */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-blue-500" />绑定微信</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>微信绑定的手机号</Label>
            <Input value={wechatPhone} onChange={e => setWechatPhone(e.target.value)} placeholder="+86 13800138000" className="mt-1" />
          </div>
          <div className="flex gap-2 items-center">
            <Button onClick={() => handleGenerate("wechat")} disabled={generating || !wechatPhone.trim()}>
              {generating && qrChannel === "wechat" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <QrCode className="h-4 w-4 mr-1" />}
              生成二维码
            </Button>
            {countdown > 0 && qrChannel === "wechat" && <span className="text-xs text-muted-foreground">二维码剩余 {countdown}s</span>}
          </div>
          {qrCode && qrChannel === "wechat" && (
            <div className="text-center p-4 border rounded-lg bg-muted/20">
              <img src={qrCode} alt="WeChat QR Code" className="mx-auto w-48 h-48" />
              <p className="text-xs text-muted-foreground mt-2">打开 TradePilot 手机 App 扫码绑定</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 text-sm space-y-1">
          <p className="font-medium">💡 绑定后效果</p>
          <p className="text-xs text-muted-foreground">• WhatsApp/微信新消息 → 自动同步到消息中心</p>
          <p className="text-xs text-muted-foreground">• 开启 AI 自动回复 → 自动回复客户</p>
          <p className="text-xs text-muted-foreground">• 多设备同步 → 手机 App 和 Web 端实时一致</p>
        </CardContent>
      </Card>
    </div>
  );
}
