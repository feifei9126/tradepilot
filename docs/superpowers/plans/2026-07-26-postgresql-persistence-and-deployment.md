# TradePilot PostgreSQL 持久化与一键部署实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers-zh:executing-plans` 在当前隔离 worktree 中逐任务实施此计划。每一步使用复选框跟踪，严格执行红-绿-重构和阶段性 commit。

**目标：** 将客户、产品、询盘、报价、订单、物流和直接依赖的单据从进程内数组迁移到租户隔离的 PostgreSQL，同时保留本地零配置内存演示模式，并交付 Docker 一条命令部署和 Cloudflare 引导式部署。

**架构：** API 通过认证中间件写入的可信请求上下文获取真实 UUID `companyId`，再从统一工厂取得租户绑定的异步 `BusinessRepository`。开发环境无 `DATABASE_URL` 时选择内存实现；配置数据库或处于生产环境时选择基于 Drizzle + postgres.js 的 PostgreSQL 实现，生产缺库直接返回配置错误。数据库 schema、迁移、初始化、健康检查和部署脚本共享同一组运行模式与错误语义。

**技术栈：** Next.js 16、NextAuth 5、TypeScript、Drizzle ORM、postgres.js、PostgreSQL 17、Node Test Runner/TSX、Docker Compose、OpenNext、Wrangler。

**规格来源：** `docs/superpowers/specs/2026-07-26-postgresql-persistence-and-deployment-design.md`

**每次提交门槛：** 运行该任务列出的定向测试、`git diff --check`、`npm audit` 和 `npm audit --audit-level=critical`。完整 audit 中现有 high/moderate 风险要记录但不使用破坏性 `--force` 自动修复；critical 门槛必须退出码为 0。

---

## 文件结构

### 新建文件

- `src/lib/business/types.ts`：核心业务实体、输入 DTO 和仓库返回类型，解除 API 对 `store.ts` 类型的依赖。
- `src/lib/business/runtime.ts`：运行模式解析、开发演示 UUID 常量和生产数据库强制规则。
- `src/lib/business/errors.ts`：稳定领域错误码、HTTP 映射和安全错误响应。
- `src/lib/business/context.ts`：从可信内部请求头解析并验证用户/租户上下文。
- `src/lib/repositories/contracts.ts`：租户绑定的异步仓库接口。
- `src/lib/repositories/memory.ts`：按 `companyId` 分区的内存实现和开发演示种子。
- `src/lib/repositories/postgres/mappers.ts`：decimal、日期、JSON 和实体响应映射。
- `src/lib/repositories/postgres/contacts.ts`：客户、联系人和客户活动查询。
- `src/lib/repositories/postgres/products.ts`：产品与媒体查询。
- `src/lib/repositories/postgres/inquiries.ts`：询盘查询与状态更新。
- `src/lib/repositories/postgres/quotations.ts`：报价、原子编号和报价状态工作流。
- `src/lib/repositories/postgres/orders.ts`：报价转订单、订单状态和沟通记录。
- `src/lib/repositories/postgres/shipments.ts`：物流状态与订单联动事务。
- `src/lib/repositories/postgres/documents.ts`：单据生成状态、内容和订单关联。
- `src/lib/repositories/postgres/index.ts`：组合 PostgreSQL 仓库。
- `src/lib/repositories/index.ts`：按运行模式创建并缓存底层仓库，返回租户绑定实例。
- `src/lib/database-health.ts`：连接、迁移和管理员初始化状态检查。
- `src/lib/auth-credentials.ts`：可独立测试的开发演示/数据库账号认证策略。
- `src/app/api/health/route.ts`：公开且不泄密的健康端点。
- `src/db/schema/document_sequences.ts`：租户年度报价/订单序列表。
- `src/db/migrations/0000_business_persistence.sql`：兼容空库和旧 `companies/users` 数据库的正式迁移。
- `scripts/db/common.mjs`：数据库连接、环境校验和安全日志工具。
- `scripts/db/migrate.mjs`：应用已提交迁移。
- `scripts/db/status.mjs`：检查连接、schema 版本和 bootstrap 状态。
- `scripts/db/bootstrap.mjs`：幂等创建/更新管理员公司和 owner 用户。
- `scripts/db/seed.mjs`：显式开关控制的演示业务数据填充。
- `scripts/db/init.mjs`：串行执行 migrate、bootstrap、可选 seed。
- `scripts/setup-cloudflare.mjs`：Cloudflare 引导式配置、迁移、secret、部署和健康验证。
- `docker-compose.test.yml`：真实 PostgreSQL 集成测试实例。
- `tests/helpers/business-context.ts`：带内部认证头的 NextRequest 工厂。
- `tests/helpers/database.ts`：清理临时 schema、应用迁移和创建测试租户。
- `tests/business/runtime-mode.test.ts`：运行模式选择测试。
- `tests/business/request-context.test.ts`：内部头覆盖与 UUID 校验测试。
- `tests/repositories/memory-contract.test.ts`：内存仓库契约和租户隔离。
- `tests/repositories/contract.ts`：Memory/PostgreSQL 共用的仓库契约断言。
- `tests/repositories/postgres-contract.test.ts`：PostgreSQL 仓库契约。
- `tests/repositories/postgres-workflows.test.ts`：事务、并发编号和跨租户攻击测试。
- `tests/database/migrations.test.ts`：空库与旧账号库升级测试。
- `tests/database/bootstrap.test.ts`：管理员初始化幂等性测试。
- `tests/database/health.test.ts`：健康状态测试。
- `tests/deploy/docker-database.test.mjs`：Compose 数据库拓扑回归测试。
- `tests/deploy/cloudflare-setup.test.mjs`：引导脚本 secret 与 dry-run 回归测试。
- `src/lib/firecrawl/confirmation.ts`：签名并验证产品导入预览摘要。
- `tests/firecrawl/confirmation.test.ts`：预览篡改和签名过期测试。

### 主要修改文件

