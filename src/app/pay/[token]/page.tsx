"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalQrCode } from "@/components/local-qr-code";

interface Payment { orderNo: string; merchantName: string; amountMinor: number; currency: string; description: string; expiresAt: string; providers: Array<"stripe" | "alipay" | "wechat">; status: string; }

export default function PublicPaymentPage() {
  const params = useParams<{ token: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [codeUrl, setCodeUrl] = useState("");
  useEffect(() => { fetch(`/api/public/payments/${params.token}`).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Payment link is unavailable"); setPayment(data.payment); }).catch((value) => setError(value instanceof Error ? value.message : "Payment link is unavailable")); }, [params.token]);
  async function pay(provider: string) { setBusy(provider); setError(""); try { const response = await fetch(`/api/public/payments/${params.token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, idempotencyKey: crypto.randomUUID() }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Payment could not be started"); if (data.attempt.paymentUrl) window.location.assign(data.attempt.paymentUrl); else if (data.attempt.codeUrl) setCodeUrl(data.attempt.codeUrl); } catch (value) { setError(value instanceof Error ? value.message : "Payment could not be started"); } finally { setBusy(null); } }
  if (error && !payment) return <main className="grid min-h-screen place-items-center bg-muted/30 p-4"><p className="text-sm text-destructive">{error}</p></main>;
  if (!payment) return <main className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin" /></main>;
  const amount = new Intl.NumberFormat(undefined, { style: "currency", currency: payment.currency }).format(payment.amountMinor / 100);
  return <main className="grid min-h-screen place-items-center bg-muted/30 p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="size-5 text-primary" />{payment.merchantName}</CardTitle></CardHeader><CardContent className="space-y-5"><div><p className="text-sm text-muted-foreground">Order {payment.orderNo}</p><p className="mt-2 text-3xl font-semibold">{amount}</p><p className="mt-1 text-sm text-muted-foreground">{payment.description}</p></div>{codeUrl ? <div className="border p-4 text-center"><LocalQrCode value={codeUrl} alt="WeChat Pay QR code" className="mx-auto size-48" /><p className="mt-2 text-xs text-muted-foreground">Scan with WeChat to pay</p></div> : <div className="space-y-2">{payment.providers.map((provider) => <Button key={provider} variant="outline" className="w-full justify-start" disabled={busy !== null} onClick={() => pay(provider)}>{busy === provider ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}{provider === "stripe" ? "Pay by card" : provider === "alipay" ? "Pay with Alipay" : "Pay with WeChat"}</Button>)}</div>}{error && <p className="text-sm text-destructive">{error}</p>}<p className="text-xs text-muted-foreground">Payment status is confirmed only after the payment provider webhook is verified.</p></CardContent></Card></main>;
}
