"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ClipboardList,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  LayoutDashboard,
  Mail,
  Menu,
  MessageSquare,
  MessageSquareQuote,
  Package,
  Puzzle,
  Settings as SettingsIcon,
  Ship,
  Smartphone,
  Target,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrganizationSwitcher } from "@/components/organization-switcher";
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
import { springs } from "@/lib/motion";

type NavGroupId = "overview" | "business" | "operations" | "growth" | "system";

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  group: NavGroupId;
  count?: string;
}

const navGroups: { id: NavGroupId; label: string }[] = [
  { id: "overview", label: "概览" },
  { id: "business", label: "业务" },
  { id: "operations", label: "履约" },
  { id: "growth", label: "增长" },
  { id: "system", label: "系统" },
];

const allNavItems: NavItem[] = [
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
    count: "4",
  },
  {
    href: "/app/quotations",
    labelKey: "nav.quotations",
    icon: FileText,
    group: "business",
    count: "3",
  },
  {
    href: "/app/orders",
    labelKey: "nav.orders",
    icon: ClipboardList,
    group: "business",
    count: "3",
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
    icon: Smartphone,
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
  {
    href: "/app/settings/organization",
    labelKey: "nav.settings",
    icon: Users,
    group: "system",
  },
];

function Brand() {
  const { t } = useTranslation();

  return (
    <Link href="/app" className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#2f77e5] text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/20%)]">
        <Ship className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-white">
          {t("app.name")}
        </span>
        <span className="mt-0.5 block text-[10px] font-semibold text-[#8194a7]">
          GLOBAL OPS
        </span>
      </span>
    </Link>
  );
}

export function Sidebar() {
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
      const items = visibleItems.filter((item) => item.group === group.id);
      if (items.length === 0) return null;

      return (
        <div key={group.id} className="mb-3">
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold text-[#718397]">
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
                  className={cn(
                    "relative flex min-h-9 items-center gap-2.5 overflow-hidden rounded-md px-3 text-xs font-medium transition-[color,background-color,transform] duration-200",
                    isActive
                      ? "bg-[#26394c] text-white"
                      : "text-[#aebdca] hover:translate-x-0.5 hover:bg-[#202e3a] hover:text-white",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-indicator"
                      className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[#4d91ff]"
                      transition={springs.snappy}
                    />
                  )}
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {t(item.labelKey)}
                  </span>
                  {item.count && (
                    <span className="min-w-5 rounded-sm bg-[#344657] px-1.5 py-0.5 text-center text-[10px] text-[#d6e0e9]">
                      {item.count}
                    </span>
                  )}
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
        <DialogContent className="left-0 top-0 flex h-screen w-[min(18rem,calc(100vw-3rem))] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-r border-[#344250] bg-[#17212b] p-0 text-white sm:max-w-none md:hidden">
          <DialogHeader className="flex h-[60px] shrink-0 justify-center border-b border-[#2d3945] px-4 text-left">
            <DialogTitle>
              <Brand />
            </DialogTitle>
          </DialogHeader>
          <div className="px-3 pt-3">
            <OrganizationSwitcher />
            <button
              type="button"
              className="hidden flex h-10 w-full items-center gap-2 rounded-md border border-[#344250] bg-[#202d39] px-3 text-xs text-[#e8eef5]"
            >
              <Building2 className="size-4" />
              <span className="flex-1 text-left">默认工作区</span>
              <ChevronsUpDown className="size-3.5 text-[#8194a7]" />
            </button>
          </div>
          <nav
            className="min-h-0 flex-1 overflow-y-auto p-3"
            aria-label="移动端主导航"
          >
            {navigation(() => setMobileOpen(false))}
          </nav>
        </DialogContent>
      </Dialog>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-[#17212b] text-white md:flex">
        <div className="flex h-[60px] shrink-0 items-center border-b border-[#2d3945] px-4">
          <Brand />
        </div>

        <div className="px-3 pt-3">
          <OrganizationSwitcher />
          <button
            type="button"
            className="hidden flex h-10 w-full items-center gap-2 rounded-md border border-[#344250] bg-[#202d39] px-3 text-xs text-[#e8eef5] transition-colors hover:bg-[#263746]"
          >
            <Building2 className="size-4" />
            <span className="flex-1 text-left">默认工作区</span>
            <ChevronsUpDown className="size-3.5 text-[#8194a7]" />
          </button>
        </div>

        <nav
          className="min-h-0 flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:none]"
          aria-label="主导航"
        >
          {navigation()}
        </nav>

        <div className="shrink-0 border-t border-[#2d3945] p-3">
          <Dialog>
            <DialogTrigger className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-xs font-medium text-[#93a4b5] transition-colors hover:bg-[#202e3a] hover:text-white">
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
                  if (!item) return null;
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
