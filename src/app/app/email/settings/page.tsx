"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Mail, Pencil, Plus, Settings, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Provider = "smtp_imap" | "resend";

interface EmailAccountView {
  id: string;
  name: string;
  email: string;
  provider: Provider;
  smtpHost: string | null;
  smtpPort: number | null;
  imapHost: string | null;
  imapPort: number | null;
  imapMailbox: string | null;
  credentialsConfigured: boolean;
  status: "active" | "disabled";
  healthStatus: "unknown" | "healthy" | "error";
  lastError: string | null;
}

interface AccountForm {
  name: string;
  email: string;
  provider: Provider;
  smtpHost: string;
  smtpPort: string;
  imapHost: string;
  imapPort: string;
  imapMailbox: string;
  username: string;
  password: string;
  apiKey: string;
  webhookSecret: string;
}

const EMPTY_FORM: AccountForm = {
  name: "",
  email: "",
  provider: "smtp_imap",
  smtpHost: "",
  smtpPort: "465",
  imapHost: "",
  imapPort: "993",
  imapMailbox: "INBOX",
  username: "",
  password: "",
  apiKey: "",
  webhookSecret: "",
};

async function requestAccounts() {
  const response = await fetch("/api/email/accounts");
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.accounts)) {
    throw new Error(data.error || "Email accounts could not be loaded");
  }
  return data.accounts as EmailAccountView[];
}

export default function EmailSettingsPage() {
  const [accounts, setAccounts] = useState<EmailAccountView[]>([]);
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadAccounts() {
    setLoading(true);
    try {
      setAccounts(await requestAccounts());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email accounts could not be loaded");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void requestAccounts()
      .then((nextAccounts) => {
        if (!cancelled) setAccounts(nextAccounts);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Email accounts could not be loaded");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof AccountForm>(key: K, value: AccountForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function beginCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function beginEdit(account: EmailAccountView) {
    setEditingId(account.id);
    setForm({
      ...EMPTY_FORM,
      name: account.name,
      email: account.email,
      provider: account.provider,
      smtpHost: account.smtpHost || "",
      smtpPort: String(account.smtpPort || 465),
      imapHost: account.imapHost || "",
      imapPort: String(account.imapPort || 993),
      imapMailbox: account.imapMailbox || "INBOX",
      username: account.email,
    });
    setShowForm(true);
  }

  function requestBody() {
    const credentials = form.provider === "smtp_imap"
      ? Object.fromEntries(Object.entries({ username: form.username || form.email, password: form.password }).filter(([, value]) => value.trim()))
      : Object.fromEntries(Object.entries({ apiKey: form.apiKey, webhookSecret: form.webhookSecret }).filter(([, value]) => value.trim()));
    return form.provider === "smtp_imap"
      ? { name: form.name, email: form.email, provider: form.provider, smtpHost: form.smtpHost, smtpPort: Number(form.smtpPort), imapHost: form.imapHost, imapPort: Number(form.imapPort), imapMailbox: form.imapMailbox, credentials }
      : { name: form.name, email: form.email, provider: form.provider, credentials };
  }

  async function saveAccount() {
    if (!form.name.trim() || !form.email.trim()) return toast.error("Name and email are required");
    if (!editingId && form.provider === "smtp_imap" && (!form.smtpHost.trim() || !form.imapHost.trim() || !form.password)) return toast.error("SMTP, IMAP, and password are required");
    if (!editingId && form.provider === "resend" && !form.apiKey) return toast.error("Resend API key is required");
    setSaving(true);
    try {
      const response = await fetch("/api/email/accounts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), ...requestBody() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Email account could not be saved");
      toast.success(editingId ? "Email account updated" : "Email account added");
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadAccounts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email account could not be saved");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Link href="/app/email" className="mb-1 flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="size-4" />Back to email</Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Settings className="size-6 text-primary" />Email accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">SMTP/IMAP and Resend</p>
      </div>
      <Button size="sm" onClick={beginCreate} disabled={showForm}><Plus className="mr-1.5 size-4" />Add account</Button>
    </div>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p> : accounts.length === 0 ? <div className="border py-10 text-center text-sm text-muted-foreground">No email account configured</div> : accounts.map((account) => <Card key={account.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3"><div className="grid size-9 shrink-0 place-items-center bg-primary/10"><Mail className="size-4 text-primary" /></div><div className="min-w-0"><p className="truncate text-sm font-medium">{account.name}</p><p className="truncate text-xs text-muted-foreground">{account.email} - {account.provider === "resend" ? "Resend" : "SMTP/IMAP"}</p><div className="mt-1 flex gap-1.5"><Badge variant="secondary">{account.status}</Badge><Badge variant={account.healthStatus === "error" ? "destructive" : "outline"}>{account.healthStatus}</Badge></div></div></div>
            <Button variant="ghost" size="icon" title="Edit account" onClick={() => beginEdit(account)}><Pencil className="size-4" /></Button>
          </CardContent>
        </Card>)}
      </div>

      {showForm && <Card>
        <CardHeader><CardTitle className="text-base">{editingId ? "Edit account" : "Add account"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Provider</Label><Select value={form.provider} disabled={Boolean(editingId)} onValueChange={(value) => setForm({ ...EMPTY_FORM, provider: value as Provider })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="smtp_imap">SMTP / IMAP</SelectItem><SelectItem value="resend">Resend</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(event) => update("name", event.target.value)} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></div>
          {form.provider === "smtp_imap" ? <>
            <div className="grid grid-cols-[1fr_84px] gap-2"><div className="space-y-1.5"><Label>SMTP host</Label><Input value={form.smtpHost} onChange={(event) => update("smtpHost", event.target.value)} /></div><div className="space-y-1.5"><Label>Port</Label><Input inputMode="numeric" value={form.smtpPort} onChange={(event) => update("smtpPort", event.target.value)} /></div></div>
            <div className="grid grid-cols-[1fr_84px] gap-2"><div className="space-y-1.5"><Label>IMAP host</Label><Input value={form.imapHost} onChange={(event) => update("imapHost", event.target.value)} /></div><div className="space-y-1.5"><Label>Port</Label><Input inputMode="numeric" value={form.imapPort} onChange={(event) => update("imapPort", event.target.value)} /></div></div>
            <div className="space-y-1.5"><Label>Mailbox</Label><Input value={form.imapMailbox} onChange={(event) => update("imapMailbox", event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Username</Label><Input autoComplete="username" value={form.username} onChange={(event) => update("username", event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Password {editingId && "(leave blank to keep)"}</Label><Input type="password" autoComplete="new-password" value={form.password} onChange={(event) => update("password", event.target.value)} /></div>
          </> : <>
            <div className="space-y-1.5"><Label>API key {editingId && "(leave blank to keep)"}</Label><Input type="password" autoComplete="new-password" value={form.apiKey} onChange={(event) => update("apiKey", event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Webhook secret {editingId && "(leave blank to keep)"}</Label><Input type="password" autoComplete="new-password" value={form.webhookSecret} onChange={(event) => update("webhookSecret", event.target.value)} /></div>
          </>}
          <div className="flex gap-2 pt-1"><Button variant="outline" className="flex-1" onClick={() => setShowForm(false)} disabled={saving}><X className="mr-1.5 size-4" />Cancel</Button><Button className="flex-1" onClick={saveAccount} disabled={saving}><Check className="mr-1.5 size-4" />Save</Button></div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" />Credentials are encrypted before storage.</p>
        </CardContent>
      </Card>}
    </div>
  </div>;
}
