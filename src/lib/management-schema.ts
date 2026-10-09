import { z } from "zod";

// Shared by HTTP handlers AND services: internal callers must not bypass input
// validation and create an owner/platform role or an invalid quota.
const memberRole = z.enum(["admin", "member"]);
const memberName = z.string().trim().min(1, "请填写姓名").max(100);
const email = z.string().trim().email("请填写有效邮箱").max(255).transform(value => value.toLowerCase());
export const memberIdSchema = z.string().uuid("成员 ID 格式不正确");
export const createMemberSchema = z.object({
  name: memberName, email, role: memberRole.default("member"),
}).strict();
export const updateMemberSchema = z.object({
  id: memberIdSchema, role: memberRole.optional(), isActive: z.boolean().optional(),
}).strict().refine(value => value.role !== undefined || value.isActive !== undefined, "至少提交一个需要修改的字段");
export const resetMemberSchema = z.object({ id: memberIdSchema }).strict();
const memberLimit = z.number().int().min(1).max(10000);
export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "标识只能包含小写英文、数字和短横线"),
  memberLimit: memberLimit.default(20), ownerName: memberName, ownerEmail: email,
}).strict();
export const updateWorkspaceSchema = z.object({
  id: z.string().uuid(), isActive: z.boolean().optional(), memberLimit: memberLimit.optional(),
}).strict().refine(value => value.isActive !== undefined || value.memberLimit !== undefined, "至少提交一个需要修改的字段");
