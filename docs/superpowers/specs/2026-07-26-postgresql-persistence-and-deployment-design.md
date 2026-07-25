# TradePilot PostgreSQL 持久化与一键部署设计

- 日期：2026-07-26
- 状态：设计已确认，待书面规格审查
- 范围：客户、产品、询盘、报价、订单、物流，以及这些流程直接依赖的导入、导出、认证租户和部署能力

## 1. 背景

TradePilot 已经包含 PostgreSQL/Neon、Drizzle schema 和数据库账号注册的基础代码，但客户、产品、询盘、报价、订单和物流仍然读取 `src/lib/store.ts` 中的进程内数组。Cloudflare Worker 重启、重新部署或切换 isolate 后，这些业务数据会消失；Docker 的数据卷也没有保存这些核心 CRM 数据。

当前数据库迁移日志为空，`scripts/init-db.mjs` 只创建 `companies` 和 `users` 两张表。生产管理员登录还允许使用固定的 `deployment-workspace`，因此没有真实 UUID 租户，无法安全地把业务记录写入带外键的表。

本设计将现有内存演示模式保留给零配置本地开发，同时让所有生产部署强制使用客户自行选择的 PostgreSQL 服务，包括 Neon 和其他兼容 PostgreSQL 的提供商。

## 2. 目标

1. 客户、产品、询盘、报价、订单和物流在生产环境持久化到 PostgreSQL。
2. 所有核心业务数据按登录用户的 `companyId` 隔离，禁止跨租户读取或修改。
3. 保持现有前端和 API JSON 结构兼容，避免为了更换存储层重写界面。
4. `npm run dev` 在没有 `DATABASE_URL` 时继续展示内存演示数据；配置数据库后可在本地直接测试 PostgreSQL 模式。
5. 生产环境没有数据库时明确失败，绝不静默降级到内存数据。
6. 默认生产数据库为空；只有显式设置 `TRADEPILOT_SEED_DEMO=true` 才写入演示业务数据。
7. Docker 提供真正的一条命令部署；Cloudflare 提供可重复、可诊断的引导式部署流程。
8. 数据库迁移、状态检查、管理员初始化和演示数据填充都使用独立、可重复执行的命令。

## 3. 非目标

本阶段不把供应商、邮箱账号、渠道绑定、任务、AI 配置、产品视频任务或所有插件状态迁移到 PostgreSQL，除非某个字段是上述六个核心流程正常运行的直接依赖。它们继续沿用现有实现，并在后续规格中单独迁移。

本阶段不引入 Supabase 专有 API、Neon 专有数据模型、Redis、Elasticsearch、对象存储或新的 ORM。产品媒体继续保存现有 URL 或 data URL；将大文件迁移到 R2/S3 属于后续优化。

本阶段不改变公开 API 路径、主要响应字段、页面信息架构或业务状态机，也不自动导入旧 Worker 内存中的演示数据，因为这些数据本来就没有可靠的持久化来源。

## 4. 运行模式与配置规则

新增统一的运行模式解析器，所有 API、认证和仓库工厂都使用同一个判断结果。

| 条件 | 数据模式 | 行为 |
| --- | --- | --- |
| `DATABASE_URL` 已配置 | PostgreSQL | 开发和生产都使用数据库 |
| `DATABASE_URL` 未配置且 `NODE_ENV !== "production"` | Memory Demo | 仅供 `npm run dev` 演示 |
| `DATABASE_URL` 未配置且 `NODE_ENV === "production"` | Configuration Error | 返回明确的生产配置错误，不创建内存仓库 |

`next build` 和 `npm run cfbuild` 不在构建阶段连接数据库。Cloudflare 的 secret 可能只在 Worker 运行时可见，因此强制检查发生在部署引导、数据库状态命令和运行时请求中，而不是在静态构建过程中。

生产运行时缺少数据库时，受保护页面进入统一的配置错误页；API 返回 HTTP 503 和稳定错误码 `DATABASE_NOT_CONFIGURED`。响应不得包含连接字符串、密码、主机细节或底层堆栈。

## 5. 架构

### 5.1 分层