- `src/lib/store.ts`：改为导入/重导出核心类型，并提供只读演示业务快照；非本阶段模块继续保留现有存储。
- `src/db/index.ts`：统一 postgres.js/Drizzle 客户端，移除静默 `null` 降级。
- `src/db/schema/*.ts`：补齐 `company_id`、字段、复合外键、唯一索引和时间戳。
- `src/db/schema/index.ts`：导出序列表。
- `src/lib/auth.ts`、`src/lib/registration.ts`、`src/middleware.ts`：真实数据库账号、开发演示账号和可信租户头。
- `src/app/auth/login/page.tsx`、`src/app/app/layout.tsx`：显示数据库未配置、迁移过期或未 bootstrap 状态。
- `src/app/api/contacts/**`、`products/**`、`inquiries/**`、`quotations/**`、`orders/**`、`shipments/**`、`documents/**`：改用异步仓库。
- `src/app/api/dashboard/route.ts`、`finance/route.ts`、`logistics/route.ts`、`firecrawl/confirm/route.ts`、`product-videos/route.ts`：通过仓库读取核心实体。
- `package.json`、`package-lock.json`、`drizzle.config.ts`：增加 postgres.js 和数据库/部署/测试脚本。
- `Dockerfile`、`docker-compose.yml`、`install.sh`、`install.bat`、`.env.example`：生产数据库、迁移初始化和幂等安装。
- `README.md`、`ARCHITECTURE.md`：更新数据边界、升级流程和 Cloudflare/Docker 操作说明。

## 任务 1：运行模式、错误语义和可信租户上下文

**文件：**

- 创建：`src/lib/business/runtime.ts`
- 创建：`src/lib/business/errors.ts`
- 创建：`src/lib/business/context.ts`
- 修改：`src/middleware.ts`
- 修改：`src/types/next-auth.d.ts`
- 创建：`tests/business/runtime-mode.test.ts`
- 创建：`tests/business/request-context.test.ts`
- 创建：`tests/helpers/business-context.ts`

- [ ] **步骤 1：编写运行模式失败测试**

```typescript
assert.equal(resolveStorageMode({ nodeEnv: "development", databaseUrl: "" }), "memory");
assert.equal(resolveStorageMode({ nodeEnv: "development", databaseUrl: "postgresql://db" }), "postgresql");
assert.equal(resolveStorageMode({ nodeEnv: "production", databaseUrl: "postgresql://db" }), "postgresql");
assert.throws(
  () => resolveStorageMode({ nodeEnv: "production", databaseUrl: "" }),
  (error: unknown) => error instanceof BusinessError && error.code === "DATABASE_NOT_CONFIGURED",
);
```

- [ ] **步骤 2：运行测试并确认失败**

运行：`npx tsx --test tests/business/runtime-mode.test.ts tests/business/request-context.test.ts`

预期：FAIL，模块尚不存在。

- [ ] **步骤 3：实现运行模式和稳定错误类型**

```typescript
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_COMPANY_ID = "00000000-0000-4000-8000-000000000002";

export function resolveStorageMode(input = {
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
}) {
  if (input.databaseUrl?.trim()) return "postgresql" as const;
  if (input.nodeEnv !== "production") return "memory" as const;
  throw new BusinessError("DATABASE_NOT_CONFIGURED", "生产环境必须配置 PostgreSQL 数据库", 503);
}
```

`businessErrorResponse(error)` 只暴露 `{ error, code }`，对未知错误统一返回 500/`INTERNAL_ERROR`；数据库 URL、SQL 参数和堆栈只允许出现在经过脱敏的服务端日志中。

- [ ] **步骤 4：实现可信请求上下文**

`src/middleware.ts` 必须先删除客户端传入的 `x-tradepilot-*` 头，再用 session 中的值覆盖：

```typescript
const headers = new Headers(request.headers);
for (const name of ["x-tradepilot-user-id", "x-tradepilot-company-id", "x-tradepilot-role"]) {
  headers.delete(name);
}
headers.set("x-tradepilot-user-id", request.auth.user.id || "");
headers.set("x-tradepilot-company-id", request.auth.user.companyId || "");
headers.set("x-tradepilot-role", request.auth.user.role || "member");
return NextResponse.next({ request: { headers } });
```

`requireBusinessContext(request)` 校验两个 ID 都是 UUID；缺失返回 `UNAUTHORIZED`，格式错误返回 `TENANT_CONTEXT_INVALID`。

- [ ] **步骤 5：提供测试请求工厂并验证客户端头不能伪造租户**

```typescript
export function businessRequest(url: string, init: RequestInit = {}, context = demoContext) {
  const headers = new Headers(init.headers);
  headers.set("x-tradepilot-user-id", context.userId);
  headers.set("x-tradepilot-company-id", context.companyId);
  headers.set("x-tradepilot-role", context.role);
  return new NextRequest(url, { ...init, headers });
}
```

- [ ] **步骤 6：运行定向测试**

运行：`npx tsx --test tests/business/runtime-mode.test.ts tests/business/request-context.test.ts`

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add src/lib/business src/middleware.ts src/types/next-auth.d.ts tests/business tests/helpers
git commit -m "feat(storage): enforce tenant runtime context"
```

## 任务 2：核心类型、仓库契约和租户分区内存实现

**文件：**

- 创建：`src/lib/business/types.ts`
- 创建：`src/lib/repositories/contracts.ts`
- 创建：`src/lib/repositories/memory.ts`
- 创建：`src/lib/repositories/index.ts`
- 修改：`src/lib/store.ts`
- 修改：`src/lib/dashboard.ts`
- 修改：`src/lib/finance.ts`
- 创建：`tests/repositories/contract.ts`
- 创建：`tests/repositories/memory-contract.test.ts`
- 修改：`tests/business/store.test.ts`

- [ ] **步骤 1：编写仓库契约测试**

契约必须覆盖客户、产品、询盘、报价、订单、物流和单据的 list/get/create/update/delete，以及两个公司互相不可见：

```typescript
export async function runRepositoryContract(createRepository: RepositoryFactory) {
  const companyA = await createRepository(contextA);
  const companyB = await createRepository(contextB);
  const contact = await companyA.contacts.create(validContactInput);
  assert.equal((await companyA.contacts.get(contact.id))?.name, validContactInput.name);
  assert.equal(await companyB.contacts.get(contact.id), null);
}
```

- [ ] **步骤 2：运行契约并确认失败**

运行：`npx tsx --test tests/repositories/memory-contract.test.ts`

预期：FAIL，仓库接口不存在。

- [ ] **步骤 3：抽取核心类型并保持兼容重导出**

把 `StoredContact`、`StoredProduct`、`StoredInquiry`、`StoredQuotation`、`StoredOrder`、`StoredShipment`、`StoredDocument`、`StoredLineItem` 和媒体类型移动到 `src/lib/business/types.ts`。`store.ts` 使用：

```typescript
export type {
  StoredContact,
  StoredProduct,
  StoredInquiry,
  StoredQuotation,
  StoredOrder,
  StoredShipment,
  StoredDocument,
  StoredLineItem,
} from "@/lib/business/types";
```

- [ ] **步骤 4：定义租户绑定异步接口**

```typescript
export interface BusinessRepository {
  contacts: ContactRepository;
  products: ProductRepository;
  inquiries: InquiryRepository;
  quotations: QuotationRepository;
  orders: OrderRepository;
  shipments: ShipmentRepository;
  documents: DocumentRepository;
  dashboard: {
    snapshot(): Promise<DashboardBusinessSnapshot>;
  };
}

