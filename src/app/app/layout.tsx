import Link from "next/link";
import { DatabaseZap, LogIn, RefreshCw } from "lucide-react";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { auth } from "@/lib/auth";
import {
  databaseHealthMessage,
  getDatabaseHealth,
} from "@/lib/database-health";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, health] = await Promise.all([auth(), getDatabaseHealth()]);
  if (!session?.user) redirect("/auth/login");
  if (health.status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fa] px-5 py-12">
        <section className="w-full max-w-xl rounded-md border bg-white p-6 shadow-sm sm:p-8">
          <span className="flex size-11 items-center justify-center rounded-md bg-[#fff3df] text-[#a45a12]">
            <DatabaseZap className="size-5" />
          </span>
          <p className="page-kicker mt-5">DATABASE SETUP</p>
          <h1 className="text-xl font-bold text-[#12202c]">
            后台暂时无法读取业务数据
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#637181]">
            {databaseHealthMessage(health)}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/app"
              className={buttonVariants({ variant: "default" })}
            >
              <RefreshCw className="size-4" />
              重新检查
            </a>
            <Link
              href="/auth/login"
              className={buttonVariants({ variant: "outline" })}
            >
              <LogIn className="size-4" />
              返回登录
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div data-tradepilot-app>
      <Sidebar />
      <Header />
      <main className="min-h-screen pt-[60px] md:pl-[248px]">
        <div className="app-content">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