```text
Next.js route / server component
            |
            v
authenticated request context
  { userId, companyId, role }
            |
            v
business repository interface (async)
       /                    \
memory demo repository      PostgreSQL repository
(dev only, no DB URL)       (Drizzle, required in production)
```

API 路由不再直接导入全局 `store`。它们通过仓库工厂获取一个异步 `BusinessRepository`，并将认证上下文中的 `companyId` 传给每个操作。仓库负责查询条件、字段映射和数据库约束；路由继续负责 HTTP 输入校验、状态码和响应格式。

### 5.2 仓库边界

`BusinessRepository` 是多个小型仓库的聚合，而不是一个包含所有逻辑的巨型文件：

```typescript
interface BusinessRepository {
  contacts: ContactRepository;
  products: ProductRepository;
  inquiries: InquiryRepository;
  quotations: QuotationRepository;
  orders: OrderRepository;
  shipments: ShipmentRepository;
  documents: DocumentRepository;
  dashboard: DashboardRepository;
}
```

每个读写方法都是异步的，并要求租户上下文。需要同时更新多个实体的工作流由仓库提供专用原子操作，例如：

- 接受报价后从报价创建订单；
- 推进物流状态并同步订单状态；
- 删除客户前检查报价和订单引用；
- 生成单据时创建或更新对应记录；
- 分配报价号和订单号。

内存实现与 PostgreSQL 实现运行同一套仓库契约测试。内存实现的数据按 `companyId` 分区，默认演示租户只在开发模式创建，并使用固定但合法的 UUID 形状 ID，以通过与生产相同的请求上下文校验。

### 5.3 请求上下文和租户隔离

所有核心 API 首先读取 NextAuth session。未登录返回 401；session 缺少有效 UUID `companyId` 返回 403。任何记录查询、关联检查、更新和删除都同时匹配记录 ID 与 `companyId`，不能先按 ID 查询再在应用层判断租户。

每个核心表和直接依赖表都包含 `company_id`。父表提供 `(company_id, id)` 唯一键，子表使用包含 `company_id` 的复合外键，数据库层直接拒绝跨租户关联；仓库仍对每条 SQL 显式添加租户条件。即使攻击者知道另一租户的 UUID，仓库也只会返回 404，避免泄露记录是否存在。

## 6. 认证和管理员初始化

生产管理员不再通过 `deployment-admin` 和 `deployment-workspace` 直接登录。`TRADEPILOT_ADMIN_EMAIL` 和 `TRADEPILOT_ADMIN_PASSWORD` 只作为部署期间的初始化输入，创建或更新真实的 `companies` 和 `users` 记录；运行时登录统一从数据库校验密码哈希。

管理员初始化具有以下规则：

1. 首次执行时创建一个公司和 owner 用户，生成真实 UUID。
2. 再次执行时按规范化邮箱查找用户并安全更新密码，不重复创建公司。
3. 密码只保存为现有 PBKDF2 格式的哈希；日志不得打印密码。
4. 生产环境没有管理员账号时，健康检查报告 `bootstrapRequired`，登录页显示可操作的初始化提示。
5. 本地无数据库模式继续允许 `demo@tradepilot.dev / 12345678`，但该账号和租户不会进入生产路径。
6. 自助注册继续要求数据库，并在创建公司和 owner 用户时使用数据库事务；注册 API 不在内存演示模式伪造持久化成功。

完成初始化后，Cloudflare Worker 运行时不需要保存管理员明文密码。引导脚本可以在迁移和初始化后删除或不上传 `TRADEPILOT_ADMIN_PASSWORD`；`DATABASE_URL` 与 `AUTH_SECRET` 始终作为 secret 管理。

## 7. 数据模型和兼容映射

现有 Drizzle schema 作为起点，通过正式迁移补齐字段、索引和约束。数据库使用 UUID 主键和带时区时间戳；API 仍然返回字符串 ID 和现有日期格式。

### 7.1 客户

