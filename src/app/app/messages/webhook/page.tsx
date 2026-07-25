"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Globe, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function WebhookPage() {
  const [url, setUrl] = useState("/api/webhook/incoming");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUrl(`${window.location.origin}/api/webhook/incoming`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Webhook URL 已复制");
    } catch {
      toast.error("复制失败，请手动选择 URL");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">消息接入配置</h1>
          <p className="text-sm text-muted-foreground">
            Webhook 接口，供外部服务推送消息
          </p>
        </div>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="bg-muted rounded-lg p-3">
            <code className="text-xs break-all">{url}</code>
          </div>
          <Button variant="outline" size="sm" onClick={copyUrl}>
            <Copy className="h-3.5 w-3.5 mr-1" />
            复制 Webhook URL
          </Button>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>
              1. 在部署环境配置{" "}
              <code className="font-mono">TRADEPILOT_WEBHOOK_SECRET</code>。
            </p>
            <p>
              2. 外部服务 POST JSON，并发送请求头{" "}
              <code className="font-mono">
                Authorization: Bearer &lt;secret&gt;
              </code>
              。
            </p>
            <p>
              3. 请求字段：<code className="font-mono">contactName</code>、
              <code className="font-mono">content</code>，可选{" "}
              <code className="font-mono">contactId</code>、
              <code className="font-mono">channel</code>。
            </p>
            <p>4. 消息存入消息中心后，可人工回复或使用已配置的 AI 生成回复。</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-dashed">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium">接入边界</h3>
            <p className="text-xs text-muted-foreground mt-1">
              当前版本只接收经过密钥鉴权的 Webhook
              消息，不内置浏览器插件、WhatsApp、微信或手机 App 同步服务。
            </p>
          </div>
        </CardContent>
      </Card>
      <Button
        render={<Link href="/app/settings" />}
        nativeButton={false}
        variant="outline"
        size="sm"
      >
        <Settings className="h-3.5 w-3.5 mr-1" />
        配置 AI 提供商
      </Button>
    </div>
  );
}
