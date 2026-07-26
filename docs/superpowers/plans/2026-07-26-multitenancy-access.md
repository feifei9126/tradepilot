# TradePilot 多租户与权限实现计划

> **面向 AI 代理的工作者：** 实现前先读取 `superpowers:executing-plans`，按本文件的复选框逐项执行。每个任务都遵循“失败测试 -> 看到预期失败 -> 最小实现 -> 通过测试 -> 独立提交”。

**目标：** 把单组织 `users.company_id` 升级为可加入多个组织的成员模型，提供邀请、角色权限和可信工作区切换，同时保持现有业务 API 的 `companyId` 租户隔离。

**架构：** PostgreSQL `organization_memberships` 是授权来源；JWT 只保存当前工作区选择。每个受保护请求在创建业务仓库前重新查询成员关系，数据库角色覆盖 JWT 角色。内存模式使用演示成员，不能发送真实邀请。

**技术栈：** Drizzle PostgreSQL、NextAuth 5 JWT、Next.js App Router Route Handlers、Zod、Node test + tsx。

---

### 任务 1：建立成员和邀请表的失败测试

**文件：**
- 创建：`tests/business/organization-access.test.ts`
- 创建：`tests/business/organization-invitations.test.ts`
- 修改：`tests/database/migrations.test.ts`

- [ ] **步骤 1：编写失败的角色矩阵测试**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { canPerformOrganizationAction } from "@/lib/organizations/permissions";

