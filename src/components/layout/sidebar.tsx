"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Package, MessageSquareQuote, MessageSquare,
  FileText, ClipboardList, Ship, Settings as SettingsIcon, Building2, Smartphone,
  Target, DollarSign, Mail, Puzzle, Eye, EyeOff, ChevronUp, ChevronDown, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSidebarConfig, DEFAULT_ORDER } from "@/lib/sidebar-config";

interface NavItem { href: string; labelKey: string; icon: any }

const allNavItems: NavItem[] = [
  { href: "/app", labelKey: "nav.workspace", icon: LayoutDashboard },
  { href: "/app/contacts", labelKey: "nav.contacts", icon: Users },
  { href: "/app/products", labelKey: "nav.products", icon: Package },
  { href: "/app/inquiries", labelKey: "nav.inquiries", icon: MessageSquareQuote },
  { href: "/app/quotations", labelKey: "nav.quotations", icon: FileText },
  { href: "/app/orders", labelKey: "nav.orders", icon: ClipboardList },
  { href: "/app/suppliers", labelKey: "nav.suppliers", icon: Building2 },
  { href: "/app/email", labelKey: "nav.email", icon: Mail },
  { href: "/app/email/settings", labelKey: "nav.email_settings", icon: SettingsIcon },
  { href: "/app/bind", labelKey: "nav.bind", icon: Smartphone },
  { href: "/app/messages", labelKey: "nav.messages", icon: MessageSquare },
  { href: "/app/leads", labelKey: "nav.leads", icon: Target },
  { href: "/app/shipments", labelKey: "nav.shipments", icon: Ship },
  { href: "/app/logistics", labelKey: "nav.logistics", icon: Ship },
  { href: "/app/finance", labelKey: "nav.finance", icon: DollarSign },
  { href: "/app/documents", labelKey: "nav.documents", icon: FileText },
  { href: "/app/plugins", labelKey: "nav.plugins", icon: Puzzle },
  { href: "/app/settings", labelKey: "nav.settings", icon: SettingsIcon },
];

function getIcon(href: string) {
  return allNavItems.find(i => i.href === href)?.icon || LayoutDashboard;
}

function getLabelKey(href: string) {
  return allNavItems.find(i => i.href === href)?.labelKey || "";
}

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { order, hidden, loaded, toggleVisibility, moveUp, moveDown, reset } = useSidebarConfig(DEFAULT_ORDER);

  // Build visible nav items in configured order
  const visibleItems = loaded
    ? order
        .filter(href => !hidden.includes(href))
        .map(href => allNavItems.find(i => i.href === href))
        .filter(Boolean) as NavItem[]
    : allNavItems;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-56 border-r bg-background flex flex-col">
      <div className="flex h-14 items-center border-b px-4 shrink-0">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Ship className="h-5 w-5 text-primary" />
          <span>{t("app.name")}</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto space-y-1 p-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 font-normal",
                  isActive && "font-medium"
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Customization Button */}
      <div className="border-t p-2 shrink-0">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-muted-foreground hover:text-foreground">
              <GripVertical className="h-3.5 w-3.5 mr-1.5" />
              整理侧栏
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-primary" />
                侧栏定制
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground -mt-2 mb-3">
              拖拽或使用按钮调整菜单顺序，关闭不需要的菜单项
            </p>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
              {order.map((href, idx) => {
                const item = allNavItems.find(i => i.href === href);
                if (!item) return null;
                const Icon = item.icon;
                const isHidden = hidden.includes(href);
                return (
                  <div
                    key={href}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${isHidden ? "opacity-40" : ""}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveUp(href)} disabled={idx === 0}
                        className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20">
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button onClick={() => moveDown(href)} disabled={idx === order.length - 1}
                        className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20">
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm">{t(item.labelKey)}</span>
                    <button onClick={() => toggleVisibility(href)}
                      className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                      {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between pt-2 border-t">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={reset}>
                恢复默认
              </Button>
              <p className="text-xs text-muted-foreground self-center">
                {allNavItems.length - hidden.length}/{allNavItems.length} 项显示
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </aside>
  );
}
