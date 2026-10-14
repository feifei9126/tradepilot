"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  LogOut,
  Package,
  Plus,
  Search,
  Settings,
  UserRound,
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

const pageNames: Record<string, string> = {
  "/app": "工作台",
  "/app/prospecting": "AI 获客",
  "/app/leads": "AI 营销",
  "/app/contacts": "客户",
  "/app/products": "产品",
  "/app/product-video": "产品视频",
  "/app/inquiries": "询盘",
  "/app/quotations": "报价",
  "/app/orders": "订单",
  "/app/shipments": "出货",
  "/app/suppliers": "供应商",
  "/app/logistics": "物流",
  "/app/finance": "财务",
  "/app/documents": "单证",
  "/app/reports": "数据报表",
  "/app/account": "个人中心",
  "/app/team": "团队成员",
  "/app/billing": "订阅与计费",
  "/app/ai-usage": "AI 用量",
  "/app/saas": "SaaS 管理",
  "/app/database": "数据库管理",
  "/app/api-config": "API 配置中心",
  "/app/email": "邮件中心",
  "/app/messages": "消息",
  "/app/settings": "设置",
  "/app/voice-agent": "AI 语音客服",
  "/app/bind": "消息渠道",
  "/app/plugins": "插件源码",
};

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isPlatform = session?.user?.isPlatformAdmin === true;
  const pageName =
    pageNames[pathname] ||
    pageNames[
      Object.keys(pageNames)
        .filter((path) => path !== "/app" && pathname.startsWith(`${path}/`))
        .sort((a, b) => b.length - a.length)[0]
    ] ||
    "工作台";
  const quickLinks = [
    { href: "/app/contacts", label: "查找客户", icon: Users },
    { href: "/app/orders", label: "打开订单", icon: ClipboardList },
    { href: "/app/products", label: "管理产品", icon: Package },
    ...(isPlatform
      ? [{ href: "/app/product-video", label: "创建产品视频", icon: Video }]
      : []),
    {
      href: isPlatform ? "/app/api-config" : "/app/ai-usage",
      label: "配置 AI 提供商",
      icon: Settings,
    },
    { href: "/app/account", label: "个人中心", icon: UserRound },
  ];
  const filteredQuickLinks = quickLinks.filter((item) =>
    item.label.includes(query.trim()),
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
    <header className="workspace-header fixed left-0 right-0 top-0 z-30 flex h-[64px] items-center gap-4 border-b border-border px-3 pl-14 sm:px-6 sm:pl-16 md:left-[248px] md:pl-7">
      <div className="workspace-breadcrumb">
        <span>
          {isPlatform &&
          ["/app/saas", "/app/database", "/app/api-config"].includes(pathname)
            ? "平台管理"
            : "我的工作区"}
        </span>
        <ChevronRight className="hidden size-3 sm:block" aria-hidden="true" />
        <span>{pageName}</span>
      </div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
          <DialogTrigger
            className="workspace-search"
            aria-label="搜索功能，快捷键 Command 或 Control K"
          >
            <Search className="size-3.5" aria-hidden="true" />
            <span className="hidden lg:block">搜索功能与操作</span>
            <kbd className="hidden lg:block">⌘ K</kbd>
          </DialogTrigger>
          <DialogContent className="top-[18%] max-w-xl translate-y-0 p-0">
            <DialogHeader className="border-b p-5">
              <DialogTitle>快速打开</DialogTitle>
              <DialogDescription>
                输入功能名称，快速前往对应的业务模块。
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 pt-2">
              <label htmlFor="workspace-command" className="sr-only">
                搜索功能名称
              </label>
              <Input
                id="workspace-command"
                placeholder="例如：客户、订单、AI 配置"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-1 p-4 pt-2">
              {filteredQuickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setCommandOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm hover:bg-accent"
                >
                  <item.icon
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              ))}
              {!filteredQuickLinks.length && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  没有匹配的功能
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <Button
          render={<Link href="/app/inquiries/new" />}
          nativeButton={false}
          size="sm"
          className="hidden sm:inline-flex"
        >
          <Plus />
          新建询盘
        </Button>
        <Link
          href="/app"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="返回工作台查看待办"
          title="查看工作台待办"
        >
          <Bell className="size-4" />
        </Link>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <Link
          href="/app/account"
          aria-label="进入个人中心"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Avatar className="size-8 border border-border">
            <AvatarFallback className="bg-secondary text-xs font-semibold text-primary">
              {session?.user?.name?.charAt(0)?.toUpperCase() || "T"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-xs lg:block">
            {session?.user?.name || "我的账号"}
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
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
