"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  Database,
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Headphones,
  LayoutDashboard,
  Mail,
  Menu,
  MessageSquare,
  MessageSquareQuote,
  Package,
  Puzzle,
  KeyRound,
  Settings as SettingsIcon,
  Ship,
  Target,
  Radar,
  Users,
  UserRound,
  UserCog,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSidebarConfig, DEFAULT_ORDER } from "@/lib/sidebar-config";
import { TradePilotBrand } from "@/components/tradepilot-brand";

type NavGroupId =
  | "overview"
  | "business"
  | "operations"
  | "growth"
  | "system"
  | "platform";

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  group: NavGroupId;
}

const navGroups: { id: NavGroupId; label: string }[] = [
  { id: "overview", label: "概览" },
  { id: "growth", label: "增长与内容" },
  { id: "business", label: "客户与交易" },
  { id: "operations", label: "订单履约" },
  { id: "system", label: "工作区设置" },
  { id: "platform", label: "平台管理 · 仅运营者" },
];

const allNavItems: NavItem[] = [
  {
    href: "/app/saas",
    labelKey: "nav.saas",
    icon: Building2,
    group: "platform",
  },
  {
    href: "/app/account",
    labelKey: "nav.account",
    icon: UserRound,
    group: "system",
  },
  { href: "/app/team", labelKey: "nav.team", icon: UserCog, group: "system" },
  {
    href: "/app/database",
    labelKey: "nav.database",
    icon: Database,
    group: "platform",
  },
  {
    href: "/app/billing",
    labelKey: "nav.billing",
    icon: DollarSign,
    group: "system",
  },
  {
    href: "/app/api-config",
    labelKey: "nav.api_config",
    icon: KeyRound,
    group: "platform",
  },
  {
    href: "/app/ai-usage",
    labelKey: "nav.ai_usage",
    icon: BarChart3,
    group: "system",
  },
  {
    href: "/app/voice-agent",
    labelKey: "nav.voice_agent",
    icon: Headphones,
    group: "growth",
  },
  {
    href: "/app",
    labelKey: "nav.workspace",
    icon: LayoutDashboard,
    group: "overview",
  },
  {
    href: "/app/contacts",
    labelKey: "nav.contacts",
    icon: Users,
    group: "business",
  },
  {
    href: "/app/inquiries",
    labelKey: "nav.inquiries",
    icon: MessageSquareQuote,
    group: "business",
  },
  {
    href: "/app/quotations",
    labelKey: "nav.quotations",
    icon: FileText,
    group: "business",
  },
  {
    href: "/app/orders",
    labelKey: "nav.orders",
    icon: ClipboardList,
    group: "business",
  },
  {
    href: "/app/suppliers",
    labelKey: "nav.suppliers",
    icon: Building2,
    group: "operations",
  },
  {
    href: "/app/shipments",
    labelKey: "nav.shipments",
    icon: Ship,
    group: "operations",
  },
  {
    href: "/app/logistics",
    labelKey: "nav.logistics",
    icon: Ship,
    group: "operations",
  },
  {
    href: "/app/finance",
    labelKey: "nav.finance",
    icon: DollarSign,
    group: "operations",
  },
  {
    href: "/app/documents",
    labelKey: "nav.documents",
    icon: FileText,
    group: "operations",
  },
  {
    href: "/app/products",
    labelKey: "nav.products",
    icon: Package,
    group: "growth",
  },
  {
    href: "/app/product-video",
    labelKey: "nav.product_video",
    icon: Video,
    group: "growth",
  },
  {
    href: "/app/leads",
    labelKey: "nav.leads",
    icon: Target,
    group: "growth",
  },
  {
    href: "/app/prospecting",
    labelKey: "nav.prospecting",
    icon: Radar,
    group: "growth",
  },
  {
    href: "/app/email",
    labelKey: "nav.email",
    icon: Mail,
    group: "growth",
  },
  {
    href: "/app/messages",
    labelKey: "nav.messages",
    icon: MessageSquare,
    group: "growth",
  },
  {
    href: "/app/reports",
    labelKey: "nav.reports",
    icon: BarChart3,
    group: "system",
  },
  {
    href: "/app/bind",
    labelKey: "nav.bind",
    icon: MessageSquare,
    group: "system",
  },
  {
    href: "/app/plugins",
    labelKey: "nav.plugins",
    icon: Puzzle,
    group: "system",
  },
  {
    href: "/app/email/settings",
    labelKey: "nav.email_settings",
    icon: SettingsIcon,
    group: "system",
  },
  {
    href: "/app/settings",
    labelKey: "nav.settings",
    icon: SettingsIcon,
    group: "system",
  },
];