- `contacts` 保存公司级信息、`grade`、`stage`、最近联系时间和下次跟进时间。
- `contact_persons` 保存 `company_id`、姓名、邮箱、电话、职位和主要联系人标记。
- 当前 API 的平铺 `email`、`phone` 字段映射到主要联系人；响应继续返回平铺字段，同时保留 `persons` 数组。
- 客户活动映射到 `communications`，以 `call`、`meeting`、`email` 等 channel 保存。
- 删除客户前检查同租户的报价和订单引用；存在引用时返回 409。

### 7.2 产品

- `products` 补齐库存数量、低库存阈值、仓库显示值、来源和媒体 JSON 字段。
- `media` 的图片/视频元数据保持现有 JSON 结构，以保证产品页和 Firecrawl 确认流程兼容。
- 金额从 PostgreSQL decimal 转换为 API number，写入前继续执行现有非负数校验。
- 本阶段不把 data URL 上传到对象存储，但保留当前大小和 MIME 类型限制。

### 7.3 询盘

- `contact_id` 允许为空，以兼容尚未建档客户的手工询盘。
- 增加客户名称快照和 `ai_reply`；原始内容映射到 `raw_text`。
- 当 `contact_id` 存在时，必须引用同租户客户。

### 7.4 报价

- `quotation_no` 在 `(company_id, quotation_no)` 上唯一。
- 产品行继续使用 `items_json`，保持现有 `items` 响应结构。
- 客户名称从客户记录读取并作为响应快照返回。
- 报价状态更新和“是否已生成订单”的检查在同租户范围内执行。

### 7.5 订单

- `order_no` 在 `(company_id, order_no)` 上唯一。
- `quotation_id` 增加唯一约束，保持一个报价最多生成一个订单的现有规则。
- 增加 `progress_percent`，订单项目继续保存在 `items_json`。
- 从报价创建订单时验证报价状态、客户归属和重复订单，并在一个事务中创建订单。

### 7.6 物流和单据

- `shipments` 增加与现有 API 对应的 `reference_no`，并支持 `booked`、`departed`、`in_transit`、`delivered`。
- 本阶段保持一个订单一条物流记录，在 `(company_id, order_id)` 上设置唯一约束。
- 推进物流状态与订单状态更新在同一个事务中完成，禁止状态倒退。
- `documents` 纳入仓库，因为订单单据生成和下载直接依赖订单、客户和物流。表中补齐状态与内容字段，文件正文或生成内容需要持久化，不能只记录临时内存 ID。

### 7.7 原子编号

新增 `document_sequences` 表：

```text
company_id | kind       | year | next_value
-----------+------------+------+-----------
UUID       | quotation  | 2026 | 5
UUID       | order      | 2026 | 92
```

编号使用单条 PostgreSQL upsert 原子递增，格式继续为 `QTN-YYYY-NNN` 和 `ORD-YYYY-NNN`。并发请求不会生成重复编号；数据库唯一约束作为第二层保护。编号允许因事务失败出现空号，但不能重复或回退。

## 8. 数据库迁移

新增并统一以下命令：

| 命令 | 作用 |
| --- | --- |
| `npm run db:migrate` | 应用已提交的 SQL 迁移，不直接从 schema 做破坏性 push |
| `npm run db:status` | 检查连接、必需表、迁移版本和管理员初始化状态 |
| `npm run db:bootstrap` | 创建或更新生产管理员公司和 owner 用户 |
| `npm run db:seed` | 仅在 `TRADEPILOT_SEED_DEMO=true` 时填充演示业务数据 |
| `npm run db:init` | 兼容入口，顺序调用 migrate、bootstrap，并按开关 seed |

首个正式迁移必须同时支持两种起点：

1. 全新的空 PostgreSQL 数据库；
2. 已运行旧版 `scripts/init-db.mjs`、只存在 `companies` 和 `users` 的数据库。

迁移使用可重复执行的兼容 SQL 补齐表、列、索引和约束，不能要求用户删除现有账号。迁移脚本执行前检查必需扩展和权限；失败时保留原数据库，并输出不含 secret 的修复提示。生产部署不使用 `drizzle-kit push`，避免未审查的结构变更。

## 9. 导入和导出