test("viewer cannot mutate business data while member can", () => {
  assert.equal(canPerformOrganizationAction("viewer", "business:write"), false);
  assert.equal(canPerformOrganizationAction("member", "business:write"), true);
});
```

- [ ] **步骤 2：运行测试确认是功能缺失**

运行：`npx tsx --test tests/business/organization-access.test.ts`

预期：FAIL，报 `Cannot find module '@/lib/organizations/permissions'`。

- [ ] **步骤 3：编写失败的邀请消费测试**

```ts
test("an invitation token is accepted once and then rejected", async () => {
  const invitation = await createInvitationFixture({ role: "member" });
  const accepted = await acceptInvitation(invitation.rawToken, invitation.email);
  assert.equal(accepted.membership.role, "member");
  await assert.rejects(
    acceptInvitation(invitation.rawToken, invitation.email),
    (error: unknown) => error instanceof BusinessError && error.code === "INVITATION_CONSUMED",
  );
});
```

- [ ] **步骤 4：运行邀请测试确认缺少实现**

运行：`npx tsx --test tests/business/organization-invitations.test.ts`

预期：FAIL，报缺少组织服务模块。

- [ ] **步骤 5：提交测试基线**

```bash
git add tests/business/organization-access.test.ts tests/business/organization-invitations.test.ts tests/database/migrations.test.ts
git commit -m "test(org): define membership and invitation behavior"
```

### 任务 2：实现组织 schema、迁移和内存成员仓库

**文件：**
- 创建：`src/db/schema/organization_memberships.ts`
- 创建：`src/db/schema/organization_invitations.ts`
- 修改：`src/db/schema/index.ts`
- 创建：`src/db/migrations/0001_organization_memberships.sql`
- 修改：`src/lib/business/errors.ts`
- 创建：`src/lib/organizations/types.ts`
- 创建：`src/lib/organizations/memory.ts`
- 修改：`scripts/db/migrate.mjs`

- [ ] **步骤 1：定义表和索引**

成员表使用 `(company_id, user_id)` 联合唯一索引，邀请表使用 `token_hash` 唯一索引，并为有效邀请建立 `company_id + lower(email)` 查询索引。角色和状态使用 varchar 配合 Zod 运行时枚举，避免 Drizzle enum 迁移难以兼容旧数据库。

- [ ] **步骤 2：写迁移回填逻辑**

迁移使用 `CREATE TABLE IF NOT EXISTS`，然后执行：

```sql
INSERT INTO organization_memberships (company_id, user_id, role, status)
SELECT company_id, id, COALESCE(role, 'member'), 'active'
FROM users
ON CONFLICT (company_id, user_id) DO NOTHING;
```

迁移不得删除或重建 `companies`、`users`，并为旧数据库补齐外键和时间戳。

- [ ] **步骤 3：实现内存成员仓库**

`createMemoryOrganizationStore()` 以 `companyId` 分区保存成员和邀请；邀请令牌只在返回值中保留原文，比较时使用哈希。内存演示初始化 `DEMO_USER_ID -> DEMO_COMPANY_ID` 的 owner 成员。

- [ ] **步骤 4：运行原有迁移与新增测试**

运行：`npx tsx --test tests/database/migrations.test.ts tests/business/organization-access.test.ts tests/business/organization-invitations.test.ts`

预期：迁移测试通过；权限测试仍可能因服务层未完成而失败，失败点必须集中在未实现的访问服务。

- [ ] **步骤 5：提交 schema 和迁移**

```bash
git add src/db/schema src/db/migrations/0001_organization_memberships.sql src/lib/organizations src/lib/business/errors.ts scripts/db/migrate.mjs
git commit -m "feat(org): add membership and invitation persistence"
```

### 任务 3：实现可信成员访问服务和加密封装

**文件：**
- 创建：`src/lib/organizations/permissions.ts`
- 创建：`src/lib/organizations/access.ts`
- 创建：`src/lib/organizations/postgres.ts`
- 创建：`src/lib/security/envelope.ts`
- 创建：`tests/business/secret-envelope.test.ts`
- 修改：`src/lib/business/context.ts`
- 修改：`src/lib/repositories/index.ts`
- 修改：`src/lib/repositories/memory.ts`

- [ ] **步骤 1：先写加密失败测试**

```ts
test("encrypted credentials require the same tenant AAD", async () => {
  const key = await createTestMasterKey();
  const sealed = await sealSecret("smtp-password", key, {
    companyId: COMPANY_A,
    recordId: ACCOUNT_ID,
    purpose: "email",
  });
  await assert.rejects(openSecret(sealed, key, {
    companyId: COMPANY_B,
    recordId: ACCOUNT_ID,
    purpose: "email",
  }));
  assert.equal(await openSecret(sealed, key, {
    companyId: COMPANY_A,
    recordId: ACCOUNT_ID,
    purpose: "email",
  }), "smtp-password");
});
```

- [ ] **步骤 2：运行并确认失败**

运行：`npx tsx --test tests/business/secret-envelope.test.ts`

预期：FAIL，报缺少 `sealSecret`。

- [ ] **步骤 3：实现 AES-256-GCM 封装**

`src/lib/security/envelope.ts` 使用 Web Crypto `subtle.encrypt/decrypt`，从 `TRADEPILOT_CREDENTIALS_KEY` 读取 32 字节 base64url key；密文结构保存 `version`, `iv`, `ciphertext`, `tag`，AAD 为 JSON 排序后的 `companyId`, `recordId`, `purpose`。密钥格式、长度和版本错误转换成 `CREDENTIALS_KEY_INVALID`，不把明文放入错误对象。

- [ ] **步骤 4：实现成员访问**

`requireOrganizationAccess(request, requestedCompanyId?)` 先读取可信 Auth.js 用户 ID，再查询 active membership；请求头中的 `x-tradepilot-company-id` 只作为已签发会话的选择，不能提升权限。`getBusinessRepository` 在 PostgreSQL 模式调用该访问服务并将数据库角色写入 `BusinessContext`。

- [ ] **步骤 5：运行绿色测试**

运行：`npx tsx --test tests/business/secret-envelope.test.ts tests/business/request-context.test.ts tests/business/organization-access.test.ts`

预期：全部 PASS，跨租户请求返回 `MEMBERSHIP_REQUIRED` 或 403。

- [ ] **步骤 6：提交访问服务**

```bash
git add src/lib/security src/lib/organizations src/lib/business/context.ts src/lib/repositories/index.ts src/lib/repositories/memory.ts tests/business/secret-envelope.test.ts tests/business/request-context.test.ts tests/business/organization-access.test.ts
git commit -m "feat(org): enforce membership access and secret encryption"
```

### 任务 4：实现邀请、成员管理和工作区切换 API

**文件：**
- 创建：`src/app/api/organizations/route.ts`
- 创建：`src/app/api/organizations/switch/route.ts`
- 创建：`src/app/api/organizations/members/route.ts`
- 创建：`src/app/api/organizations/invitations/route.ts`
- 创建：`src/app/api/invitations/accept/route.ts`
- 创建：`src/lib/organizations/service.ts`
- 修改：`src/lib/auth.ts`
- 修改：`src/lib/auth-config.ts`
- 修改：`src/middleware.ts`
- 创建：`tests/business/organization-routes.test.ts`

- [ ] **步骤 1：写 API 失败测试**

覆盖组织创建 slug 冲突、viewer 邀请被拒、最后 owner 不能停用、过期邀请 409、跨组织切换 403，以及切换成功后返回当前成员角色。

- [ ] **步骤 2：运行确认失败**

运行：`npx tsx --test tests/business/organization-routes.test.ts`

预期：FAIL，Route Handler 不存在或返回 404。

- [ ] **步骤 3：实现 service 事务**

组织创建在同一事务中写 `companies` 和 owner membership；邀请接受锁定邀请行并写成员关系；停用/角色变更锁定组织 owner 计数。每个操作把安全摘要写入 `activity_logs`。

- [ ] **步骤 4：实现 Auth.js 工作区切换**

从 `NextAuth` 导出更新会话的服务端能力；切换路由先调用 `getMembership`，再更新 JWT `companyId` 和 `role`。JWT 缺少 membership 时业务 API 返回 403，而不是回退演示租户。

- [ ] **步骤 5：运行绿色测试和类型检查**

运行：`npx tsx --test tests/business/organization-routes.test.ts tests/business/organization-invitations.test.ts && npx tsc --noEmit`

预期：PASS，类型检查退出码 0。

- [ ] **步骤 6：提交 API**

```bash
git add src/app/api/organizations src/app/api/invitations src/lib/organizations src/lib/auth.ts src/lib/auth-config.ts src/middleware.ts tests/business/organization-routes.test.ts
git commit -m "feat(org): add invitations membership management and switching"
```

### 任务 5：实现组织设置界面并回归业务隔离

**文件：**
- 创建：`src/app/app/settings/organization/page.tsx`
- 创建：`src/components/organization-switcher.tsx`
- 修改：`src/app/app/layout.tsx`
- 修改：`src/app/app/settings/page.tsx`
- 创建：`tests/product-video/organization-membership.test.ts`

- [ ] **步骤 1：编写切换器行为测试**

测试从 API 返回的组织列表渲染当前组织、切换失败保留原选择、成功后刷新 dashboard；演示模式显示固定演示组织但不展示真实邀请发送按钮。

- [ ] **步骤 2：实现最小 UI**

切换器通过 `/api/organizations` 加载，使用表单提交 `/api/organizations/switch`，成功后 `router.refresh()`。组织设置提供创建组织、成员列表、邀请邮箱/角色、撤销邀请、停用成员和角色变更；按钮调用已存在的 icon/button 组件。

- [ ] **步骤 3：运行 UI 相关测试和全量业务测试**

运行：`npx tsx --test tests/product-video/organization-membership.test.ts tests/business/*.test.ts`

预期：已有业务租户测试全部通过，两个演示组织的数据互不可见。

- [ ] **步骤 4：提交界面**

```bash
git add src/app/app/settings/organization src/components/organization-switcher.tsx src/app/app/layout.tsx src/app/app/settings/page.tsx tests/product-video/organization-membership.test.ts
git commit -m "feat(org): add workspace switcher and member settings"
```

### 任务 6：多租户阶段验收

- [ ] **步骤 1：运行数据库与覆盖率测试**

```bash
npm run test:db
npm run test:coverage
npx tsc --noEmit
```

- [ ] **步骤 2：检查迁移幂等和 diff**

```bash
npm run db:status
git diff HEAD~5 --check
git status --short
```

预期：迁移可重复执行，当前工作树只含计划中已提交内容。

- [ ] **步骤 3：提交阶段验收记录**

```bash
git commit --allow-empty -m "test(org): verify multi-tenant access phase"
```
