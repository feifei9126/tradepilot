"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Globe,
  Loader2,
  MessageSquare,
  QrCode,
  Smartphone,
} from "lucide-react";
import type { StoredBinding } from "@/lib/store";

export default function BindPage() {
  const [bindings, setBindings] = useState<StoredBinding[]>([]);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [wechatPhone, setWechatPhone] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [bindToken, setBindToken] = useState("");
  const [qrChannel, setQrChannel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [countdown, setCountdown] = useState(0);

  async function fetchBindings() {
    try {
      const response = await fetch("/api/bind/status");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "绑定状态加载失败");
      setBindings(data.bindings || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "绑定状态加载失败");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchBindings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  async function handleGenerate(channel: string) {
    const phone = channel === "whatsapp" ? whatsappPhone : wechatPhone;
    if (!phone.trim()) {
      toast.error("请输入手机号");
      return;
    }
    setGenerating(true);
    setQrChannel(channel);
    try {
      const response = await fetch("/api/bind/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "二维码生成失败");
      setQrCode(data.qrUrl);
      setBindToken(data.token);
      setCountdown(
        Math.max(0, Math.round((data.expiresAt - Date.now()) / 1000)),
      );
      toast.success("接入二维码已生成");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "二维码生成失败");
    } finally {
      setGenerating(false);
    }
  }

  async function handleUnbind(phone: string) {
    try {
      const response = await fetch("/api/bind/status", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "解绑失败");
      setBindings((current) =>
        current.filter((binding) => binding.phone !== phone),
      );
      toast.success("已解绑 " + phone);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "解绑失败");
    }
  }

  async function copyBindToken() {
    try {
      await navigator.clipboard.writeText(bindToken);
      toast.success("绑定令牌已复制");
    } catch {
      toast.error("复制失败，请手动选择令牌");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Smartphone className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">消息接入登记</h1>
          <p className="text-sm text-muted-foreground">
            为自建接入端生成一次性登记令牌
          </p>
        </div>
      </div>

      {/* Current Bindings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            已登记的接入端
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bindings.length > 0 ? (
            bindings.map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  {b.channel === "whatsapp" ? (
                    <MessageSquare className="h-4 w-4 text-green-500" />
                  ) : (
                    <Globe className="h-4 w-4 text-blue-500" />
                  )}
                  <span className="text-sm">
                    {b.channel === "whatsapp" ? "WhatsApp" : "微信"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {b.phone}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-5 text-[10px] border-green-200 text-green-700"
                  >
                    已登记
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-500"
                  onClick={() => handleUnbind(b.phone)}
                >
                  移除
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              暂无已登记的接入端
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bind WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-500" />
            WhatsApp 接入标识
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>WhatsApp 手机号</Label>
            <Input
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+86 13800138000"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 items-center">
            <Button
              onClick={() => handleGenerate("whatsapp")}
              disabled={generating || !whatsappPhone.trim()}
            >
              {generating && qrChannel === "whatsapp" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <QrCode className="h-4 w-4 mr-1" />
              )}
              生成接入二维码
            </Button>
            {countdown > 0 && qrChannel === "whatsapp" && (
              <span className="text-xs text-muted-foreground">
                二维码剩余 {countdown}s
              </span>
            )}
          </div>
          {qrCode && qrChannel === "whatsapp" && (
            <div className="text-center p-4 border rounded-lg bg-muted/20">
              <img
                src={qrCode}
                alt="WhatsApp QR Code"
                className="mx-auto w-48 h-48"
              />
              <p className="text-xs text-muted-foreground mt-2">
                由自建客户端读取二维码，并向其中的确认地址提交令牌
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={bindToken}
                  readOnly
                  aria-label="WhatsApp 绑定令牌"
                  className="h-8 font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={copyBindToken}
                  aria-label="复制绑定令牌"
                >
                  <Copy />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bind WeChat */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-500" />
            微信接入标识
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>微信绑定的手机号</Label>
            <Input
              value={wechatPhone}
              onChange={(e) => setWechatPhone(e.target.value)}
              placeholder="+86 13800138000"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 items-center">
            <Button
              onClick={() => handleGenerate("wechat")}
              disabled={generating || !wechatPhone.trim()}
            >
              {generating && qrChannel === "wechat" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <QrCode className="h-4 w-4 mr-1" />
              )}
              生成接入二维码
            </Button>
            {countdown > 0 && qrChannel === "wechat" && (
              <span className="text-xs text-muted-foreground">
                二维码剩余 {countdown}s
              </span>
            )}
          </div>
          {qrCode && qrChannel === "wechat" && (
            <div className="text-center p-4 border rounded-lg bg-muted/20">
              <img
                src={qrCode}
                alt="WeChat QR Code"
                className="mx-auto w-48 h-48"
              />
              <p className="text-xs text-muted-foreground mt-2">
                由自建客户端读取二维码，并向其中的确认地址提交令牌
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={bindToken}
                  readOnly
                  aria-label="微信绑定令牌"
                  className="h-8 font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={copyBindToken}
                  aria-label="复制绑定令牌"
                >
                  <Copy />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 text-sm space-y-1">
          <p className="font-medium">当前能力范围</p>
          <p className="text-xs text-muted-foreground">
            此页面只生成和登记接入令牌，不包含 WhatsApp、微信或手机 App 连接器。
          </p>
          <p className="text-xs text-muted-foreground">
            外部系统需要自行完成平台授权，再通过消息 Webhook
            将内容写入消息中心。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
