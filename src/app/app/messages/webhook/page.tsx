"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Globe, Smartphone, Puzzle, Settings } from "lucide-react";
import Link from "next/link";

export default function WebhookPage() {
  const url = (typeof window !== "undefined" ? window.location.origin : "") + "/api/webhook/incoming";
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">消息接入配置</h1>
          <p className="text-sm text-muted-foreground">Webhook 接口，供外部服务推送消息</p>
        </div>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="bg-muted rounded-lg p-3"><code className="text-xs break-all">{url}</code></div>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("已复制"); }}>
            <Copy className="h-3.5 w-3.5 mr-1" />复制 Webhook URL
          </Button>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>1. 外部服务 POST 到此 URL → 消息自动存入消息中心</p>
            <p>2. 如客户启用了 AI 自动回复，自动生成回复并发出</p>
            <p>3. 在消息中心点击「AI 自动/手动」切换开关</p>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-dashed"><CardContent className="p-4 text-center"><Puzzle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" /><h3 className="text-sm font-medium">浏览器插件</h3><p className="text-xs text-muted-foreground mt-1">开发中 - 同步 WhatsApp Web 消息</p></CardContent></Card>
        <Card className="border-dashed"><CardContent className="p-4 text-center"><Smartphone className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" /><h3 className="text-sm font-medium">手机 App</h3><p className="text-xs text-muted-foreground mt-1">扫码绑定后自动同步消息</p></CardContent></Card>
      </div>
      <Link href="/app/settings"><Button variant="outline" size="sm"><Settings className="h-3.5 w-3.5 mr-1" />配置 AI 提供商</Button></Link>
    </div>
  );
}