export type RepositoryFactory = (context: BusinessContext) => Promise<BusinessRepository>;
```

接口为跨实体工作流提供明确方法：`contacts.removeIfUnreferenced`、`quotations.updateStatus`、`orders.createFromQuotation`、`shipments.advanceStatus`、`documents.generateForOrder`。

- [ ] **步骤 5：实现按公司分区的内存仓库**

`MemoryRepositoryFactory` 使用 `Map<string, TenantBusinessState>`。仅 `DEMO_COMPANY_ID` 从 `store.ts` 的 `snapshotDemoBusinessData()` 深拷贝演示记录，其他公司从空状态开始。所有返回值使用 `structuredClone`，避免调用方绕过仓库直接修改状态。

- [ ] **步骤 6：实现统一仓库工厂的内存分支**

```typescript
export async function getBusinessRepository(context: BusinessContext) {
  const mode = resolveStorageMode();
  if (mode === "memory") return memoryRepositoryFactory.forTenant(context);
  throw new BusinessError("DATABASE_SCHEMA_OUTDATED", "PostgreSQL 仓库尚未初始化", 503);
}
```

PostgreSQL 分支暂时抛出 `DATABASE_SCHEMA_OUTDATED`，以保持编译通过并为下一任务提供红灯。

- [ ] **步骤 7：运行内存仓库和现有业务测试**

运行：`npx tsx --test tests/repositories/memory-contract.test.ts tests/business/store.test.ts tests/business/dashboard.test.ts tests/business/finance.test.ts`

预期：PASS。

- [ ] **步骤 8：提交**

```bash
git add src/lib/business/types.ts src/lib/repositories src/lib/store.ts src/lib/dashboard.ts src/lib/finance.ts tests
git commit -m "refactor(storage): add async business repository"
```

## 任务 3：数据库客户端、schema 和兼容迁移

**文件：**

- 修改：`package.json`
- 修改：`package-lock.json`
- 修改：`src/db/index.ts`
- 修改：`src/db/schema/companies.ts`
- 修改：`src/db/schema/contacts.ts`
- 修改：`src/db/schema/products.ts`
- 修改：`src/db/schema/inquiries.ts`
- 修改：`src/db/schema/quotations.ts`
- 修改：`src/db/schema/orders.ts`
- 修改：`src/db/schema/shipments.ts`
- 修改：`src/db/schema/communications.ts`
- 创建：`src/db/schema/document_sequences.ts`
- 修改：`src/db/schema/index.ts`
- 创建：`src/db/migrations/0000_business_persistence.sql`
- 修改：`src/db/migrations/meta/_journal.json`
- 创建：`docker-compose.test.yml`
- 创建：`tests/helpers/database.ts`
- 创建：`tests/database/migrations.test.ts`

- [ ] **步骤 1：增加 provider-neutral PostgreSQL 驱动**

运行：`npm install postgres`

`src/db/index.ts` 使用 `drizzle-orm/postgres-js`，连接选项固定为 `prepare: false`，生产 `max: 1`，本地测试 `max: 5`。解析失败或连接失败必须抛出 `DATABASE_UNAVAILABLE`，不得返回 `null`。

- [ ] **步骤 2：编写空库和旧账号库迁移测试**

`tests/helpers/database.ts` 导出 `withCleanDatabase(databaseUrl, callback)`：为每个测试创建随机 schema，把 `search_path` 绑定到该 schema，并向回调提供 `{ sql, migrate }`；测试可在调用 `migrate()` 前创建旧表。回调结束后删除该 schema，避免共享表或并发污染。

测试启动同一个临时 PostgreSQL，分别创建：

```sql
-- case A: empty database
DROP SCHEMA public CASCADE; CREATE SCHEMA public;

