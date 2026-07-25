import Link from "next/link";
import { ArrowRight, Palette, Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ProductDesignPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-10">
      <div className="flex items-start gap-4 border-b pb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">产品设计工作室</h1>
            <Badge variant="outline">待接入</Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            当前仓库尚未配置商品图、翻译、规格书和目录生成服务，因此不会伪造生成结果。产品资料仍可在产品目录中维护。
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="space-y-3 border-l-2 border-primary/30 pl-4">
          <h2 className="text-sm font-medium">继续管理产品</h2>
          <p className="text-sm text-muted-foreground">维护产品文字、图片和视频素材，并通过 Firecrawl 导入网页产品资料。</p>
          <Button render={<Link href="/app/products" />} nativeButton={false} variant="outline">
            打开产品目录<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>
        <section className="space-y-3 border-l-2 border-border pl-4">
          <h2 className="text-sm font-medium">配置 AI 提供商</h2>
          <p className="text-sm text-muted-foreground">先配置真实 API 请求地址、模型映射和代理，再接入设计生成后端。</p>
          <Button render={<Link href="/app/settings" />} nativeButton={false} variant="outline">
            <Settings className="mr-2 h-4 w-4" />打开设置
          </Button>
        </section>
      </div>
    </div>
  );
}
