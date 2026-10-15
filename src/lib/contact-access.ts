import { query } from "@/db";
import { CrmError } from "@/lib/crm-repository";
import type { StoredContact } from "@/lib/store";

export type ContactAccessWorkspace = {
  companyId: string;
  userId: string;
  role: string;
  teamId?: string;
};

const VISIBILITIES = ["private", "team", "workspace"] as const;
type Visibility = (typeof VISIBILITIES)[number];

function privileged(role: string) {
  return role === "owner" || role === "admin" || role === "platform-admin";
}

function validUserId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function validTeamId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,100}$/.test(value);
}

function parseVisibility(value: unknown): Visibility | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !(VISIBILITIES as readonly string[]).includes(value)) throw new CrmError("客户可见范围无效", 400);
  return value as Visibility;
}

async function loadActiveUser(companyId: string, userId: string) {
  if (!validUserId(userId)) throw new CrmError("客户负责人无效", 400);
  const result = await query("SELECT id,settings,is_active FROM users WHERE company_id=$1 AND id=$2", [companyId, userId]);
  const row = result.rows[0];
  if (!row || row.is_active !== true) throw new CrmError("客户负责人不属于当前工作区或已停用", 400);
  const settings = row.settings && typeof row.settings === "object" && !Array.isArray(row.settings) ? row.settings as Record<string, unknown> : {};
  return { id: String(row.id), teamId: typeof settings.teamId === "string" && validTeamId(settings.teamId) ? settings.teamId : undefined };
}

/**
 * Resolve the customer ACL fields before the CRM repository writes the JSON record.
 * Members may narrow their own records, but cannot transfer ownership or make a
 * private/team record workspace-visible. Owners/admins may assign an active user
 * in the same workspace and may choose a team/visibility explicitly.
 */
export async function resolveContactAccess(input: {
  workspace: ContactAccessWorkspace;
  body: Record<string, unknown>;
  existing?: StoredContact;
  create?: boolean;
}) {
  const { workspace, body, existing, create = false } = input;
  const isPrivileged = privileged(workspace.role);
  const requestedOwner = body.ownerUserId;
  const requestedVisibility = parseVisibility(body.visibility);
  const requestedTeam = body.teamId;

  if (requestedTeam !== undefined && requestedTeam !== null && !validTeamId(requestedTeam)) throw new CrmError("客户团队标识无效", 400);
  if (!isPrivileged && existing && (requestedOwner !== undefined || requestedVisibility !== undefined || requestedTeam !== undefined)) {
    // A member may manage the ACL only for their own contact. Legacy records
    // without ACL fields remain workspace-visible until an administrator assigns them.
    if (existing.ownerUserId !== workspace.userId || !existing.visibility) {
      throw new CrmError("只有客户负责人或工作区管理员可以修改客户权限", 403);
    }
    if (requestedVisibility === "workspace" && existing.visibility !== "workspace") {
      throw new CrmError("普通成员不能扩大客户可见范围", 403);
    }
    if (existing.visibility === "private" && requestedVisibility === "team") {
      throw new CrmError("普通成员不能把私有客户扩大为团队可见", 403);
    }
    if (requestedTeam !== undefined && requestedTeam !== existing.teamId) {
      throw new CrmError("普通成员不能转移客户团队", 403);
    }
  }
  if (!isPrivileged && requestedOwner !== undefined && requestedOwner !== workspace.userId) throw new CrmError("普通成员不能转移客户负责人", 403);
  if (!isPrivileged && requestedVisibility === "workspace" && existing?.visibility !== "workspace") throw new CrmError("普通成员不能把客户扩大为工作区可见", 403);
  if (!isPrivileged && requestedTeam !== undefined && requestedTeam !== workspace.teamId && requestedTeam !== existing?.teamId) throw new CrmError("普通成员不能转移客户团队", 403);

  const ownerUserId = requestedOwner === undefined ? (existing?.ownerUserId || workspace.userId) : String(requestedOwner);
  // The authenticated subject is already checked against the active user row
  // by withTenant/CrmRepository. Avoid an unnecessary SQL lookup for self-assignments
  // (also keeps the policy usable by isolated route unit fixtures).
  if (ownerUserId === workspace.userId) {
    const visibility = requestedVisibility || existing?.visibility || (create ? (isPrivileged ? "workspace" : workspace.teamId ? "team" : "private") : "workspace");
    const teamId = requestedTeam === undefined ? (existing?.teamId || workspace.teamId) : (requestedTeam ? String(requestedTeam) : undefined);
    if (visibility === "team" && teamId && !validTeamId(teamId)) throw new CrmError("客户团队标识无效", 400);
    return { ownerUserId, visibility, ...(teamId ? { teamId } : {}) } as Pick<StoredContact, "ownerUserId" | "visibility" | "teamId">;
  }

  if (!isPrivileged) throw new CrmError("普通成员不能转移客户负责人", 403);
  const owner = await loadActiveUser(workspace.companyId, ownerUserId);
  const visibility = requestedVisibility || existing?.visibility || (create ? "workspace" : "workspace");
  const teamId = requestedTeam === undefined ? (existing?.teamId || owner.teamId) : (requestedTeam ? String(requestedTeam) : undefined);
  if (visibility === "team" && !teamId) throw new CrmError("团队可见客户必须指定团队", 400);
  if (visibility === "team" && teamId && !validTeamId(teamId)) throw new CrmError("客户团队标识无效", 400);
  return { ownerUserId: owner.id, visibility, ...(teamId ? { teamId } : {}) } as Pick<StoredContact, "ownerUserId" | "visibility" | "teamId">;
}

export function isContactAccessField(value: string) {
  return value === "ownerUserId" || value === "visibility" || value === "teamId";
}
