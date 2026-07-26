"use client";

import { Building2, ChevronsUpDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Organization = {
  companyId: string;
  name: string;
  slug: string;
  role: string;
  status: string;
};

export function OrganizationSwitcher({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/organizations")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load workspaces");
        if (!cancelled) {
          setOrganizations(payload.organizations || []);
          setCurrentCompanyId(payload.currentCompanyId || payload.organizations?.[0]?.companyId || "");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Unable to load workspaces");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChange(companyId: string) {
    if (!companyId || companyId === currentCompanyId) return;
    setSwitching(true);
    try {
      const response = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to switch workspace");
      setCurrentCompanyId(companyId);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to switch workspace");
    } finally {
      setSwitching(false);
    }
  }

  const current = organizations.find((organization) => organization.companyId === currentCompanyId);

  return (
    <label className={`relative flex h-10 w-full items-center gap-2 rounded-md border border-[#344250] bg-[#202d39] px-3 text-xs text-[#e8eef5] ${className}`}>
      <Building2 className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{loading ? "Loading workspace..." : current?.name || "Select workspace"}</span>
        {!loading && current && <span className="block truncate text-[10px] text-[#91a2b4]">{current.role}</span>}
      </span>
      {switching ? <Loader2 className="size-3.5 animate-spin text-[#91a2b4]" /> : <ChevronsUpDown className="size-3.5 shrink-0 text-[#8194a7]" />}
      <select
        aria-label="Select workspace"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={currentCompanyId}
        disabled={loading || switching || organizations.length < 2}
        onChange={(event) => void handleChange(event.target.value)}
      >
        {organizations.map((organization) => (
          <option key={organization.companyId} value={organization.companyId}>{organization.name}</option>
        ))}
      </select>
    </label>
  );
}