客户 CSV 导入先完成整批解析和校验，再在数据库事务中写入。任何一行失败时不产生部分导入，并返回行号和字段错误。导入生成 UUID，自动关联主要联系人，并始终写入当前 `companyId`。

产品导入保留现有预览步骤，并新增明确的确认写入阶段；确认接口只接受服务器签名或重新校验后的规范化数据，不能信任客户端修改过的预览结果。

客户和产品 CSV 导出直接查询当前租户的 PostgreSQL 数据，保持现有列名和下载行为。空数据库导出合法返回只有表头的文件。任何导入和导出都不能跨租户。

## 10. API 兼容和错误处理

现有 API 路径和成功响应尽量不变。同步 `store` 调用改为 `await repository...` 后，页面无需感知当前使用内存还是 PostgreSQL。

稳定错误分类如下：

| 场景 | HTTP | 错误码 |
| --- | --- | --- |
| 未登录 | 401 | `UNAUTHORIZED` |
| session 无有效租户 | 403 | `TENANT_CONTEXT_INVALID` |
| 生产未配置数据库 | 503 | `DATABASE_NOT_CONFIGURED` |
| 数据库不可达 | 503 | `DATABASE_UNAVAILABLE` |
| 迁移未完成 | 503 | `DATABASE_SCHEMA_OUTDATED` |
| 关联资源不存在 | 404 | `NOT_FOUND` |
| 唯一约束或状态冲突 | 409 | `CONFLICT` |
| 输入无效 | 400/413 | 保持现有中文提示并增加稳定错误码 |

数据库异常在服务端记录关联 ID 和安全摘要，客户端只得到可操作的中文信息。仓库将 PostgreSQL 唯一约束、外键约束和连接错误转换为明确的领域错误，路由不解析数据库错误字符串。

## 11. Dashboard 和依赖调用方

Dashboard、财务汇总、物流视图、单据下载、Firecrawl 产品确认和产品视频创建等直接读取核心实体的调用方，都改为通过仓库读取当前租户数据。聚合查询应在 PostgreSQL 端完成或由专用 dashboard 仓库一次取回，避免每张卡片重复建立查询链。

未纳入本阶段持久化的模块不能绕过仓库读取核心实体。例如产品视频任务可以继续使用文件存储，但验证 `productId` 时必须通过产品仓库和当前 `companyId`。

## 12. Docker 一条命令部署

`docker-compose.yml` 新增 PostgreSQL 服务、持久化 volume 和健康检查。部署拓扑为：

```text
postgres (healthy)
    |
    v
db-init (migrate -> bootstrap -> optional seed, exits 0)
    |
    v
tradepilot app
```

`install.sh` 和 `install.bat` 负责：

1. 检查 Docker/Compose；
2. 生成 `AUTH_SECRET` 和数据库密码；
3. 获取或生成管理员账号；
4. 写入仅本机可读的 `.env`；
5. 启动 PostgreSQL；
6. 执行迁移和管理员初始化；
7. 启动应用和现有视频服务；
8. 等待健康检查并打印访问地址和管理员邮箱。

重复执行安装脚本必须是幂等的，不删除 volume、不重建管理员公司、不重置用户业务数据。生产容器没有数据库或迁移失败时不启动应用。

## 13. Cloudflare 引导式部署

Cloudflare Worker 无法可靠地替用户自动创建第三方 PostgreSQL，因此“一键部署”定义为一个本地引导命令，而不是承诺完全无人值守的网页按钮。用户可选择 Neon 或任意支持 TLS 的 PostgreSQL 连接串。

新增 `npm run setup:cloudflare`，依次完成：

1. 检查 Node、Wrangler 登录状态和目标 Worker；
2. 提示用户粘贴 PostgreSQL/Neon `DATABASE_URL`，只在当前进程中使用；
3. 安全读取管理员邮箱和密码，密码输入不回显；
4. 检查连接和数据库权限；
5. 执行 migrate、bootstrap 和可选 seed；
6. 生成或读取 `AUTH_SECRET`；
7. 通过 `wrangler secret put` 设置 `DATABASE_URL` 和 `AUTH_SECRET`；
8. 构建并部署 Worker；
9. 请求公开健康端点，确认数据库、迁移和管理员状态；
10. 打印 Cloudflare Dashboard 中仍需确认的域名和 Git 自动构建设置。

