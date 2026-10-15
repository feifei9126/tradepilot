import { randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { query, transaction, DatabaseUnavailableError } from "@/db";
import { hashPassword } from "@/lib/crypto";
import { createMemberSchema, updateMemberSchema, memberIdSchema } from "./management-schema";

export type WorkspaceRole = "owner" | "admin" | "member";
export type TeamActor = { id: string; companyId?: string; role?: string; isPlatformAdmin?: boolean; mustChangePassword?: boolean };
export class TeamError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const normalizedRole = (role: string | null | undefined): WorkspaceRole => role === "owner" || role === "admin" ? role : "member";
const memberColumns = "id,email,name,role,is_active AS \"isActive\",last_login_at AS \"lastLoginAt\",created_at AS \"createdAt\",(settings->>'mustChangePassword'='true') AS \"mustChangePassword\"";

async function withActor<T>(actor: TeamActor, fn: (client: PoolClient, companyId: string, role: WorkspaceRole, memberLimit: number) => Promise<T>) {
  if (!actor.id || actor.mustChangePassword) throw new TeamError("请先登录并修改临时密码", 403);
  if (actor.role !== "owner" && actor.role !== "admin") throw new TeamError("只有工作区所有者或管理员可以管理成员", 403);
  let companyId = actor.companyId;
  if (companyId === "deployment-workspace" && actor.isPlatformAdmin === true) {
    const result = await query("SELECT id FROM companies WHERE slug=$1", [process.env.TRADEPILOT_WORKSPACE_SLUG?.trim() || "tradepilot-admin"]);
    companyId = result.rows[0]?.id;
  }
  if (!companyId || !/^[0-9a-f-]{36}$/i.test(companyId)) throw new TeamError("工作区不存在，请先初始化数据库", 503);
  try {
    return await transaction(async client => {
      // Match CRM/platform lock ordering. Quotas and authorization are checked
      // again AFTER the lock, not using a stale role from the incoming JWT.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [companyId]);
      const result = await client.query("SELECT member_limit FROM companies WHERE id=$1 AND is_active=true FOR UPDATE", [companyId]);
      if (!result.rowCount) throw new TeamError("工作区已停用或不存在", 403);
      let role = normalizedRole(actor.role);
      if (actor.isPlatformAdmin !== true) {
        const current = await client.query("SELECT role,is_active,settings FROM users WHERE id=$1 AND company_id=$2 FOR UPDATE", [actor.id, companyId]);
        const user = current.rows[0];
        if (!user || user.is_active !== true || user.settings?.mustChangePassword === true || !["owner", "admin"].includes(user.role)) throw new TeamError("成员管理权限已失效，请重新登录", 403);
        role = normalizedRole(user.role);
      }
      return await fn(client, companyId!, role, result.rows[0].member_limit);
    });
  } catch (error) {
    if (error instanceof TeamError || error instanceof DatabaseUnavailableError) throw error;
    if ((error as { code?: string }).code === "23505") throw new TeamError("此邮箱已在系统中注册", 409);
    throw new TeamError("成员管理暂时不可用，请检查数据库连接和迁移", 503);
  }
}
export async function managementAudit(client: PoolClient, actorId: string, companyId: string, action: string, targetId: string, details: Record<string, unknown> = {}) {
  await client.query("INSERT INTO audit_events(company_id,actor_id,action,target_id,details) VALUES($1,$2,$3,$4,$5::jsonb)", [companyId, actorId, action, targetId, JSON.stringify(details)]);
}
export async function listWorkspaceMembers(actor: TeamActor) {
  return withActor(actor, async (client, companyId, _role, memberLimit) => {
    const rows = await client.query(`SELECT ${memberColumns} FROM users WHERE company_id=$1 ORDER BY created_at,id`, [companyId]);
    const members = rows.rows.map(row => ({ ...row, role: normalizedRole(row.role), mustChangePassword: row.mustChangePassword === true }));
    return { members, memberLimit, activeMemberCount: members.filter(member => member.isActive).length };
  });
}
export async function createWorkspaceMember(actor: TeamActor, input: { name: string; email: string; role?: "admin" | "member" }) {
  input = createMemberSchema.parse(input);
  const { name, email } = input;
  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  return withActor(actor, async (client, companyId, role, memberLimit) => {
    if (role === "admin" && input.role === "admin") throw new TeamError("管理员只能添加普通成员", 403);
    const count = await client.query("SELECT count(*)::int AS count FROM users WHERE company_id=$1 AND is_active=true", [companyId]);
    if (count.rows[0].count >= memberLimit) throw new TeamError(`工作区活跃成员已达到 ${memberLimit} 人上限，请联系平台管理员`, 409);
    const result = await client.query(`INSERT INTO users(company_id,email,name,role,settings) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING ${memberColumns}`, [companyId, email, name, input.role || "member", JSON.stringify({ passwordHash, sessionVersion: randomUUID(), mustChangePassword: true })]);
    const user = result.rows[0];
    await managementAudit(client, actor.id, companyId, "team.member.create", user.id, { role: user.role });
    return { user, temporaryPassword };
  });
}
function checkTarget(actor: TeamActor, role: WorkspaceRole, target: { id: string; role: string }, nextRole?: string) {
  if (target.role === "owner") throw new TeamError("所有者账号不能在团队管理中降权、停用或重置密码", 409);
  if (target.id === actor.id) throw new TeamError("不能在团队管理中更改自己的权限或密码，请使用个人中心", 409);
  if (role === "admin" && (target.role !== "member" || nextRole === "admin")) throw new TeamError("管理员只能管理普通成员", 403);
}
export async function updateWorkspaceMember(actor: TeamActor, input: { id: string; role?: "admin" | "member"; isActive?: boolean }) {
  input = updateMemberSchema.parse(input);
  return withActor(actor, async (client, companyId, role, memberLimit) => {
    const result = await client.query("SELECT * FROM users WHERE id=$1 AND company_id=$2 FOR UPDATE", [input.id, companyId]);
    const target = result.rows[0];
    if (!target) throw new TeamError("成员不存在", 404);
    checkTarget(actor, role, target, input.role);
    if (input.isActive === true && target.is_active !== true) {
      const count = await client.query("SELECT count(*)::int AS count FROM users WHERE company_id=$1 AND is_active=true", [companyId]);
      if (count.rows[0].count >= memberLimit) throw new TeamError("活跃成员数已达到上限，无法启用", 409);
    }
    const nextRole = input.role ?? normalizedRole(target.role);
    const nextActive = input.isActive ?? target.is_active;
    const updated = await client.query(`UPDATE users SET role=$3,is_active=$4,settings=$5::jsonb WHERE id=$1 AND company_id=$2 RETURNING ${memberColumns}`, [target.id, companyId, nextRole, nextActive, JSON.stringify({ ...target.settings, sessionVersion: randomUUID() })]);
    await managementAudit(client, actor.id, companyId, "team.member.update", target.id, { role: nextRole, isActive: nextActive });
    return updated.rows[0];
  });
}
export async function resetWorkspaceMemberPassword(actor: TeamActor, id: string) {
  id = memberIdSchema.parse(id);
  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  return withActor(actor, async (client, companyId, role) => {
    const result = await client.query("SELECT id,email,role,settings FROM users WHERE id=$1 AND company_id=$2 FOR UPDATE", [id, companyId]);
    const target = result.rows[0];
    if (!target) throw new TeamError("成员不存在", 404);
    checkTarget(actor, role, target);
    await client.query("UPDATE users SET settings=$3::jsonb WHERE id=$1 AND company_id=$2", [id, companyId, JSON.stringify({ ...target.settings, passwordHash, sessionVersion: randomUUID(), mustChangePassword: true })]);
    await managementAudit(client, actor.id, companyId, "team.member.password_reset", id);
    return { id, user: { id: target.id, email: target.email }, temporaryPassword };
  });
}
