"use client";

import { useEffect, useState } from "react";
import { CreditCard, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Provider = "stripe" | "alipay" | "wechat";
interface Account { id: string; provider: Provider; displayName: string; publicAccountId: string; credentialsConfigured: boolean; status: string; healthStatus: string; }

const fields: Record<Provider, Array<{ key: string; label: string }>> = {
  stripe: [{ key: "secretKey", label: "Secret key" }, { key: "publishableKey", label: "Publishable key" }, { key: "webhookSecret", label: "Webhook secret" }],
  alipay: [{ key: "appId", label: "App ID" }, { key: "privateKey", label: "Application private key" }, { key: "publicKey", label: "Alipay public key" }],
  wechat: [{ key: "mchId", label: "Merchant ID" }, { key: "appId", label: "App ID" }, { key: "serial", label: "Certificate serial" }, { key: "privateKey", label: "Merchant private key" }, { key: "platformPublicKey", label: "Platform public key" }, { key: "apiV3Key", label: "API v3 key" }],
};

export default function PaymentSettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [provider, setProvider] = useState<Provider>("stripe");
  const [displayName, setDisplayName] = useState("Stripe");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function load() { const response = await fetch("/api/payment-accounts"); const data = await response.json(); if (response.ok) setAccounts(data.accounts || []); else toast.error(data.error || "Payment accounts could not be loaded"); }
  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true);
    try { const response = await fetch("/api/payment-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, displayName, credentials }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Payment account could not be saved"); setCredentials({}); toast.success("Payment account saved"); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Payment account could not be saved"); } finally { setSaving(false); }
  }

  return <div className="space-y-5">
    <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><CreditCard className="size-6 text-primary" />Order payment settings</h1><p className="mt-1 text-sm text-muted-foreground">Configure merchant accounts used only to collect order payments.</p></div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">{accounts.length === 0 ? <div className="border py-10 text-center text-sm text-muted-foreground">No payment account configured</div> : accounts.map((account) => <Card key={account.id}><CardContent className="flex items-center justify-between p-4"><div><p className="font-medium">{account.displayName}</p><p className="text-xs uppercase text-muted-foreground">{account.provider} · {account.publicAccountId}</p></div><span className="text-xs text-emerald-700">{account.credentialsConfigured ? "Configured" : "Incomplete"}</span></CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4" />Add account</CardTitle></CardHeader><CardContent className="space-y-3"><div className="space-y-1.5"><Label>Provider</Label><Select value={provider} onValueChange={(value) => { const next = value as Provider; setProvider(next); setDisplayName(next === "stripe" ? "Stripe" : next === "alipay" ? "Alipay" : "WeChat Pay"); setCredentials({}); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stripe">Stripe</SelectItem><SelectItem value="alipay">Alipay</SelectItem><SelectItem value="wechat">WeChat Pay</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Display name</Label><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div>{fields[provider].map((field) => <div className="space-y-1.5" key={field.key}><Label>{field.label}</Label><Input type="password" autoComplete="new-password" value={credentials[field.key] || ""} onChange={(event) => setCredentials({ ...credentials, [field.key]: event.target.value })} /></div>)}<Button className="w-full" onClick={save} disabled={saving || !displayName.trim()}><ShieldCheck className="mr-2 size-4" />Save encrypted credentials</Button></CardContent></Card>
    </div>
  </div>;
}
