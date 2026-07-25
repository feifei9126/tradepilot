"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import {
  Bell,
  ClipboardList,
  LogOut,
  Package,
  Plus,
  Search,
  Settings,
  Users,
  Video,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const quickLinks = [
  { href: "/app/contacts", label: "查找客户", icon: Users },
  { href: "/app/orders", label: "打开订单", icon: ClipboardList },
  { href: "/app/products", label: "管理产品", icon: Package },
  { href: "/app/product-video", label: "创建产品视频", icon: Video },
  { href: "/app/settings", label: "配置 AI 提供商", icon: Settings },
];

export function Header() {
  const { data: session } = useSession();
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredQuickLinks = quickLinks.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-[60px] items-center gap-3 border-b border-border bg-background/95 px-3 pl-14 shadow-[0_1px_0_rgb(18_32_44/2%)] backdrop-blur-md sm:px-6 sm:pl-16 md:left-[248px] md:pl-6">
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogTrigger className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-muted/35 text-muted-foreground transition-[border-color,background-color,box-shadow] hover:border-primary/35 hover:bg-background hover:text-foreground hover:shadow-sm sm:w-[min(420px,42vw)] sm:justify-start sm:gap-2 sm:px-3">
          <Search className="size-4 shrink-0" />
          <span className="hidden min-w-0 flex-1 truncate text-left text-xs sm:block">
            搜索客户、订单、产品或执行操作
          </span>
          <kbd className="hidden rounded-sm border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground lg:inline">
            ⌘ K
          </kbd>
        </DialogTrigger>
        <DialogContent className="top-[18%] max-w-xl translate-y-0 p-0">
          <DialogHeader className="border-b p-4 pb-3">
            <DialogTitle>全局命令</DialogTitle>
            <DialogDescription>
              快速打开业务模块；后续可继续接入订单、客户和产品全文搜索。
            </DialogDescription>
          </DialogHeader>
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="输入客户、订单号或操作名称"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="grid gap-1 p-3 pt-2">
            {filteredQuickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setCommandOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
            {filteredQuickLinks.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                没有匹配的快捷操作
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Button
          render={<Link href="/app/orders/new" />}
          nativeButton={false}
          size="sm"
          className="hidden sm:inline-flex"
        >
          <Plus />
          新建订单
        </Button>

        <Dialog>
          <DialogTrigger
            className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="查看通知"
            title="查看通知"
          >
            <Bell className="size-[18px]" />
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-destructive ring-2 ring-background" />
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>需要处理</DialogTitle>
              <DialogDescription>按业务风险排序的最新提醒。</DialogDescription>
            </DialogHeader>
            <div className="divide-y rounded-md border">
              <Link
                href="/app/orders"
                className="block px-3 py-3 hover:bg-muted/60"
              >
                <p className="text-sm font-semibold text-destructive">
                  订单 ORD-2026-089 已逾期
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  确认货代提柜时间并同步客户。
                </p>
              </Link>
              <Link
                href="/app/quotations"
                className="block px-3 py-3 hover:bg-muted/60"
              >
                <p className="text-sm font-semibold">3 份报价将在今天失效</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  优先跟进高意向客户。
                </p>
              </Link>
            </div>
          </DialogContent>
        </Dialog>

        <span className="hidden max-w-44 truncate text-xs text-muted-foreground lg:block">
          {session?.user?.email}
        </span>
        <Avatar className="size-8 border border-border">
          <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
            {session?.user?.name?.charAt(0)?.toUpperCase() || "T"}
          </AvatarFallback>
        </Avatar>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut()}
          aria-label="退出登录"
          title="退出登录"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
