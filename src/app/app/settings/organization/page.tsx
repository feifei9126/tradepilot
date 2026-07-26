"use client";

import { useEffect, useState } from "react";
import { Building2, Copy, MailPlus, RefreshCw, ShieldCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Member = {
  companyId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
  status: "active" | "suspended";
};

type Invitation = {
  id: string;
  email: string;
  role: Member["role"];
  expiresAt: string;
  revokedAt?: string | null;
  acceptedAt?: string | null;
};

async function readResponse(response: Response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed");
  return payload;
}

export default function OrganizationSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("member");
  const [organizationName, setOrganizationName] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [memberResponse, invitationResponse] = await Promise.all([
        fetch("/api/organizations/members"),
        fetch("/api/organizations/invitations"),
      ]);
      const [memberPayload, invitationPayload] = await Promise.all([
        readResponse(memberResponse),
        readResponse(invitationResponse),
      ]);
      setMembers(memberPayload.members || []);
      setInvitations(invitationPayload.invitations || []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to load organization settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, []);

  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = await readResponse(await fetch("/api/organizations/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      }));
      setInviteToken(payload.rawToken || "");
      setEmail("");
      toast.success("Invitation created");
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to create invitation");
    } finally {
      setBusy(false);
    }
  }

  async function updateMember(member: Member, patch: Partial<Pick<Member, "role" | "status">>) {
    setBusy(true);
    try {
      await readResponse(await fetch("/api/organizations/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, ...patch }),
      }));
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to update member");
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvitation(id: string) {
    setBusy(true);
    try {
      await readResponse(await fetch(`/api/organizations/invitations?id=${encodeURIComponent(id)}`, { method: "DELETE" }));
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to revoke invitation");
    } finally {
      setBusy(false);
    }
  }

  async function createOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await readResponse(await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: organizationName }),
      }));
      setOrganizationName("");
      toast.success("Workspace created");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to create workspace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="page-kicker">WORKSPACE / MEMBERS</p>
          <h1>Workspace and members</h1>
          <p className="page-description">Manage organization access, invitations, and active workspaces.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || busy}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-primary" /> Members</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {members.map((member) => (
              <div key={member.userId} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto] sm:items-center">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{member.userId}</p><p className="text-xs text-muted-foreground">{member.status === "active" ? "Active access" : "Suspended access"}</p></div>
                <select aria-label={`Role for ${member.userId}`} className="h-8 rounded-md border bg-background px-2 text-xs" value={member.role} disabled={busy} onChange={(event) => void updateMember(member, { role: event.target.value as Member["role"] })}><option value="owner">Owner</option><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select>
                <Badge variant={member.status === "active" ? "secondary" : "outline"}>{member.status}</Badge>
                <Button variant="ghost" size="icon" title={member.status === "active" ? "Suspend member" : "Activate member"} aria-label={member.status === "active" ? "Suspend member" : "Activate member"} disabled={busy} onClick={() => void updateMember(member, { status: member.status === "active" ? "suspended" : "active" })}><UserMinus className="size-4" /></Button>
              </div>
            ))}
            {!loading && members.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No members found.</p>}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><MailPlus className="size-4 text-primary" /> Invite member</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={inviteMember}>
                <div><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></div>
                <div><Label htmlFor="invite-role">Role</Label><select id="invite-role" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={role} onChange={(event) => setRole(event.target.value as Member["role"])}><option value="member">Member</option><option value="admin">Admin</option><option value="viewer">Viewer</option><option value="owner">Owner</option></select></div>
                <Button type="submit" className="w-full" disabled={busy}><MailPlus /> Create invitation</Button>
              </form>
              {inviteToken && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-medium">Copy this token to the invitee securely</p><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 break-all rounded bg-white p-2">{inviteToken}</code><Button type="button" variant="outline" size="icon" title="Copy invitation token" aria-label="Copy invitation token" onClick={() => void navigator.clipboard.writeText(inviteToken)}><Copy /></Button></div></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-4 text-primary" /> New workspace</CardTitle></CardHeader>
            <CardContent><form className="flex gap-2" onSubmit={createOrganization}><Input aria-label="Workspace name" required value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Company name" /><Button type="submit" size="icon" title="Create workspace" aria-label="Create workspace" disabled={busy}>+</Button></form><p className="mt-2 text-xs text-muted-foreground">Workspace creation requires PostgreSQL in production.</p></CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Invitations</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm"><span className="min-w-48 flex-1">{invitation.email}</span><Badge variant="outline">{invitation.role}</Badge><span className="text-xs text-muted-foreground">{invitation.acceptedAt ? "Accepted" : invitation.revokedAt ? "Revoked" : `Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}</span>{!invitation.acceptedAt && !invitation.revokedAt && <Button variant="ghost" size="sm" onClick={() => void revokeInvitation(invitation.id)} disabled={busy}>Revoke</Button>}</div>)}
          {!loading && invitations.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No invitations found.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
