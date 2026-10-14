import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Radar, Sparkles, FileText } from "lucide-react";
import { TradePilotBrand } from "@/components/tradepilot-brand";
import type { ReactNode } from "react";

export function AuthScaffold({
  create = false,
  children,
}: {
  create?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="auth-shell">
      <aside className="auth-story">
        <Image
          src="/images/trade-harbor.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          aria-hidden="true"
          className="auth-story-photo"
        />
        <Link
          href="/"
          className="auth-story-brand"
          aria-label="返回 TradePilot 官网"
        >
          <TradePilotBrand />
        </Link>
        <div className="auth-story-content">
          <span className="auth-story-label">AI · CRM · TRADE</span>
          <h2>
            {create ? "你的下一段增长，" : "好生意，"}
            <br />
            {create ? "从这里起航。" : "值得用心跟进。"}
          </h2>
          <p>从发现潜在客户到每一次可靠交付，让线索、沟通与业务保持连接。</p>
          <ol className="auth-business-path">
            <li>
              <Radar aria-hidden="true" />
              发现客户
            </li>
            <li>
              <Sparkles aria-hidden="true" />
              准备沟通
            </li>
            <li>
              <FileText aria-hidden="true" />
              推进成交
            </li>
          </ol>
        </div>
        <div className="auth-story-footer">
          <span>TradePilot</span>
          <p>更少切换，更专注于生意。</p>
        </div>
      </aside>
      <section className="auth-main">
        <Link href="/" className="auth-back-link">
          <TradePilotBrand compact className="auth-mobile-brand" />
          <span className="auth-back-caption">
            <ArrowRight className="size-3.5 rotate-180" aria-hidden="true" />
            返回官网
          </span>
        </Link>
        <div className="auth-form-container">{children}</div>
        <p className="auth-footer-note">AI 辅助发现与表达，决策由你掌握。</p>
      </section>
    </main>
  );
}