function Brand() {
  const { t } = useTranslation();

  return (
    <Link href="/app" aria-label={`${t("app.name")} 工作台`}>
      <TradePilotBrand />
    </Link>
  );
}

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { order, hidden, loaded, toggleVisibility, moveUp, moveDown, reset } =
    useSidebarConfig(DEFAULT_ORDER);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const activeHref = allNavItems
    .filter(
      (item) =>
        pathname === item.href ||
        (item.href !== "/app" && pathname.startsWith(`${item.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const visibleItems = loaded
    ? (order
        .filter((href) => !hidden.includes(href))
        .map((href) => allNavItems.find((item) => item.href === href))
        .filter(Boolean) as NavItem[])
    : allNavItems;

  const navigation = (onNavigate?: () => void) =>
    navGroups.map((group) => {
      const items = visibleItems.filter((item) => {
        if (item.group !== group.id) return false;
        if (item.href === "/app/team")
          return (
            session?.user?.role === "owner" || session?.user?.role === "admin"
          );
        if (
          ["/app/database", "/app/saas", "/app/api-config"].includes(item.href)
        )
          return session?.user?.isPlatformAdmin === true;
        return true;
      });
      if (items.length === 0) return null;

      return (
        <div key={group.id} className="mb-3">
          <p
            className={cn(
              "sidebar-group-label",
              group.id === "platform" && "sidebar-platform-label",
            )}
          >
            {group.label}
          </p>
          <div className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === activeHref;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "sidebar-nav-item relative flex items-center gap-2.5 overflow-hidden px-3 text-xs",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {t(item.labelKey)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      );
    });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-2 top-2.5 z-50 md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="打开导航"
        title="打开导航"
      >
        <Menu />
      </Button>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="left-0 top-0 flex h-screen w-[min(18rem,calc(100vw-3rem))] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-r border-[#394b38] workspace-sidebar p-0 sm:max-w-none md:hidden">
          <DialogHeader className="flex workspace-brand-row h-[64px] shrink-0 justify-center border-b px-4 text-left">
            <DialogTitle>
              <Brand />
            </DialogTitle>
          </DialogHeader>
          <div className="px-3 pt-3">
            <div className="workspace-identity">
              <Building2 aria-hidden="true" />
              <span>
                <strong>
                  {session?.user?.isPlatformAdmin
                    ? "平台运营空间"
                    : "团队业务空间"}
                </strong>
                <small>
                  {session?.user?.isPlatformAdmin
                    ? "管理工作区与全局服务"
                    : "业务数据仅在本工作区可见"}
                </small>
              </span>
            </div>
          </div>
          <nav
            className="min-h-0 flex-1 overflow-y-auto p-3"
            aria-label="移动端主导航"
          >
            {navigation(() => setMobileOpen(false))}
          </nav>
        </DialogContent>
      </Dialog>

      <aside className="workspace-sidebar fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col md:flex">
        <div className="flex workspace-brand-row h-[64px] shrink-0 items-center border-b px-4">
          <Brand />
        </div>

        <div className="px-3 pt-3">
          <div className="workspace-identity">
            <Building2 aria-hidden="true" />
            <span>
              <strong>
                {session?.user?.isPlatformAdmin
                  ? "平台运营空间"
                  : "团队业务空间"}
              </strong>
              <small>
                {session?.user?.isPlatformAdmin
                  ? "管理工作区与全局服务"
                  : "业务数据仅在本工作区可见"}
              </small>
            </span>
          </div>
        </div>

        <nav
          className="min-h-0 flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:none]"
          aria-label="主导航"
        >
          {navigation()}
        </nav>

        <div className="shrink-0 border-t border-[#304133] p-3">
          <Dialog>
            <DialogTrigger className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-xs font-medium text-[#b4bea5] transition-colors hover:bg-[#263a2b] hover:text-white">
              <GripVertical className="size-3.5" />
              整理侧栏
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <GripVertical className="size-4 text-primary" />
                  侧栏定制
                </DialogTitle>
              </DialogHeader>
              <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                使用按钮调整菜单顺序，隐藏当前不需要的模块。
              </p>
              <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
                {order.map((href, index) => {
                  const item = allNavItems.find((entry) => entry.href === href);
                  if (
                    !item ||
                    (item.group === "platform" &&
                      session?.user?.isPlatformAdmin !== true) ||
                    (item.href === "/app/team" &&
                      !["owner", "admin"].includes(session?.user?.role || ""))
                  )
                    return null;
                  const Icon = item.icon;
                  const isHidden = hidden.includes(href);

                  return (
                    <div
                      key={href}
                      className={cn(
                        "flex min-h-10 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-muted/60",
                        isHidden && "opacity-45",
                      )}
                    >
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveUp(href)}
                          disabled={index === 0}
                          aria-label={`上移 ${t(item.labelKey)}`}
                          className="flex size-4 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20"
                        >
                          <ChevronUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(href)}
                          disabled={index === order.length - 1}
                          aria-label={`下移 ${t(item.labelKey)}`}
                          className="flex size-4 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20"
                        >
                          <ChevronDown className="size-3" />
                        </button>
                      </div>
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {t(item.labelKey)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleVisibility(href)}
                        aria-label={`${isHidden ? "显示" : "隐藏"} ${t(item.labelKey)}`}
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {isHidden ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <Button variant="outline" size="sm" onClick={reset}>
                  恢复默认
                </Button>
                <p className="text-xs text-muted-foreground">
                  {allNavItems.length - hidden.length}/{allNavItems.length}{" "}
                  项显示
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </aside>
    </>
  );
}
