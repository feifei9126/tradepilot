import { randomBytes, randomUUID } from "node:crypto";
import { query, transaction, DatabaseUnavailableError } from "@/db";
import { hashPassword } from "./crypto";
import { createWorkspaceSchema, updateWorkspaceSchema } from "./management-schema";
import { managementAudit, TeamError, type TeamActor } from "./team";

function platform(actor: TeamActor) {
  if (!actor.id || actor.isPlatformAdmin !== true || actor.mustChangePassword) throw new TeamError("仅平台管理员可以管理 SaaS 工作区", 403);
}
async function guarded<T>(fn: () => Promise<T>) {
  try { return await fn(); }
  catch (error) {
    if (error instanceof TeamError || error instanceof DatabaseUnavailableError) throw error;
    if ((error as { code?: string }).code === "23505") throw new TeamError("工作区标识或邮箱已存在", 409);
    throw new TeamError("SaaS 管理暂时不可用，请确认数据库迁移已执行", 503);
  }
}
export async function listSaasWorkspaces(actor: TeamActor) {
  platform(actor);
  return guarded(async () => {
    const workspaces = await query(`SELECT c.id,c.name,c.slug,c.is_active AS "isActive",c.member_limit AS "memberLimit",c.created_at AS "createdAt",
      count(u.id)::int AS "memberCount", count(u.id) FILTER(WHERE u.is_active=true)::int AS "activeMemberCount"
      FROM companies c LEFT JOIN users u ON u.company_id=c.id GROUP BY c.id ORDER BY c.created_at DESC,c.id`);
    const audit = await query(`SELECT id,company_id AS "companyId",actor_id AS "actorId",action,target_id AS "targetId",details,created_at AS "createdAt"
      FROM audit_events WHERE action LIKE 'workspace.%' OR action LIKE 'team.%' ORDER BY created_at DESC,id DESC LIMIT 50`);
    return { workspaces: workspaces.rows, audit: audit.rows, registrationEnabled: false };
  });
}
export async function createSaasWorkspace(actor: TeamActor, input: { name: string; slug: string; memberLimit: number; ownerName: string; ownerEmail: string }) {
  platform(actor);
  input = createWorkspaceSchema.parse(input);
  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  return guarded(() => transaction(async client => {
    const company = await client.query("INSERT INTO companies(name,slug,member_limit) VALUES($1,$2,$3) RETURNING id,name,slug,member_limit AS \"memberLimit\",is_active AS \"isActive\"", [input.name, input.slug, input.memberLimit]);
    const workspace = company.rows[0];
    const result = await client.query("INSERT INTO users(company_id,email,name,role,settings) VALUES($1,$2,$3,'owner',$4::jsonb) RETURNING id,name,email,role", [workspace.id, input.ownerEmail.toLowerCase(), input.ownerName, JSON.stringify({ passwordHash, sessionVersion: randomUUID(), mustChangePassword: true })]);
    await managementAudit(client, actor.id, workspace.id, "workspace.create", workspace.id, { memberLimit: input.memberLimit });
    return { workspace, owner: result.rows[0], temporaryPassword };
  }));
}
export async function updateSaasWorkspace(actor: TeamActor, input: { id: string; isActive?: boolean; memberLimit?: number }) {
  platform(actor);
  input = updateWorkspaceSchema.parse(input);
  return guarded(() => transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.id]);
    const result = await client.query("SELECT * FROM companies WHERE id=$1 FOR UPDATE", [input.id]);
    const company = result.rows[0];
    if (!company) throw new TeamError("工作区不存在", 404);
    const deploymentSlug = process.env.TRADEPILOT_WORKSPACE_SLUG?.trim() || "tradepilot-admin";
    if (input.isActive === false && (company.slug === deploymentSlug || company.id === actor.companyId)) throw new TeamError("不能停用当前平台管理工作区", 409);
    const count = await client.query("SELECT count(*)::int AS count FROM users WHERE company_id=$1 AND is_active=true", [company.id]);
    if (input.memberLimit !== undefined && input.memberLimit < count.rows[0].count) throw new TeamError("成员上限不能低于当前活跃成员数，请先停用多余成员", 409);
    const isActive = input.isActive ?? company.is_active;
    const memberLimit = input.memberLimit ?? company.member_limit;
    const saved = await client.query("UPDATE companies SET is_active=$2,member_limit=$3,updated_at=now() WHERE id=$1 RETURNING id,name,slug,is_active AS \"isActive\",member_limit AS \"memberLimit\"", [company.id, isActive, memberLimit]);
    if (isActive !== company.is_active) {
      // Rotate on BOTH disable and re-enable: a previously issued session must
      // never become valid again merely because the workspace was re-enabled.
      await client.query("UPDATE users SET settings=coalesce(settings,'{}'::jsonb) || jsonb_build_object('sessionVersion',gen_random_uuid()::text) WHERE company_id=$1", [company.id]);
    }
    await managementAudit(client, actor.id, company.id, "workspace.update", company.id, { isActive, memberLimit });
    return saved.rows[0];
  }));
}