-- case B: legacy partial database
CREATE TABLE companies (...existing columns...);
CREATE TABLE users (...existing columns...);
INSERT INTO companies ...;
INSERT INTO users ...;
```

执行迁移后断言核心表、复合索引、外键和旧用户仍存在。

- [ ] **步骤 3：启动测试数据库并确认迁移测试失败**

运行：`docker compose -f docker-compose.test.yml up -d --wait`

运行：`$env:TRADEPILOT_TEST_DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; npx tsx --test tests/database/migrations.test.ts`

预期：FAIL，迁移文件和 schema 尚未完成。

- [ ] **步骤 4：补齐 schema 字段和租户复合约束**

每个核心父表增加 `(company_id, id)` 唯一索引。`contact_persons`、`order_milestones`、`documents` 等子表增加 `company_id`，并使用复合外键：

```typescript
foreignKey({
  columns: [table.companyId, table.contactId],
  foreignColumns: [contacts.companyId, contacts.id],
  name: "contact_persons_company_contact_fk",
})
```

补齐设计规格中的 `grade`、`stage`、跟进时间、产品库存/来源/媒体、询盘客户快照/AI 回复、订单进度/沟通 JSON、物流 reference、单据 status/content 和时间戳。

- [ ] **步骤 5：实现原子序列表**

```typescript
export const documentSequences = pgTable("document_sequences", {
  companyId: uuid("company_id").notNull(),
  kind: varchar("kind", { length: 20 }).notNull(),
  year: integer("year").notNull(),
  nextValue: integer("next_value").notNull().default(1),
}, (table) => [primaryKey({ columns: [table.companyId, table.kind, table.year] })]);
```

- [ ] **步骤 6：编写兼容 SQL 迁移**

迁移必须使用 `CREATE TABLE IF NOT EXISTS`、`ADD COLUMN IF NOT EXISTS` 和检查 `pg_constraint`/`pg_indexes` 的 `DO $$` 块。任何已有 `companies/users` 数据不得删除或重建。迁移最后写入所有索引和 FK，并让 Drizzle journal 记录该版本。

- [ ] **步骤 7：运行迁移测试和 schema 类型检查**

运行：`$env:TRADEPILOT_TEST_DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; npx tsx --test tests/database/migrations.test.ts`

运行：`npx tsc --noEmit`

预期：PASS。

- [ ] **步骤 8：提交**

```bash
git add package.json package-lock.json src/db docker-compose.test.yml tests/database/migrations.test.ts
git commit -m "feat(db): add tenant-safe business schema"
```

## 任务 4：数据库运维命令、管理员 bootstrap 和显式 seed

**文件：**

- 创建：`scripts/db/common.mjs`
- 创建：`scripts/db/migrate.mjs`
- 创建：`scripts/db/status.mjs`
- 创建：`scripts/db/bootstrap.mjs`
- 创建：`scripts/db/seed.mjs`
- 创建：`scripts/db/init.mjs`
- 修改：`scripts/init-db.mjs`
- 修改：`package.json`
- 修改：`Dockerfile`
- 创建：`tests/database/bootstrap.test.ts`
- 创建：`tests/database/health.test.ts`

- [ ] **步骤 1：编写 bootstrap 幂等性测试**

测试连续运行两次 bootstrap，断言：公司数仍为 1、用户数仍为 1、用户 ID/company ID 不变、第二次密码可登录、日志不包含密码。

- [ ] **步骤 2：运行测试并确认失败**

运行：`$env:TRADEPILOT_TEST_DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; npx tsx --test tests/database/bootstrap.test.ts tests/database/health.test.ts`

预期：FAIL，命令模块不存在。

- [ ] **步骤 3：实现共享数据库脚本工具**

`common.mjs` 导出 `requireDatabaseUrl`、`openSql`、`hashPassword`、`normalizeEmail`、`safeErrorMessage`。所有脚本通过参数或显式 env 读取 URL，不打印原始连接串。

- [ ] **步骤 4：实现五个命令**

```json
{
  "db:migrate": "node scripts/db/migrate.mjs",
  "db:status": "node scripts/db/status.mjs",
  "db:bootstrap": "node scripts/db/bootstrap.mjs",
  "db:seed": "node scripts/db/seed.mjs",
  "db:init": "node scripts/db/init.mjs"
}
```

`db:seed` 在 `TRADEPILOT_SEED_DEMO !== "true"` 时退出码为 0 并明确输出“未启用”，不能写入任何业务数据。`db:init` 顺序执行 migrate、bootstrap、seed。

- [ ] **步骤 5：保留旧入口并更新容器文件**

`scripts/init-db.mjs` 只转发到 `scripts/db/init.mjs`。Docker runner 必须复制 `src/db/migrations`，使生产 init 容器能执行迁移。

- [ ] **步骤 6：运行命令和测试**

运行：`$env:DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; npm run db:migrate`

运行：`$env:DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; $env:TRADEPILOT_ADMIN_EMAIL='admin@example.com'; $env:TRADEPILOT_ADMIN_PASSWORD='strong-password-123'; npm run db:init`

运行：`$env:TRADEPILOT_TEST_DATABASE_URL=$env:DATABASE_URL; npx tsx --test tests/database/bootstrap.test.ts tests/database/health.test.ts`

预期：全部 PASS。

- [ ] **步骤 7：提交**

```bash
git add scripts/db scripts/init-db.mjs package.json Dockerfile tests/database
git commit -m "feat(db): add migration and bootstrap commands"
```

## 任务 5：PostgreSQL 客户和产品仓库

**文件：**

- 创建：`src/lib/repositories/postgres/mappers.ts`
- 创建：`src/lib/repositories/postgres/contacts.ts`
- 创建：`src/lib/repositories/postgres/products.ts`
- 创建：`src/lib/repositories/postgres/index.ts`
- 修改：`src/lib/repositories/index.ts`
- 创建：`tests/repositories/postgres-contract.test.ts`

- [ ] **步骤 1：让 PostgreSQL 仓库运行共享契约的客户/产品子集**

```typescript
test("postgres contacts and products obey repository contract", async () => {
  await withCleanDatabase(async (databaseUrl) => {
    await runContactsProductsContract((context) => createPostgresRepository(databaseUrl, context));
  });
});
```

- [ ] **步骤 2：运行并确认失败**

运行：`$env:TRADEPILOT_TEST_DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; npx tsx --test tests/repositories/postgres-contract.test.ts`

预期：FAIL，PostgreSQL 实现不存在。

- [ ] **步骤 3：实现统一映射器**

```typescript
export function decimalNumber(value: string | number | null | undefined) {
  if (value == null) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new BusinessError("DATABASE_SCHEMA_OUTDATED", "数据库金额字段无效", 503);
  return parsed;
}
```

日期统一输出 ISO 日期或 ISO 时间，JSON 字段先用 Zod/显式类型守卫校验，再映射为现有 API 类型。

- [ ] **步骤 4：实现客户仓库**

所有 SQL 都包含 `eq(contacts.companyId, context.companyId)`。创建/更新客户时在事务中同步主要联系人；查询详情同时加载 `contact_persons` 和客户活动；删除使用 `removeIfUnreferenced` 并把引用冲突转换为 `CONFLICT`。

- [ ] **步骤 5：实现产品仓库**

产品 create/list/get 使用数据库默认 UUID，保存库存、来源和 `mediaJson`。返回值保持 `costPrice: number`、`media: StoredProductMedia[]` 和现有字段名。

- [ ] **步骤 6：接通统一工厂并运行契约**

`getBusinessRepository(context)` 在 PostgreSQL 模式调用 `getDb()` 并返回 `createPostgresRepository(db, context)`，不再使用临时错误。

运行：`$env:TRADEPILOT_TEST_DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; npx tsx --test tests/repositories/postgres-contract.test.ts`

预期：PASS 客户/产品子集。

- [ ] **步骤 7：提交**

```bash
git add src/lib/repositories tests/repositories/postgres-contract.test.ts
git commit -m "feat(db): persist contacts and products"
```

## 任务 6：PostgreSQL 询盘、报价、订单和原子编号

**文件：**

- 创建：`src/lib/repositories/postgres/inquiries.ts`
- 创建：`src/lib/repositories/postgres/quotations.ts`
- 创建：`src/lib/repositories/postgres/orders.ts`
- 修改：`src/lib/repositories/postgres/index.ts`
- 创建：`tests/repositories/postgres-workflows.test.ts`
- 修改：`tests/repositories/postgres-contract.test.ts`

- [ ] **步骤 1：编写销售链路和并发编号失败测试**

```typescript
const quotations = await Promise.all(
  Array.from({ length: 20 }, () => repo.quotations.create(validQuotationInput)),
);
assert.equal(new Set(quotations.map((item) => item.no)).size, 20);