脚本不得把连接串或密码写入 Git、命令日志或普通 Wrangler vars。自动 Git 构建只负责 build/deploy，数据库迁移由版本升级前运行引导命令或 CI 迁移任务完成。`keep_vars: true` 继续保留，防止部署覆盖 Dashboard 中已有的运行时 secret。

## 14. 健康检查和可观察性

新增公开但不泄密的 `/api/health`：

```json
{
  "status": "ok",
  "storage": "postgresql",
  "database": "connected",
  "migrations": "current",
  "bootstrapRequired": false
}
```

异常时使用 503，并只暴露 `not_configured`、`unavailable` 或 `outdated` 等安全状态。Cloudflare 日志记录请求关联 ID、错误分类和耗时，不记录 `DATABASE_URL`、管理员密码、密码哈希或完整 SQL 参数。

## 15. 测试策略

实现遵循测试驱动开发，新增测试至少覆盖：

1. 运行模式选择：开发内存、开发数据库、生产缺库失败、生产数据库；
2. Memory 和 PostgreSQL 两套仓库契约；
3. 每个核心实体的 CRUD、字段映射和 API 响应兼容；
4. 两个租户使用相同业务编号或猜测 UUID 时仍完全隔离；
5. 并发报价号/订单号无重复；
6. 报价转订单、物流推进订单、客户删除保护等事务工作流；
7. 客户和产品导入的整批回滚、导出空库和租户过滤；
8. 空数据库迁移与旧 `companies/users` 数据库升级；
9. 管理员 bootstrap 幂等性和密码更新；
10. Docker Compose 配置、Cloudflare 引导脚本 dry-run 和 secret 泄露回归；
11. `/api/health` 在正常、未配置、不可达和迁移过期状态下的响应。

PostgreSQL 集成测试使用临时真实 PostgreSQL 实例，不能用 mock 代替 SQL 约束、事务和并发验证。总体新增代码覆盖率目标不低于 80%，并继续运行现有测试、lint、Next.js build、Cloudflare build 和 Wrangler dry-run。

## 16. 实施顺序

1. 建立运行模式、领域错误、请求租户上下文和异步仓库接口。
2. 完成正式迁移、数据库状态检查、管理员 bootstrap 和可选 seed。
3. 实现 Memory/PostgreSQL 仓库及共享契约测试。
4. 迁移认证和客户、产品 API，包括导入导出。
5. 迁移询盘、报价、订单、物流和单据事务工作流。
6. 迁移 Dashboard 及所有核心实体依赖调用方。
7. 强制生产数据库配置并增加健康检查。
8. 完成 Docker 一条命令部署和 Cloudflare 引导式部署。
9. 更新 README、环境变量示例、升级说明和故障排查文档。
10. 运行完整验证，审查 diff 和依赖安全结果后再提交和推送。

## 17. 验收标准

- Cloudflare 和 Docker 生产部署在重启、重新部署后仍保留六个核心模块的数据。
- 生产缺少 `DATABASE_URL` 时用户看到明确配置错误，不会看到演示数据或空白后台。
- 本地执行 `npm run dev` 且不配置数据库时，现有演示账号和演示数据仍可使用。
- 本地配置任意兼容 PostgreSQL 后，应用自动选择 PostgreSQL 模式。
- 新生产数据库默认没有演示业务数据；只有 `TRADEPILOT_SEED_DEMO=true` 才填充。
- 管理员 session 使用真实 UUID 用户和公司，所有核心 API 均按公司隔离。
- 客户、产品导入后可从数据库导出，重新部署后数据不丢失。
- 报价号和订单号在并发请求下不重复，跨公司可以独立编号。
- Docker 新用户可通过一个安装命令完成数据库、迁移、管理员和应用启动。
- Cloudflare 新用户可通过一个引导命令完成连接检查、迁移、secret、部署和健康验证，并在失败时得到明确修复步骤。
