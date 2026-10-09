"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Plan = { id: string; name: string; description: string; currency: string; monthlyPriceCents: number; annualPriceCents: number; monthlyRequestLimit: number; monthlyTokenLimit: number; maxMembers: number; features: Record<string, boolean> };
type Summary = { provider: string; providerConfigured: boolean; accountStatus: string; billingEmail: string | null; plan: Plan; subscription: { status: string; interval: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null; usage: { month: string; requests: number; tokens: number; requestLimit: number; tokenLimit: number }; availablePlans: Plan[] };

function money(cents: number, currency: string) { return cents === 0 ? "免费" : new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(cents / 100); }

export default function BillingPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/billing", { cache: "no-store" }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "加载失败"); setSummary(d); setEmail(d.billingEmail || ""); }).catch(e => setError(e instanceof Error ? e.message : "加载失败")).finally(() => setLoading(false)); }, []);
  async function subscribe(planId: string, interval: "month" | "year") {
    setCheckout(planId); setError("");
    try { const r = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "checkout", planId, interval, billingEmail: email }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "创建支付会话失败"); window.location.assign(d.checkoutUrl); } catch (e) { setError(e instanceof Error ? e.message : "创建支付会话失败"); setCheckout(""); }
  }
  if (loading) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />加载计费信息…</div>;
  if (!summary) return <div className="p-6 text-sm text-destructive">{error || "计费信息不可用"}</div>;
  return <div className="space-y-6 p-6 lg:p-8">
    <div><h1 className="text-2xl font-bold tracking-tight">订阅与计费</h1><p className="mt-1 text-sm text-muted-foreground">先查看用量，再选择套餐。未配置支付服务时不会伪造付款成功。</p></div>
    {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />当前套餐</CardTitle><CardDescription>{summary.subscription ? `状态：${summary.subscription.status}` : "当前使用免费试用套餐"}</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><div><div className="text-lg font-semibold">{summary.plan.name}</div><div className="text-sm text-muted-foreground">{summary.plan.description}</div></div><div className="text-sm">本月 AI 请求：<b>{summary.usage.requests.toLocaleString()}</b> / {summary.usage.requestLimit.toLocaleString()}<br />Token：<b>{summary.usage.tokens.toLocaleString()}</b> / {summary.usage.tokenLimit.toLocaleString()}</div><div className="text-sm text-muted-foreground">支付状态：{summary.providerConfigured ? summary.accountStatus : "未启用支付服务"}</div></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="size-5" />选择套餐</CardTitle><CardDescription>生产环境请配置 Stripe Price ID、Secret Key 和签名 Webhook 后再开放自助购买。</CardDescription></CardHeader><CardContent className="space-y-4"><label className="block text-sm font-medium">账单邮箱<Input className="mt-1 max-w-md" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="billing@example.com" /></label><div className="grid gap-4 md:grid-cols-3">{summary.availablePlans.map(plan => <div key={plan.id} className="rounded-lg border p-4"><div className="font-semibold">{plan.name}</div><p className="mt-1 min-h-10 text-xs text-muted-foreground">{plan.description}</p><div className="mt-3 text-lg font-bold">{money(plan.monthlyPriceCents, plan.currency)}<span className="text-xs font-normal text-muted-foreground"> / 月</span></div><div className="mt-1 text-xs text-muted-foreground">最多 {plan.maxMembers} 个成员 · {plan.monthlyRequestLimit.toLocaleString()} 次 AI 请求</div>{plan.id !== "free" && <Button className="mt-4 w-full" disabled={!email || checkout === plan.id} onClick={() => subscribe(plan.id, "month")}>{checkout === plan.id ? <Loader2 className="size-4 animate-spin" /> : "升级并支付"}</Button>}</div>)}</div></CardContent></Card>
  </div>;
}
