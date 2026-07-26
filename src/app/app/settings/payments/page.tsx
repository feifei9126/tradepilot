"use client";

import { useEffect, useState } from "react";
import { CreditCard, Pencil, Plus, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Provider = "stripe" | "alipay" | "wechat";

interface Account {
  id: string;
  provider: Provider;
  displayName: string;
  publicAccountId: string;
  credentialsConfigured: boolean;
  status: string;
  healthStatus: string;
}

const fields: Record<Provider, Array<{ key: string; label: string }>> = {
  stripe: [
    { key: "secretKey", label: "Secret key" },
    { key: "publishableKey", label: "Publishable key" },
    { key: "webhookSecret", label: "Webhook secret" },
  ],
  alipay: [
    { key: "appId", label: "App ID" },
    { key: "privateKey", label: "Application private key" },
    { key: "publicKey", label: "Alipay public key" },
  ],
  wechat: [
    { key: "mchId", label: "Merchant ID" },
    { key: "appId", label: "App ID" },
    { key: "serial", label: "Certificate serial" },
    { key: "privateKey", label: "Merchant private key" },
    { key: "platformPublicKey", label: "Platform public key" },
    { key: "apiV3Key", label: "API v3 key" },
  ],
};

const defaultDisplayName = (provider: Provider) =>
  provider === "stripe" ? "Stripe" : provider === "alipay" ? "Alipay" : "WeChat Pay";

async function requestAccounts() {
  const response = await fetch("/api/payment-accounts");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Payment accounts could not be loaded");
  return (data.accounts || []) as Account[];
}

export default function PaymentSettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>("stripe");
  const [displayName, setDisplayName] = useState(defaultDisplayName("stripe"));
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setAccounts(await requestAccounts());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment accounts could not be loaded");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void requestAccounts()
      .then((nextAccounts) => {
        if (!cancelled) setAccounts(nextAccounts);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Payment accounts could not be loaded");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setEditingId(null);
    setProvider("stripe");
    setDisplayName(defaultDisplayName("stripe"));
    setCredentials({});
  }

  function beginEdit(account: Account) {
    setEditingId(account.id);
    setProvider(account.provider);
    setDisplayName(account.displayName);
    setCredentials({});
  }

  async function save() {
    if (fields[provider].some((field) => !credentials[field.key]?.trim())) {
      toast.error("Enter every credential before saving");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/payment-accounts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), provider, displayName, credentials }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment account could not be saved");
      toast.success(editingId ? "Payment account updated" : "Payment account saved");
      resetForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment account could not be saved");
    } finally {
      setSaving(false);
    }
  }

  const complete = fields[provider].every((field) => credentials[field.key]?.trim());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <CreditCard className="size-6 text-primary" />
          Order payment settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure merchant accounts used only to collect order payments.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {accounts.length === 0 ? (
            <div className="border py-10 text-center text-sm text-muted-foreground">
              No payment account configured
            </div>
          ) : (
            accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{account.displayName}</p>
                    <p className="truncate text-xs uppercase text-muted-foreground">
                      {account.provider} · {account.publicAccountId}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-emerald-700">
                      {account.credentialsConfigured ? "Configured" : "Incomplete"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit account"
                      aria-label={`Edit ${account.displayName}`}
                      onClick={() => beginEdit(account)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
              {editingId ? "Edit account" : "Add account"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select
                value={provider}
                disabled={Boolean(editingId)}
                onValueChange={(value) => {
                  const next = value as Provider;
                  setProvider(next);
                  setDisplayName(defaultDisplayName(next));
                  setCredentials({});
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="alipay">Alipay</SelectItem>
                  <SelectItem value="wechat">WeChat Pay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </div>
            {fields[provider].map((field) => (
              <div className="space-y-1.5" key={field.key}>
                <Label>{field.label}</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={credentials[field.key] || ""}
                  onChange={(event) => setCredentials({ ...credentials, [field.key]: event.target.value })}
                />
              </div>
            ))}
            {editingId && (
              <p className="text-xs text-muted-foreground">
                Existing secrets are hidden. Re-enter every credential to update this account.
              </p>
            )}
            <div className="flex gap-2 pt-1">
              {editingId && (
                <Button variant="outline" className="flex-1" onClick={resetForm} disabled={saving}>
                  <X className="mr-1.5 size-4" />
                  Cancel
                </Button>
              )}
              <Button
                className="flex-1"
                onClick={save}
                disabled={saving || !displayName.trim() || !complete}
              >
                <ShieldCheck className="mr-2 size-4" />
                {editingId ? "Update encrypted credentials" : "Save encrypted credentials"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
