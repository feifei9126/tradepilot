import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  ServerCog,
  ShieldCheck,
  Ship,
  UserRoundCog,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen bg-[#f4f7fa] lg:grid-cols-[minmax(360px,42%)_1fr]">
      <section className="relative hidden overflow-hidden bg-[#17212b] p-10 text-white lg:flex lg:flex-col xl:p-14">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-[#2f77e5] shadow-[inset_0_0_0_1px_rgb(255_255_255/20%)]">
            <Ship className="size-5" />
          </span>
          <span>
            <strong className="block text-base">TradePilot</strong>
            <span className="mt-0.5 block text-[10px] font-semibold text-[#8194a7]">
              GLOBAL TRADE OS
            </span>
          </span>
        </Link>

        <div className="my-auto max-w-xl py-16">
          <p className="mb-3 text-xs font-semibold text-[#7fc8d4]">
            DEPLOYMENT CONTROL
          </p>
          <h1 className="max-w-lg text-[32px] font-bold leading-[1.25]">
            账号归部署实例管理，访问权限保持清晰。
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[#aebbc6]">
            当前开源版本面向自托管单工作区，管理员账号由环境变量提供，不开放公共注册入口。
          </p>

          <div className="mt-10 divide-y divide-[#344250] rounded-md border border-[#344250] bg-[#202d39] px-5">
            {[
              [ServerCog, "部署时配置", "管理员凭据来自服务端环境变量"],
              [ShieldCheck, "避免假注册", "不会创建无法登录的本地占位账号"],
              [UserRoundCog, "权限可扩展", "接入用户数据库后再开放团队注册"],
            ].map(([Icon, title, description]) => {
              const ItemIcon = Icon as typeof ServerCog;
              return (
                <div key={title as string} className="flex gap-3 py-4">
                  <ItemIcon className="mt-0.5 size-4 shrink-0 text-[#78cfb1]" />
                  <div>
                    <strong className="block text-sm">{title as string}</strong>
                    <span className="mt-1 block text-[11px] leading-5 text-[#8194a7]">
                      {description as string}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-[#718397]">
          开源 · 自部署 · 账号与数据由部署方掌控
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[430px]">
          <Link
            href="/"
            className="mb-10 flex items-center gap-2 text-sm font-medium text-[#637181] hover:text-[#12202c] lg:hidden"
          >
            <ArrowLeft className="size-4" />
            返回首页
          </Link>

          <div className="mb-8">
            <span className="flex size-11 items-center justify-center rounded-md bg-blue-50 text-[#1769e0]">
              <LockKeyhole className="size-5" />
            </span>
            <p className="mb-2 mt-6 text-xs font-semibold text-[#1769e0]">
              ACCOUNT ACCESS
            </p>
            <h2 className="text-2xl font-bold text-[#12202c]">
              账号由部署方管理
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#637181]">
              请使用部署 TradePilot
              时配置的管理员邮箱和密码登录。当前版本没有用户数据库，因此不提供会误导使用者的公开注册表单。
            </p>
          </div>

          <div className="mb-7 rounded-lg border border-[#dce3ea] bg-white p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#12805c]" />
              <div>
                <strong className="block text-sm">
                  本地演示账号已随部署提供
                </strong>
                <p className="mt-1 text-xs leading-5 text-[#637181]">
                  正式部署时，请在环境变量中设置独立管理员密码。
                </p>
              </div>
            </div>
          </div>

          <Button
            render={<Link href="/auth/login" />}
            nativeButton={false}
            size="lg"
            className="w-full"
          >
            返回安全登录
            <ArrowRight className="ml-auto" />
          </Button>
          <Button
            render={<Link href="/" />}
            nativeButton={false}
            variant="ghost"
            className="mt-3 w-full lg:flex"
          >
            查看产品首页
          </Button>
        </div>
      </section>
    </main>
  );
}