const accepted = await repo.quotations.updateStatus(quotations[0].id, "accepted");
const order = await repo.orders.createFromQuotation({ quotationId: accepted.id, deliveryDate: "2026-09-01" });
await assert.rejects(() => repo.orders.createFromQuotation({ quotationId: accepted.id, deliveryDate: "2026-09-01" }), conflictError);
```

- [ ] **步骤 2：运行并确认失败**

运行：`$env:TRADEPILOT_TEST_DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; npx tsx --test tests/repositories/postgres-workflows.test.ts`

预期：FAIL。

- [ ] **步骤 3：实现询盘仓库**

允许空 `contactId`，保存 `customerName`、`rawText` 和 `aiReply`；提供 `updateStatusAndReply` 单次更新。存在 contactId 时用 `(company_id, contact_id)` 校验同租户客户。

- [ ] **步骤 4：实现报价原子编号**

使用一条 upsert 语句分配序号：

```sql
INSERT INTO document_sequences (company_id, kind, year, next_value)
VALUES ($1, 'quotation', $2, 2)
ON CONFLICT (company_id, kind, year)
DO UPDATE SET next_value = document_sequences.next_value + 1
RETURNING next_value - 1 AS allocated;
```

格式化为 `QTN-${year}-${allocated.toString().padStart(3, "0")}`；订单使用相同函数和 `kind='order'`。

- [ ] **步骤 5：实现报价仓库**

创建时重新计算每个 item amount 与 totalAmount。列表通过一次订单查询附加 `orderId`。状态更新前检查同租户订单引用；已转订单返回 `CONFLICT`。

- [ ] **步骤 6：实现订单仓库事务**

`createFromQuotation` 在事务中锁定报价、验证 accepted、验证客户归属、检查唯一 quotationId、分配编号并插入订单。订单 PATCH 只允许 deliveryDate、progressPercent、status、comms；状态最小进度规则复用现有行为。

- [ ] **步骤 7：运行工作流、契约和并发测试**

运行：`$env:TRADEPILOT_TEST_DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; npx tsx --test tests/repositories/postgres-contract.test.ts tests/repositories/postgres-workflows.test.ts`

预期：PASS。

- [ ] **步骤 8：提交**

```bash
git add src/lib/repositories/postgres tests/repositories
git commit -m "feat(db): persist sales workflow"
```

## 任务 7：PostgreSQL 物流、单据和 Dashboard 快照

**文件：**

- 创建：`src/lib/repositories/postgres/shipments.ts`
- 创建：`src/lib/repositories/postgres/documents.ts`
- 修改：`src/lib/repositories/postgres/index.ts`
- 修改：`tests/repositories/postgres-contract.test.ts`
- 修改：`tests/repositories/postgres-workflows.test.ts`

- [ ] **步骤 1：编写物流事务和单据幂等失败测试**

测试同一订单只能创建一条物流、物流状态不能倒退、`departed/in_transit` 把订单设为 shipped、`delivered` 把订单设为 completed、重复生成同类型单据不增加记录。

- [ ] **步骤 2：运行并确认失败**

运行：`$env:TRADEPILOT_TEST_DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; npx tsx --test tests/repositories/postgres-workflows.test.ts`

预期：FAIL。

- [ ] **步骤 3：实现物流仓库事务**

`create` 验证订单状态和唯一 `(company_id, order_id)`。`advanceStatus` 锁定物流和订单，在同一事务中更新两张表，并拒绝状态索引倒退。

- [ ] **步骤 4：实现单据仓库**

`generateForOrder(orderId, types)` 使用 `(company_id, order_id, doc_type)` 唯一约束；已有 draft 更新为 generated，已有 generated 原样返回。`content` 保存生成时的稳定业务 JSON 快照，下载时再渲染 HTML。

- [ ] **步骤 5：实现 Dashboard 快照**

仓库一次并行读取当前租户的 contacts/products/inquiries/quotations/orders，返回 `DashboardBusinessSnapshot`。`buildDashboard` 和 `buildFinanceData` 继续作为纯函数使用。

- [ ] **步骤 6：运行所有仓库测试**

运行：`$env:TRADEPILOT_TEST_DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; npx tsx --test tests/repositories/*.test.ts`

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add src/lib/repositories/postgres tests/repositories
git commit -m "feat(db): persist fulfillment workflow"
```

## 任务 8：认证、健康检查和生产配置错误体验

**文件：**

- 修改：`src/lib/auth.ts`
- 创建：`src/lib/auth-credentials.ts`
- 修改：`src/lib/registration.ts`
- 创建：`src/lib/database-health.ts`
- 创建：`src/app/api/health/route.ts`
- 修改：`src/middleware.ts`
- 修改：`src/app/auth/login/page.tsx`
- 修改：`src/app/app/layout.tsx`
- 修改：`tests/database/health.test.ts`
- 创建：`tests/business/auth-storage.test.ts`

- [ ] **步骤 1：编写认证模式测试**

断言开发内存模式只接受演示账号并返回固定 UUID；生产模式不再接受 env 明文管理员快捷登录；数据库用户返回真实 UUID；生产缺库健康端点返回 503/`DATABASE_NOT_CONFIGURED`。

- [ ] **步骤 2：运行并确认失败**

运行：`npx tsx --test tests/business/auth-storage.test.ts tests/database/health.test.ts`

预期：FAIL。

- [ ] **步骤 3：重构认证 authorize**

```typescript
if (resolveStorageMode() === "memory") {
  return matchesDemoCredentials(email, password) ? demoUser : null;
}
return findUserByCredentials(email, password);
```

删除 `deployment-admin` 和 `deployment-workspace`。把账号选择逻辑抽到 `authorizeCredentials(email, password)`，Credentials provider 只调用该函数。`createUser` 使用 PostgreSQL 事务创建 company + owner；连接错误不能伪装成“账号密码错误”，而是记录安全错误分类。

- [ ] **步骤 4：实现健康检查**

`getDatabaseHealth()` 检查 `DATABASE_URL`、`SELECT 1`、Drizzle migration 表/最新 hash、owner 用户数量，返回：

```typescript
type HealthResult = {
  status: "ok" | "error";
  storage: "memory" | "postgresql" | "not_configured";
  database: "not_used" | "connected" | "unavailable";
  migrations: "not_used" | "current" | "outdated";
  bootstrapRequired: boolean;
};
```

- [ ] **步骤 5：更新登录页和应用布局**

登录页加载 `/api/health`，当状态为 `not_configured/outdated/unavailable/bootstrapRequired` 时显示明确操作提示并禁用提交；开发内存模式继续预填演示账号。应用布局在仓库配置错误时渲染配置错误视图，不显示空白后台。

- [ ] **步骤 6：运行认证和健康测试**

运行：`npx tsx --test tests/business/auth-storage.test.ts tests/database/health.test.ts`

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add src/lib/auth.ts src/lib/registration.ts src/lib/database-health.ts src/app/api/health src/middleware.ts src/app/auth/login src/app/app/layout.tsx tests
git commit -m "feat(auth): require database-backed production users"
```

## 任务 9：迁移客户和产品 API、导入导出及产品依赖调用方

**文件：**

- 修改：`src/app/api/contacts/route.ts`
- 修改：`src/app/api/contacts/[id]/route.ts`
- 修改：`src/app/api/contacts/import/route.ts`
- 修改：`src/app/api/contacts/export/route.ts`
- 修改：`src/app/api/products/route.ts`
- 修改：`src/app/api/products/import/route.ts`
- 修改：`src/app/api/products/export/route.ts`
- 修改：`src/app/api/firecrawl/confirm/route.ts`
- 修改：`src/app/api/product-videos/route.ts`
- 创建：`src/lib/firecrawl/confirmation.ts`
- 修改：`tests/business/contacts-import.test.ts`
- 修改：`tests/business/api-input-integrity.test.ts`
- 创建：`tests/business/products-import-export.test.ts`
- 创建：`tests/firecrawl/confirmation.test.ts`

- [ ] **步骤 1：更新 API 测试请求以带可信上下文**

所有直接调用核心 route handler 的测试改用 `businessRequest()`。增加公司 A 导入后公司 B 导出为空的断言。

- [ ] **步骤 2：运行定向测试并确认失败**

运行：`npx tsx --test tests/business/contacts-import.test.ts tests/business/api-input-integrity.test.ts tests/business/products-import-export.test.ts`

预期：FAIL，路由仍直接使用 `store`。

- [ ] **步骤 3：迁移客户 CRUD 和导出**

每个 handler 执行：

```typescript
const context = requireBusinessContext(request);
const repository = await getBusinessRepository(context);
const contacts = await repository.contacts.list();
```

保持现有 JSON/CSV 字段和中文提示。错误统一通过 `businessErrorResponse(error)` 转换。

- [ ] **步骤 4：让客户 AI 导入整批原子写入**

AI 结果全部规范化并校验完成后调用 `repository.contacts.importBatch(inputs)`；任何一行失败不写入。响应增加 `errors` 时仍保持现有 `contacts/raw` 成功结构。

- [ ] **步骤 5：迁移产品 CRUD、导出和确认写入**

产品导入预览端点保持只读。Firecrawl 确认和产品创建调用 `repository.products.create`。`src/lib/firecrawl/confirmation.ts` 使用 HMAC-SHA256 对 `{ issuedAt, sourceUrl, normalizedPreviewHash }` 签名，15 分钟过期并使用恒定时间比较；确认接口重新规范化客户端数据并验证摘要，拒绝被篡改或过期的预览。

运行：`npx tsx --test tests/firecrawl/confirmation.test.ts`

预期：PASS 篡改、过期和错误 secret 测试。

- [ ] **步骤 6：迁移产品视频产品校验**

产品视频任务仍由文件仓库持久化，但 `productId` 必须通过当前租户的 `repository.products.get` 验证。

- [ ] **步骤 7：运行客户/产品测试**

运行：`npx tsx --test tests/business/contacts-import.test.ts tests/business/api-input-integrity.test.ts tests/business/products-import-export.test.ts tests/product-video/*.test.ts tests/firecrawl/*.test.ts`

预期：PASS。

- [ ] **步骤 8：提交**

```bash
git add src/app/api/contacts src/app/api/products src/app/api/firecrawl/confirm src/app/api/product-videos tests
git commit -m "feat(api): persist contacts and products"
```

## 任务 10：迁移询盘、报价、订单、物流、单据和聚合 API

**文件：**

- 修改：`src/app/api/inquiries/route.ts`
- 修改：`src/app/api/inquiries/[id]/route.ts`
- 修改：`src/app/api/quotations/route.ts`
- 修改：`src/app/api/quotations/[id]/route.ts`
- 修改：`src/app/api/orders/route.ts`
- 修改：`src/app/api/orders/[id]/route.ts`
- 修改：`src/app/api/shipments/route.ts`
- 修改：`src/app/api/documents/route.ts`
- 修改：`src/app/api/documents/generate/route.ts`
- 修改：`src/app/api/documents/download/route.ts`
- 修改：`src/app/api/dashboard/route.ts`
- 修改：`src/app/api/finance/route.ts`
- 修改：`src/app/api/logistics/route.ts`
- 修改：`tests/business/inquiry-integrity.test.ts`
- 修改：`tests/business/quotation-integrity.test.ts`
- 修改：`tests/business/quotation-workflow.test.ts`
- 修改：`tests/business/order-workflow.test.ts`
- 修改：`tests/business/shipment-integrity.test.ts`
- 修改：`tests/business/documents.test.ts`
- 修改：`tests/business/dashboard.test.ts`
- 修改：`tests/business/finance.test.ts`

- [ ] **步骤 1：把销售/履约路由测试切换到可信上下文和异步断言**

路由测试不再直接读写 `store` 验证结果；使用仓库查询同一租户的最终状态，并增加跨租户 404 测试。

- [ ] **步骤 2：运行业务测试并确认失败**

运行：`npx tsx --test tests/business/inquiry-integrity.test.ts tests/business/quotation*.test.ts tests/business/order-workflow.test.ts tests/business/shipment-integrity.test.ts tests/business/documents.test.ts tests/business/dashboard.test.ts tests/business/finance.test.ts`

预期：FAIL。

- [ ] **步骤 3：迁移询盘和报价路由**

AI 回复 route 先读取当前租户询盘，再调用 AI，最后用 `updateStatusAndReply` 保存。报价创建不在 route 生成 ID/编号，全部由仓库处理；报价列表直接使用带 `orderId` 的仓库结果。

- [ ] **步骤 4：迁移订单和物流路由**

订单创建只调用 `createFromQuotation`；物流推进只调用 `advanceStatus`，避免 route 中出现非原子双写。保持现有状态码和状态最小进度规则。

- [ ] **步骤 5：迁移单据路由和 HTML 生成**

下载 route 通过仓库一次取得 document + order + contact。`generateDocumentHTML` 改为纯函数，显式接收三个参数，不再读取全局 store。

- [ ] **步骤 6：迁移 Dashboard/finance/logistics 聚合**

Dashboard 和 finance 从 `repository.dashboard.snapshot()` 取数据；logistics 从当前租户 shipments 生成现有 milestones JSON。

- [ ] **步骤 7：运行全部业务测试**

运行：`npm test`

预期：全部 PASS。

- [ ] **步骤 8：运行真实数据库 route 集成测试**

运行：`$env:DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; $env:NODE_ENV='test'; npm test`

预期：核心 route 使用 PostgreSQL 模式且 PASS。

- [ ] **步骤 9：提交**

```bash
git add src/app/api tests/business
git commit -m "feat(api): persist sales and fulfillment"
```

## 任务 11：Docker PostgreSQL 一条命令部署

**文件：**

- 修改：`docker-compose.yml`
- 修改：`Dockerfile`
- 修改：`install.sh`
- 修改：`install.bat`
- 修改：`.env.example`
- 创建：`tests/deploy/docker-database.test.mjs`

- [ ] **步骤 1：编写 Compose 拓扑失败测试**

解析 `docker-compose.yml`，断言存在 `postgres`、`db-init`、`tradepilot`；postgres 有健康检查和持久 volume；db-init 等待 postgres healthy；app 等待 db-init 成功；app 的 `DATABASE_URL` 指向内部 postgres。

- [ ] **步骤 2：运行并确认失败**

运行：`node --test tests/deploy/docker-database.test.mjs`

预期：FAIL。

- [ ] **步骤 3：更新 Compose**

```yaml
postgres:
  image: postgres:17-alpine
  environment:
    POSTGRES_DB: tradepilot
    POSTGRES_USER: tradepilot
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}
  volumes:
    - tradepilot_postgres:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U tradepilot -d tradepilot"]

db-init:
  build: .
  command: ["npm", "run", "db:init"]
  depends_on:
    postgres:
      condition: service_healthy
```

`tradepilot` 使用 `condition: service_completed_successfully` 等待 db-init。

- [ ] **步骤 4：重写跨平台安装脚本**

Shell 和 batch 都必须生成 `AUTH_SECRET`、`POSTGRES_PASSWORD`、管理员密码，保留已有 `.env` 值，设置文件权限，执行 `docker compose up -d postgres`、`docker compose run --rm db-init`、`docker compose up -d tradepilot video-worker`，最后轮询 `/api/health`。

- [ ] **步骤 5：验证幂等性和持久化**

运行两次 `bash install.sh` 的 non-interactive 测试模式，第二次不得删除 volume 或改变管理员 company ID。创建测试客户后执行 `docker compose restart tradepilot`，客户仍可查询。

- [ ] **步骤 6：运行测试和 Compose 校验**

运行：`node --test tests/deploy/docker-database.test.mjs`

运行：`docker compose config --quiet`

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add docker-compose.yml Dockerfile install.sh install.bat .env.example tests/deploy/docker-database.test.mjs
git commit -m "feat(deploy): add PostgreSQL Docker bootstrap"
```

## 任务 12：Cloudflare 引导式部署

**文件：**

- 创建：`scripts/setup-cloudflare.mjs`
- 修改：`package.json`
- 修改：`wrangler.jsonc`
- 创建：`tests/deploy/cloudflare-setup.test.mjs`
- 修改：`tests/build/wrangler-config.test.mjs`

- [ ] **步骤 1：编写 dry-run 和 secret 泄露测试**

脚本导出可注入的 `runCloudflareSetup({ prompt, exec, fetch, env, dryRun })`。测试记录所有命令和输出，断言：数据库 URL/管理员密码从未出现在 argv 或日志；`wrangler secret put` 通过 stdin；步骤顺序是 status -> migrate -> bootstrap -> secrets -> build -> deploy -> health。

- [ ] **步骤 2：运行并确认失败**

运行：`node --test tests/deploy/cloudflare-setup.test.mjs tests/build/wrangler-config.test.mjs`

预期：FAIL。

- [ ] **步骤 3：实现交互和 non-interactive 模式**

支持：

```text
npm run setup:cloudflare
npm run setup:cloudflare -- --dry-run
DATABASE_URL=... TRADEPILOT_ADMIN_EMAIL=... TRADEPILOT_ADMIN_PASSWORD=... npm run setup:cloudflare -- --non-interactive
```

密码使用隐藏输入；脚本捕获子进程 stdout/stderr 时进行 secret 替换。失败立即停止并打印下一条可执行修复命令。

- [ ] **步骤 4：实现数据库和部署步骤**

脚本使用用户连接串执行 `db:status`、`db:migrate`、`db:bootstrap`、可选 `db:seed`；再设置 `DATABASE_URL`、`AUTH_SECRET`，执行 `npm run cfbuild`、`npx wrangler deploy`，最后请求 `/api/health`。

- [ ] **步骤 5：保留 Dashboard 变量并验证配置**

`wrangler.jsonc` 保留 `keep_vars: true`。Neon 和普通 TLS PostgreSQL 都通过 `DATABASE_URL` 进入同一个 postgres.js 数据访问层；脚本不得写入普通 Wrangler vars 或提交配置文件。

- [ ] **步骤 6：运行部署脚本测试和 Cloudflare dry-run**

运行：`node --test tests/deploy/cloudflare-setup.test.mjs tests/build/wrangler-config.test.mjs`

运行：`npm run setup:cloudflare -- --dry-run`

运行：`npx wrangler deploy --dry-run`

预期：PASS，输出不含 secret。

- [ ] **步骤 7：提交**

```bash
git add scripts/setup-cloudflare.mjs package.json wrangler.jsonc tests/deploy tests/build/wrangler-config.test.mjs
git commit -m "feat(deploy): add Cloudflare database setup"
```

## 任务 13：文档、升级说明和完整验证

**文件：**

- 修改：`README.md`
- 修改：`ARCHITECTURE.md`
- 修改：`.env.example`
- 创建：`docs/postgresql-deployment.md`
- 修改：`docs/superpowers/specs/2026-07-26-postgresql-persistence-and-deployment-design.md`
- 修改：`package.json`

- [ ] **步骤 1：更新用户文档**

README 明确写出：生产强制数据库、本地无数据库使用内存演示、生产默认空库、`TRADEPILOT_SEED_DEMO=true` 才填充演示数据、Docker 一条命令、Cloudflare 引导命令、管理员密码初始化后可从 Worker secret 删除。

- [ ] **步骤 2：新增升级和故障排查文档**

覆盖空库、旧 `companies/users` 库、Neon、普通 PostgreSQL、`DATABASE_NOT_CONFIGURED`、`DATABASE_UNAVAILABLE`、`DATABASE_SCHEMA_OUTDATED`、`bootstrapRequired`、Cloudflare Git 自动构建不负责迁移等场景。

- [ ] **步骤 3：统一验证脚本**

增加：

```json
{
  "test:db": "tsx --test tests/database/*.test.ts tests/repositories/postgres*.test.ts",
  "test:deploy": "node --test tests/deploy/*.test.mjs tests/build/*.test.mjs",
  "test:coverage": "node --import tsx --test --experimental-test-coverage --test-coverage-lines=80 --test-coverage-functions=80 --test-coverage-branches=80 --test-coverage-include=src/lib/business/** --test-coverage-include=src/lib/repositories/** tests/business/*.test.ts tests/repositories/*.test.ts",
  "verify": "npm test && npm run lint && tsc --noEmit && npm run build"
}
```

- [ ] **步骤 4：运行完整本地验证**

运行：`npm test`

运行：`$env:TRADEPILOT_TEST_DATABASE_URL='postgresql://tradepilot:tradepilot@127.0.0.1:55432/tradepilot_test'; npm run test:db`

运行：`npm run test:deploy`

运行：`npm run test:coverage`

运行：`npm run lint`

运行：`npx tsc --noEmit`

运行：`npm run build`

运行：`npm run cfbuild`

运行：`npx wrangler deploy --dry-run`

运行：`docker compose config --quiet`

预期：所有命令退出码为 0；lint 只允许已记录的现有 warning，不允许新增 error。

- [ ] **步骤 5：运行安全和敏感信息检查**

运行：`npm audit`

运行：`npm audit --audit-level=critical`

运行：`rg -n "ghp_|postgresql://[^<[:space:]`]+|TRADEPILOT_ADMIN_PASSWORD=.*[^<]" --glob '!package-lock.json' --glob '!docs/superpowers/**' .`

预期：critical 门槛退出码 0；完整 audit 的已有 high/moderate 风险单独记录；仓库没有真实 secret。

- [ ] **步骤 6：检查 diff 和生产行为**

运行：`git diff --check`

运行：`git status --short`

手工验证矩阵：

```text
dev + no DATABASE_URL -> demo login and demo records
dev + DATABASE_URL -> real empty/seeded PostgreSQL
production + no DATABASE_URL -> configuration error, no demo fallback
production + DATABASE_URL + no migration -> schema outdated
production + migrated DB + no owner -> bootstrap required
production + migrated/bootstrap DB -> login and persistent CRUD
```

- [ ] **步骤 7：请求代码审查并修复发现**

使用 `superpowers-zh:requesting-code-review` 审查完整分支，重点检查 SQL 安全、跨租户过滤、secret 处理、迁移可恢复性和 Cloudflare/Docker 回归。修复后重新运行步骤 4-6。

- [ ] **步骤 8：提交文档和验证配置**

```bash
git add README.md ARCHITECTURE.md .env.example docs package.json
git commit -m "docs: document PostgreSQL deployment"
```

## 规格覆盖自检

| 规格要求 | 实现任务 |
| --- | --- |
| 生产强制 PostgreSQL、本地内存演示 | 任务 1、2、8 |
| 真实 UUID 管理员和租户隔离 | 任务 1、3、4、8 |
| 客户、产品、询盘、报价、订单、物流持久化 | 任务 5、6、7、9、10 |
| 单据和 Dashboard 直接依赖 | 任务 7、10 |
| 数据库迁移、状态、bootstrap、seed | 任务 3、4 |
| 导入导出数据库化和整批回滚 | 任务 5、9 |
| 并发编号和事务工作流 | 任务 6、7 |
| 稳定错误码和健康检查 | 任务 1、8 |
| Docker 一条命令部署 | 任务 11 |
| Cloudflare 引导式部署 | 任务 12 |
| 真实 PostgreSQL、80%+ 新增代码覆盖和完整验证 | 任务 3-13 |
