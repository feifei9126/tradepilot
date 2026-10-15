# TradePilot SaaS 上线功能审计（2026-09-29）

> **结论：NO-GO / DO NOT SHIP 多租户 SaaS。** 当前适合作为单实例、受信任用户的 Docker 功能预览；不能将自助注册打开并对不同客户开放同一实例。页面可打开、构建成功不等于数据隔离、安全或生产能力已验收。

## 审计范围与方法

- 审计当前工作区（包含未提交的账号中心、AI 获客等更改）；本地 Docker `tradepilot-preview` 的 `127.0.0.1:3461`，未进行公网部署。
- 静态检查 34 个 Next.js `/app` 页面、57 个 `/api` 路由、认证代理、数据存储和 Compose；只读浏览器检查工作台、客户、询盘、报价、订单、产品、AI 获客、产品视频、个人中心。**没有**执行真实邮件发送、外部 AI/Firecrawl/LiveKit 调用、支付或跨租户渗透测试。
- `npm test`：84/84 通过；`npx tsc --noEmit`、`npm run build`：通过；`npm run lint`：0 error、10 warning（图片 alt/优化、effect 依赖、未用变量）。无会话 HTTP smoke：`/api/contacts` 与 `/api/ai` 返回 401，`/api/auth/register` 显示当前预览注册关闭；`/api/network` 返回 200 并泄露容器内网地址。
- 这是**代码/预览审计**，不是正式的安全渗透、性能压测、灾备演练、隐私合规或生产域名验收。现有测试大量直接调用 route/store，不能替代双租户端到端测试。

## 功能矩阵

| 功能 | 观察结果 | SaaS 判定 |
|---|---|---|
| 登录、个人资料、改密 | 登录保护和个人中心页面存在；改密校验原密码并以哈希保存 | **部分可用**；需会话撤销、账号状态和多用户验收 |
| 注册/工作区 | 配置 `DATABASE_URL` 后可创建公司和用户 | **阻断**；业务数据未按公司隔离，不能开放注册 |
| 工作台、客户、询盘、报价、订单、产品 | 页面加载，示例数据、基本 CRUD/API 和部分业务校验存在 | **演示级**；全局内存数据，不持久、不隔离 |
| 供应商、出货、物流、财务、单证、报表、消息 | 页面/API 已实现基础流程，均依赖同一 `store` | **演示级**；还需逐链路双租户及重启验收 |
| AI 营销、邮件工作台、AI 文案 | AI 调用依赖实例配置；收件箱/账号配置为本地草稿示例 | **需外部配置/非真实邮件收发**，需成本、配额和隔离 |
| AI 获客 | 人设/任务/线索有按工作区哈希文件；Firecrawl `/v1/search` 未配置时提示；可转客户 | **单实例试用**；自动搜索需 Firecrawl；转客户写全局 store；不自动对外发信 |
| 产品视频、语音客服 | 视频任务/Worker、LiveKit 入口存在 | **需配置并实测**；视频任务单文件共用，依赖外部服务、存储和资源限制 |
| API 配置中心 | `configAccess` 限制部署管理员；代理限制若干部署级服务 | **有保护**，`callConfiguredAI` 也限定部署工作区；尚无租户级 BYOK/配额 |
| 插件、导入导出、Webhook/绑定 | 有相关 UI/API；导出读取全局数据，Webhook 共用实例 secret | **阻断/待验**；租户权限、导入限额和第三方回调隔离未完成 |

## 页面/API 覆盖地图（静态盘点，不等于逐项端到端通过）

- CRM 主流程：`/app`、`contacts`、`inquiries`、`quotations`、`orders`、`products` 及其详情/新增页；对应 `dashboard`、`contacts`（含导入导出）、`inquiries`、`quotations`、`orders`、`products`（含导入导出）API。上述主列表中九个页面完成了浏览器只读加载检查。
- 履约与报表：`suppliers`、`shipments`、`logistics`、`finance`、`documents`、`reports`、`custom-fields`；数据取自全局 `store`，真实权限和持久化未验。
- 营销与消息：`leads`（AI 营销）、`prospecting`（AI 获客）、`email`、`messages`、`bind`，以及 `ai/*`、`email/*`、`webhook/incoming`、`bind/*`；获客任务自动搜索与邮件真实收发没有在线验收。
- 媒体与集成：`product-design`、`product-video`、`voice-agent`、`plugins`、`api-config`、`settings`，以及 `product-videos/*`、`livekit/session`、`firecrawl/*`、`ollama/*`、`plugins`、`api-config/*`；外部服务及渲染未作端到端实测。
- 账户与公共路由：`account`、`auth/*`、`network`、`build/status`；核查了登录保护与公开例外，但没有进行公网攻击面测试。

## 阻断与风险（证据 → 修复验收）

### P0：上线阻断

1. **业务数据跨租户共用且不持久。** `src/lib/store.ts:1,237,310,561,650,773-859` 是模块级示例数组、全局增删改与内存序号，数据对象没有 `companyId`；`src/app/api/contacts/route.ts:7,49`、`src/app/api/orders/route.ts:7,52`、`src/app/api/contacts/[id]/route.ts:10,58,77` 均直接读取/修改它。数据库 schema 虽有 `companyId`（例如 `src/db/schema/contacts.ts:4-6`），注册使用数据库（`src/lib/registration.ts:41-94`），但业务路由未接入。**验收**：所有业务实体持久化到共享数据库且每个查询/更新/删除/导入/导出以服务端 session 的 `companyId` 约束；两个租户 A/B 双向不可见、不可猜 ID 访问/修改；重启和双副本运行后仍一致；清理生产示例数据。
2. **视频、邮件等次级数据同样无租户隔离。** `src/lib/product-video/job-repository.ts:83-86` 使用单个 JSON 文件，`src/app/api/product-videos/route.ts:28-31,67` 全量列出任务/访问全局产品；`src/app/api/email/route.ts:22-67`、`src/app/api/email/accounts/route.ts:15-24` 为进程全局示例/草稿。**验收**：按租户持久化、授权每个任务及素材下载、重启/并发/双副本测试；邮件配置加密并接入真实收发或明确移除产品承诺。
3. **注册入口与存储模型矛盾。** `src/app/api/auth/register/route.ts`、`src/lib/registration.ts:41-94` 可在配置数据库后启用自助注册，但新租户登录后会读取上一条所述共用 CRM。**验收**：隔离测试通过前保持注册关闭/入口隐藏，不向公网开放共享实例；上线时仅以隔离后的数据库事务注册工作区。
### P1：生产前必须完成

4. **会话撤销/账号状态。** `src/lib/auth.ts:10,41-56` JWT 回调只在登录填入公司/角色，更新仅刷新姓名；`src/lib/account.ts:107-124` 改密码未使现有 token 失效；`src/lib/registration.ts:125` 登录查询没有检查 `isActive`。**验收**：禁用用户/改密/重置密码后旧会话失效；登录验证活跃状态，支持会话撤销和审计。
5. **角色与对象授权。** `src/proxy.ts:19-26` 主要按“已登录”放行普通 CRM API，未见统一角色/对象策略；仅部署级配置另有 `src/lib/api-config/access.ts:2-14` 管理员限制。**验收**：定义 owner/admin/member 等操作权限，服务端执行并做越权矩阵测试。
6. **单节点文件存储与并发。** `src/lib/prospecting.ts:36-67` 使用每工作区本地 JSON + 进程 Map；`src/lib/prospecting-discovery.ts` 的运行锁也在单进程。**验收**：迁移数据库/队列和分布式去重，两个副本并发更新/任务运行无丢失；备份恢复演练。
7. **Webhook/公开信息。** `src/app/api/webhook/incoming/route.ts:8-18,43-58` 使用实例级单一 secret 并写全局消息；`src/proxy.ts:7-14` 放行 webhook、`/api/network`、`/api/build/status`；`src/app/api/network/route.ts:4-31` 返回内网 IP/主机信息。**验收**：租户级 webhook 凭据与轮换、请求限速/重放保护；生产移除或保护网络诊断路由；代理与源站安全检查。
8. **真实服务与运营链路。** Firecrawl 搜索、AI、LiveKit、视频 Worker 需要单独配置与端到端验证；`src/lib/prospecting-discovery.ts:12-22` 会在未配置时拒绝搜索。尚未证明邮件实际 IMAP/SMTP、自动发送或付款/订阅/计费；不能据页面名称对外宣称可用。**验收**：真实集成环境的成功/失败/超时/重试/费用测试，营销发送的合规与退订流程，以及订阅、账单、租户停用等产品方案。
9. **AI 费用与租户产品化。** `src/app/api/ai/route.ts:11-23` 接收自由任务/消息；`src/lib/ai/configured.ts:9-16` 会调用 `configAccess()`，**当前已拒绝非部署工作区调用实例 AI**，不能把它描述成跨租户密钥泄漏。但部署管理员工作区未见统一调用预算/速率；未来开放租户 AI 时需要独立配额、输入上限、用量归属和密钥隔离。**验收**：受限主体可用而未授权租户 403；每租户/用户预算、并发、超时、账单与审计日志可实测。
10. **线上运维与安全基线。** `docker-compose.yml` 默认为回环地址但 `AUTH_URL` 默认 HTTP、本地 volumes；`redis` 的固定密码仅适于当前隔离 Compose 网络；`Dockerfile` 以 `node` 用户运行是正面措施。**验收**：公网域名 HTTPS、可信反向代理/Host、强凭据及 secret 管理与轮换、备份/恢复、日志与告警、资源限制、依赖扫描、负载测试、故障演练，生产与演示数据分离。

### P2：质量与体验

11. `npm run lint` 尚有 10 warning；补图片 alt、effect 依赖和未用变量。完善空状态、无障碍/移动端、业务输入与错误提示。
12. 补完整权限/租户/并发/恢复/外部服务契约的自动化测试，并在 CI 阻断回归；目前 84 个测试通过仅证明现有覆盖范围。

## 上线门槛 / 推荐顺序

- **第一阶段（必须）**：关闭共享实例注册与公开运营；迁移所有 `store`/邮件/视频/获客数据到持久化租户模型；统一授权。先写 A/B 租户 CRUD、导入导出、IDOR、后台任务与重启测试，再迁移 API。
- **第二阶段**：账号禁用/会话撤销、权限矩阵、租户级 AI 配额与费用、Webhook、密钥和资源隔离；对所有对外入口做速率/输入约束。
- **第三阶段**：真实集成、监控告警、备份恢复、支付/订阅（若收费）、隐私与营销合规、HTTPS 域名、压测和回滚演练。
- **发布门禁**：自动测试 + 双租户黑盒验证 + 部署与恢复演练全部通过；没有 P0/P1 开放项，再决定 SaaS 公测。当前仅可在不对外开放注册、单个受信工作区的本地 Docker 预览中演示。

## 演示视频说明

视频使用本地 Docker 浏览器的真实截图与中文旁白，展示工作台 → 客户 → 询盘 → 报价 → 订单 → AI 获客 → 产品 → 视频入口。截图是示例数据，不代表已连接客户真实数据或 Firecrawl/邮件/视频生产服务；视频结尾明确提示 SaaS 上线阻断。为避免泄露预览账号，截图中的顶栏邮箱已遮盖。视频文件不放入仓库，见本轮答复的本机产物路径。

---

## 本轮整改与验收结果（2026-10-07）

本轮按照上述审计中的第一阶段要求继续整改，重点完成 SaaS 多用户、工作区隔离、PostgreSQL 持久化、数据库管理和本地 Docker 验收。以下结果基于当前工作区代码和 `tradepilot-preview` 本地部署，不等同于公网生产验收。

### 1. SaaS 多用户与工作区管理

已加入以下能力：

- 工作区模型：平台管理员可以创建、停用和启用工作区；工作区停用后其成员不能继续登录。
- 成员角色：`owner`、`admin`、`member` 三种角色，管理操作在服务端执行，不依赖前端隐藏按钮。
- 成员生命周期：邀请成员、临时密码、首次登录强制改密、启用/停用、角色修改、密码重置和成员数量上限。
- 会话安全：修改密码、重置密码、角色变化、成员停用和工作区状态变化会使旧会话失效；重新启用工作区不会恢复已失效会话。
- 租户隔离：工作区、成员、CRM 记录、AI 获客数据和审计事件均绑定 `company_id`；服务端对成员 ID、记录 ID 和获客对象执行跨租户检查，已覆盖 IDOR 验收。
- 审计：工作区和成员管理动作写入 `audit_events`，便于追踪创建、停用、启用、改密和角色变更。
- 账户中心：个人资料、语言偏好、时区和修改密码已保存到 PostgreSQL JSONB；修改密码后旧会话不会继续有效。

对应入口和说明：

- SaaS 管理：`/app/saas`
- 团队管理：`/app/team`
- 个人中心：`/app/account`
- 使用说明：`docs/saas-multi-user.md`、`docs/account.md`

### 2. PostgreSQL 持久化与迁移

- Docker Compose 新增 PostgreSQL 16 服务、健康检查和独立 `db-init` 初始化服务。
- 数据库迁移采用顺序版本、checksum 校验和全局迁移锁；当前迁移记录表为 `tradepilot_migrations`。
- CRM、AI 获客、账户和工作区管理数据不再依赖进程内存或本地 JSON 文件；应用重启后数据仍可读取。
- CRM 记录以 `(company_id, kind, id)` 为主键，跨租户关联由复合外键和服务端检查共同阻断。
- 数据库不可用时 API 返回服务不可用，不回退到没有隔离能力的内存数据。
- 初始化账号不会隐式改变已有账号的角色、启用状态或个人设置；只有显式设置重置参数时才重置密码。

数据库配置的入门说明已写入 `docs/database-management.md`、`README.md` 和 `docs/docker-trial.md`，包括 PostgreSQL 环境变量、Compose 启动顺序、迁移、备份和恢复约束。

### 3. 数据库管理页面与备份恢复

已加入 `/app/database` 和 `/api/admin/database`，管理员可以查看：

- PostgreSQL 连接状态、数据库版本和迁移状态；
- 表、索引和数据量概览；
- PostgreSQL 容量/连接信息和 TLS 状态；
- 脱敏后的诊断信息。

页面没有开放任意 SQL 执行、在线清空数据库、危险恢复操作，也不会显示密码、密码哈希、sessionVersion 或完整连接串。备份与恢复脚本为：

- `scripts/db-backup.mjs`：PostgreSQL custom format，备份文件按 `0600` 保存；
- `scripts/db-restore.mjs`：只允许恢复到独立且为空的目标数据库，要求 `CONFIRM_RESTORE=I_HAVE_VERIFIED_THE_EMPTY_TARGET`，不使用 `--clean`，并以单事务执行。

本轮已完成一次真实备份恢复演练：备份当前预览数据库，恢复到独立目标库并校验迁移和关键数据量；对非空目标恢复进行了拒绝验证。演练结果为：`companies=3`、`users=5`、`crm_records=7`、`audit_events=27`、`migrations=5`。演练用独立数据库和归档已清理，不影响当前预览库。

### 4. AI 获客与 AI 营销数据

AI 获客的人设、任务、线索、线索转客户、任务锁和运行时限制已迁移到 PostgreSQL，并加入工作区隔离和跨租户 IDOR 防护。AI 营销、邮件草稿和账户配置也按工作区保存；真实 Firecrawl、SMTP/IMAP、AI 服务仍需部署方配置并做真实链路验收，不能仅凭页面存在就宣称已接通。

初学者说明已补充：

- `docs/ai-marketing.md`：AI 营销配置、使用步骤、密钥和外部服务边界；
- `docs/prospecting.md`：AI 获客的人设、任务、线索审核/转客户和 Firecrawl 配置；
- 页面内增加了配置提示、空状态和操作说明。

### 5. 自动化和黑盒验收

当前自动化结果：

- `npm test`：`113/113` 通过（运维与依赖链补强后的最终结果）；
- PostgreSQL integration：`15/15` 通过；
- `npx tsc --noEmit`：通过；
- `npm run lint`：`0 error / 0 warning`；
- Docker Compose 配置校验：通过；
- HTTP 黑盒验收：`76` 项通过。

HTTP 黑盒验收覆盖未登录保护、注册关闭、平台管理员登录、Origin/CSRF 和输入限制、双工作区创建与隔离、临时密码和首次改密、owner/admin/member 权限矩阵、成员配额、成员 IDOR、CRM 联系人、邮件草稿、AI 获客对象、成员/工作区启停、会话失效和数据库诊断脱敏。

### 6. 重启和本地 Docker 状态

重启预览应用后，账户名称/语言/时区、联系人、邮件草稿、AI 获客人设/任务/线索均保留；停用工作区的旧会话在重启后仍被拒绝，重新启用后仍需重新登录。

当前本地预览仅使用独立 Compose 项目 `tradepilot-preview`：

- URL：`http://localhost:3461`
- PostgreSQL：healthy
- `db-init`：Exited (0)
- TradePilot：运行中，绑定 `127.0.0.1:3461`
- video-worker：healthy

本轮清理了 HTTP 验收创建的临时工作区、测试数据、测试凭据和 session 文件，仅保留预览管理员工作区和预览账号。另一套 `tradepilot` 项目及其 `3460` 端口容器未修改；其容器指纹在验收前后保持不变。

### 7. 公网 SaaS 发布结论仍为 NO-GO

以上整改使本地 Docker 预览具备可演示的多用户和数据库基础，但**公网 SaaS 仍然 NO-GO**。以下生产阻断项尚未完成，不能宣称已达到商用上线标准：

- 支付、订阅和计费；
- 租户级 AI Key、预算、速率和用量归属；
- 真实 SMTP/IMAP、营销退订和合规流程；
- 租户级 webhook 凭据、轮换、重放保护和限流；
- Firecrawl、AI、LiveKit、视频等真实外部链路的成功/失败/超时/重试验收；
- 分布式限流、HTTPS、secret 管理、最小权限数据库账号；
- 监控、告警、依赖扫描、压测、灾备和回滚制度；
- 多副本 admin/config 文件一致性和 durable media/object storage；
- 更完整的对象级权限、端到端测试和生产数据治理。

在这些项目完成并通过独立的安全、性能、合规和灾备验收前，应继续关闭公网自助注册，只把当前实例作为本地或受控环境预览。

## 本轮运维与依赖链补强（2026-10-07）

本节是在 2026-09-29 基线审计之后的追加记录，不覆盖前文历史观察。

- 已增加受 `METRICS_TOKEN` Bearer 保护的 Prometheus `/api/metrics`、健康探针、CI、Dependabot 和[生产运维手册](production-operations.md)。这提供采集入口与发布规范，**没有**替运营方部署 Prometheus/Alertmanager/APM，也没有实际告警值班或灾备演练。
- CI 现在执行 lint、TypeScript、Next.js 生产构建、113 项单元/业务测试、隔离 PostgreSQL 租户集成测试，以及 `npm audit --audit-level=high`；安全扫描达到 High 会使工作流失败。测试数据库必须是 loopback 且以 `_test` 结尾。
- 清理锁文件内机器专属 `registry.npmmirror.com` 地址，全部解析地址改为官方 npm registry，并加测试防止镜像地址回归。Docker、CI 和开发文档统一从锁文件安装。
- 默认 `npm ci` 曾因 `next-auth@5.0.0-beta.32` 声明可选 Nodemailer peer 仅 `^7 || ^8`，而租户 SMTP 需要 Nodemailer 10 而失败。当前命令明确使用 `--legacy-peer-deps`；这是安装兼容性绕行且会关闭整体 peer 校验，不是上游兼容证明。TradePilot 未使用 Auth.js Email Provider。升级认证/邮件依赖时必须优先移除该绕行并重新跑安装和测试。
- Node 最低版本提升到 `22.22`，与当前 Cloudflare 开发依赖的 Node engine 要求一致；CI 固定使用 Node 22.22.0。
- 修正数据库集成测试中将最新 migration 硬编码为 `0005` 的过时断言，改由 migration 文件列表决定；对本地媒体路径加 Turbopack ignore 标注，避免动态 `resolve()` 导致构建追踪整个项目。

### 本轮验收证据

- `npm ci --legacy-peer-deps --registry=https://registry.npmjs.org`：通过。
- `npm run lint`、`npx tsc --noEmit`、`npm test`（113/113）：通过。
- `npm run build`：通过；复验确认动态媒体路径的全项目文件追踪 warning 已消失。
- `npm run test:db`：修正陈旧 migration 断言后 `15/15` 通过；使用独立临时 PostgreSQL 容器，不使用任何预览/生产数据库。临时容器和镜像已按精确名称清理。
- `npm audit`（官方 npm registry，2026-10-07）：全量依赖树有 **13 High、4 Moderate、0 Critical**；`npm audit --omit=dev --audit-level=high` 为 **0 vulnerabilities**，当前报告的问题来自开发/构建依赖链。全量审计门禁因此会让 CI 的 audit 步骤失败；不能把生产依赖审计为零解释成构建链安全。自动修复建议会跨主版本降级 Wrangler、OpenNext、ESLint/Drizzle 或 shadcn 等工具，未执行 `--force`；须逐个升级、做兼容验证后再解除阻断。公网 SaaS 仍 **NO-GO**。

本机执行环境为 Node `22.14.0`，低于项目声明的 `>=22.22`，因此 npm 会报告 `EBADENGINE`；本机 lint、类型检查、构建和测试虽通过，发布验收仍必须在 CI 所用 Node `22.22.0` 上重跑。以上 CI/自动化只覆盖代码和隔离测试库，不证明 SMTP/IMAP、支付、Firecrawl、AI、LiveKit、视频服务已经真实联调，也不证明 HTTPS、外部告警、负载或灾备达标。

## Stripe Webhook 处理补强（2026-10-07）

- Webhook 请求体改为流式 UTF-8 字节上限读取，超过 1,000,000 字节立即取消读取并返回 `413`，避免先把无限制请求体完整载入内存。
- 修正订阅状态映射：Stripe 的订阅生命周期事件名（如 `customer.subscription.created/updated/deleted`）不等于订阅状态；现在从订阅对象 `data.object.status` 读取状态，删除事件映射为 `canceled`。新增正向数据库迁移保留 Stripe 的 `unpaid` 状态；由于当前没有定义支付宽限期，只有 `trialing` / `active` 会在计费摘要中取得付费套餐，其余状态回落到免费套餐。
- 发票事件仅更新已存在订阅的状态，不再从通常没有套餐元数据的发票对象推导套餐或周期；缺少有效套餐 ID/周期的订阅快照不能创建或改写套餐归属。
- 新增流式超限、订阅生命周期、删除/欠款状态、发票状态更新、缺少套餐元数据及套餐资格等回归测试；增加 `0008_subscription_unpaid_status.sql` 正向迁移。
- 本轮在 Node `22.22.1`（本机 ARM64）下完成 `npm test`（`120/120`）、`npm run lint`、`npx tsc --noEmit`、`npm run build` 和 `git diff --check`，全部通过。机器上另有 Node `22.22.0` x64，但本机 ARM64 `node_modules` 中的 esbuild 原生二进制不匹配，无法用该 x64 运行时完成本地测试；CI 固定的 Linux x64 Node `22.22.0` 仍需由 CI 验证。

以上只是处理逻辑与单元测试补强，**未**连接 Stripe 测试/生产账户，也未完成 Checkout、付款失败/恢复、退款、取消、续费、争议、税务或真实 Webhook 重试的 sandbox 端到端验收。支付与订阅仍是公网 SaaS 发布阻断项，整体结论仍为 **NO-GO**。

---

## 全面复审（2026-10-07）：当前工作区的 SaaS 上线判断

> **最新结论：公网、多客户 SaaS 仍为 NO-GO。** 核心业务已不再是早期报告描述的“所有租户共用内存数组”：当前账号、CRM、获客与多项 SaaS 元数据已接入 PostgreSQL，并有独立数据库隔离测试。但认证滥用防护、共享服务费用、邮件合规、媒体主动内容、订阅权益执行和生产验收仍有阻断项。
>
> **本章节是 2026-10-07 的当前判断。** 前面的 2026-09-29 初审及历次补强记录保留为历史，不能把其中已整改的旧问题继续当作当前缺陷，也不能把“代码已补强”理解为生产服务已经验收。

### 1. 范围、证据等级与局限

- 审计对象：`/Users/mac/Documents/ChatGPT/tradepilot` 当前工作区，**包含既存未提交和未跟踪内容**，不是仅审计 GitHub 已发布版本或 HEAD。静态盘点为 **39 个 `/app` 页面、74 个 API route 文件**；数量不等于每条链路都做了端到端测试。
- 检查认证/Proxy、工作区上下文、CRM Repository 与关联约束、个人中心、多用户、数据库配置/迁移/备份、AI 获客/营销、计费、邮件、Webhook、媒体、外部集成、Docker、CI/依赖与运维说明。
- 证据分级：**代码确认**表示当前源码可定位到实现问题；**自动测试通过**只说明相应测试断言通过；**待生产验收**表示缺少真实提供商或部署演练证据，不等于已证明线上故障。
- 以 Node **22.22.1 ARM64** 完成 lint、类型检查、生产构建、120 项单元/业务测试及 15 项 PostgreSQL 集成测试。数据库复验使用全新 loopback 临时 `_test` 数据库，测试资源已清理，**没有访问预览/生产业务数据库**。CI 固定的 Linux Node 22.22.0 仍需由实际 CI 验证；宿主机默认 Node 22.14.0 低于项目 `>=22.22` 要求。
- 浏览器只读检查了 AI 获客、AI 营销、个人中心、团队、SaaS、数据库、邮件页面，没有观察到浏览器控制台错误；未执行账号变更、发送邮件、扣费、上传或业务写入。营销页面说明仅保存本机草稿、不自动投放；邮件页面仍提示该预览尚未接入真实收发。
- **3461 预览不是本轮最新源码镜像**：镜像创建于 `2026-10-06T22:06:04Z`，即北京时间 **2026-10-07 06:06:04**。预览未登录的健康路由返回 401，与当前源码的公开探针设计不一致。该观察只能证明镜像/源码版本不同，不能据此判定最新代码探针失效。本轮**未重建、未重启**预览。
- 最新生产构建另外使用随机本地端口、合成认证密钥和故意不可用的假测试数据库进行只读 HTTP smoke，临时服务已停止。没有向 Stripe、SMTP/IMAP、Firecrawl、AI、LiveKit、视频服务发起真实业务调用，也没有做公网渗透、生产压测、正式合规认证或异地灾备演练。

### 2. 本轮验收结果

| 检查 | 结果 | 解释 |
|---|---|---|
| `npm test` | **120/120 通过** | 包含业务、AI/Webhook/邮件/媒体/支付等已纳入测试的逻辑；不代表真实服务 E2E |
| `npm run test:db` | **15/15 通过** | 独立 PostgreSQL 验证迁移、工作区隔离、关联/并发约束、成员管理、会话撤销和故障关闭等 |
| `npm run lint` | 通过 | 本轮没有 lint 错误 |
| `npx tsc --noEmit` | 通过 | 类型检查通过 |
| `npm run build` | 通过 | Next.js 生产构建通过；没有观测到 Auth.js `MissingSecret` |
| 最新源码 `/api/health/live` | 200 | 本地进程存活探针可达 |
| 最新源码 `/api/health/ready` | 503 | 使用故意不可用的假测试数据库，按设计拒绝就绪；不是正式数据库故障证据 |
| 最新源码注册状态查询 | GET 200 | 查询状态成功，自助注册仍关闭；**没有成功提交注册** |
| 最新源码受保护 API | 401 | 未登录请求被拒绝 |
| 最新源码 `/api/metrics` | 503 | 合成环境未配置指标令牌，端点按设计禁用；不是已部署监控的证明 |
| 生产依赖 `npm audit --omit=dev --audit-level=high` | **0 vulnerabilities** | 仅生产依赖树的 registry 已知漏洞报告，不等于应用或供应链没有风险 |
| 全量依赖 `npm audit`（官方 npm registry） | **13 High、4 Moderate、0 Critical** | 是受影响依赖节点数，不是 17 个相互独立的应用漏洞；涉及开发/构建工具链，当前全量 CI audit 门禁会失败 |

依赖审计本轮 JSON 证据：`/tmp/tradepilot-npm-audit.json`、`/tmp/tradepilot-npm-audit-prod.json`。临时文件不是长期证据归档，发布时应将复验结果作为 CI artifact 保存。没有执行 `npm audit fix --force`；registry 提示的自动方案会跨主版本降级 Wrangler、OpenNext、ESLint、Drizzle 或 shadcn 等工具，不能直接套用。

### 3. 当前功能与上线状态矩阵

| 模块 | 当前实现/已验证能力 | 仍需完成的门禁 |
|---|---|---|
| 登录/个人中心 | 资料、语言/时区、改密、密码哈希、会话版本和账号禁用检查已有实现 | 生产示例凭据拦截、登录防暴力破解；管理员强认证策略 |
| SaaS 多用户/租户 | 公司/用户入库；平台与工作区管理分层；owner/admin/member 权限和会话撤销有数据库测试 | 双租户真实登录 E2E、邀请/找回密码/身份验证运营闭环；仍不开放自助注册 |
| CRM/履约/财务/单证 | Repository 按工作区访问 PostgreSQL；关联复合约束和若干业务幂等有测试 | 每个角色的列表、详情、导入导出、批量和下载链路 E2E；大数据量分页/性能验收 |
| AI 获客 | 人设、任务、线索/去重/执行状态入库；搜索、评分、转客户和话术草稿逻辑存在 | Firecrawl 共享额度/费用隔离、真实搜索与失败恢复；当前不能宣称无人值守生产闭环 |
| AI 营销 | 选品/渠道/AI 文案和使用说明存在；营销方案仍保存为浏览器草稿 | 方案租户级持久化、渠道授权/任务队列/投放结果回流；页面不是自动投放平台 |
| AI Key/用量 | 租户 Key 加密、脱敏；请求/Token 预留、事务锁、月统计已有实现 | 套餐权益必须驱动实际限额；费用定价/账单对账、模型实际 Token 统计与异常结算 |
| 支付/订阅/计费 | 套餐、Checkout 入口、Stripe 签名、事件幂等、状态投影和请求体上限已有实现/测试 | 乱序事件状态保护；购买、续费、失败恢复、取消、退款、发票/税务等 sandbox 生命周期 |
| SMTP/IMAP | 源码具有租户凭据加密、SMTP 发送、IMAP 同步、发送事件/幂等和抑制表 | 内网目标拦截、强制 TLS 策略、真实收发/断线/部分拒收验收；预览 UI 尚非真实邮件验收 |
| 邮件营销合规 | 退订令牌、抑制、同意事件和 one-click 头部存在 | 不能由客户端绕过营销判定；重新订阅需可验证授权；GET 不应直接退订；投产合规评审 |
| 租户 Webhook | 独立凭据、轮换/宽限、HMAC、时间窗和事件重放防护已有代码 | 当前接收端主要鉴权/记录，业务分发、重试/死信、版本契约和真实厂商联调未验收 |
| LiveKit/视频 | 集成入口、视频任务元数据/Worker、媒体持久化适配存在 | 多项路由仍仅平台管理员可用；租户使用授权、计费/并发、真实渲染及断点恢复 |
| 数据库管理 | 管理页只读诊断；连接/TLS 解析、迁移 checksum/连续性、备份/恢复脚本存在 | 运行/迁移账号最小权限分离、容量/锁验证、异地恢复与应用回滚演练 |
| 对象存储/媒体 | local/S3 适配、工作区资产记录、签名 URL、Range/HEAD/删除逻辑存在 | 主动内容安全、流式上传上限、真实 S3 权限/租户空间配额/孤儿对象清理及恢复 |
| 分布式限流 | 租户写入/昂贵 API 等使用 PostgreSQL 共享计数器 | 登录、兼容抓取入口和全租户供应商预算尚未统一覆盖；多副本压力验收 |
| 监控/扫描/发布 | live/ready、Bearer 保护 metrics、结构化日志、CI/Dependabot、运维 runbook 存在 | High 依赖处置、外部监控与告警送达、HTTPS/Secret 部署、目标负载和灾备演练 |

“已有实现”不等于“生产可承诺”。对初学者的说明应明确区分：草稿保存、模拟/未配置、真实发送、待提供商返回和最终业务完成。

### 4. P1：上线前必须关闭的代码与安全问题

#### P1-01：生产安装可能沿用公开示例管理员密码

- **证据（代码确认）**：`/Users/mac/Documents/ChatGPT/tradepilot/.env.example:6-8` 设置 `12345678`；`/Users/mac/Documents/ChatGPT/tradepilot/install.sh:57-62` 只替换空值及另外两个占位值，不拒绝此密码；`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/account.ts:20-26,60-67` 在尚无改密记录时可使用环境配置的管理员密码。
- **影响/前提**：运营方把示例复制到生产、没有主动改密且没有已保存密码覆盖时，公开已知凭据可能获得平台管理员权限。本轮没有验证现有预览是否仍使用该密码；用户此前要求的本机预览密码不应被擅自修改。
- **整改/验收**：生产启动/安装拒绝示例凭据及明显弱密码；首次配置使用独立随机密码或受控初始化，并强制首登改密。用合成环境测试“复制示例直接安装”“已有改密记录”“重复初始化不覆盖密码”三个场景。

#### P1-02：Credentials 登录未纳入应用级分布式滥用防护

- **证据（代码确认）**：`/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/auth/[...nextauth]/route.ts:1-2` 直接暴露 Auth.js handlers；`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/auth.ts:20-43` 直接校验凭据；`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/tenant-route.ts:10-18,30-36` 的限流只适用于包裹的租户路由，并不覆盖该登录入口。
- **影响**：公网登录可遭密码喷洒/凭据填充和密码哈希计算资源消耗。CSRF 或普通租户写入限流不能替代登录节流。[R5]
- **整改/验收**：IP 与账号两级共享计数、失败退避和可恢复锁定，避免容易被恶意触发的永久锁死；只信任明确配置的代理来源，日志不记录密码。跨两个副本验证累计失败能受限、账号正常恢复、无账号枚举和数据库故障时的安全行为。

#### P1-03：普通租户可消耗实例级 Firecrawl 资源，兼容入口绕过更严格边界

- **证据（代码确认）**：`/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/products/import/route.ts:8-15` 未使用 `withTenant`、平台权限或该包装器限流，直接抓取；`/Users/mac/Documents/ChatGPT/tradepilot/src/proxy.ts:44-60` 限制 `/api/firecrawl`，却不覆盖 `/api/products/import`。`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/prospecting-discovery.ts:13-20` 使用实例配置 Firecrawl Key，`/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/prospecting/route.ts:27-29` 可在租户任务中调用。
- **影响/边界**：这不是匿名接口；未登录仍被 Proxy 拒绝。但登录普通成员可通过兼容路径消耗共享服务额度。获客已有单任务冷却/租户请求限流，仍不等于供应商费用或套餐配额隔离。
- **整改/验收**：删除旧入口或执行与正式入口相同的权限、请求上限和成本预留；租户 BYOK 或平台统付 entitlement/额度台账二选一并明确。测试普通成员不可绕过，租户 A 超额不消耗 B 的预算，多副本并发不超分配。

#### P1-04：营销同意/抑制可由调用方绕过，重新订阅缺少收件人证明

- **证据（代码确认）**：`/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/email/route.ts:29,87-97` 由客户端 `marketing` 控制合规检查；`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/email/smtp.ts:24,29-38` 也据此决定退订信息。`/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/email/consent/route.ts:9-18` 接受租户成员提交任意邮箱的订阅状态；`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/email/compliance.ts:49-70` 的 `subscribed:true` 可清除该邮箱的有效抑制状态，没有收件人确认步骤。
- **影响**：同一营销内容改传 `marketing:false` 即不经过营销抑制检查，也不附退订链接；工作区自己声明订阅不能作为收件人授权的充分证据。这里是技术流程审计，不作具体法域合规结论。
- **整改/验收**：服务端固定营销活动/批量发送的用途，不信任布尔值来取消保护；事务邮件须另有受控、可审计的业务来源。采用可验证确认或经审核的授权证据导入，未经确认不得解除抑制。测试伪装事务邮件、普通成员重新订阅、重复退订和退订后再次发送均受控，合法事务通知另有明确策略。

#### P1-05：上传媒体可在应用同源以主动 HTML/SVG 内容返回

- **证据（代码确认）**：`/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/media/route.ts:23-29` 采用上传者提供的 `file.type`；`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/media-assets.ts:64-76` 保存该 MIME 并写对象；`/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/media/[id]/route.ts:28-35` 以该类型及 `Content-Disposition:inline` 返回，没有活动内容白名单或沙箱隔离。
- **影响/前提**：具有上传权限的成员可存入 HTML，诱导同工作区更高权限用户打开资产链接时，存在同源存储型 XSS 风险。`nosniff` 不会禁止已明确声明为 HTML 的内容执行；数据库租户隔离不能消除此类同源执行。当前没有实投恶意文件或验证跨租户攻击。[R2]
- **整改/验收**：按业务限制扩展名并检测实际内容；拒绝主动内容，或强制附件/无认证 Cookie 的独立媒体域名与合适的 CSP/sandbox。验证伪造 MIME、HTML、主动 SVG、双扩展名和正常图片/视频/文档；授权及 Range 下载不能回归。

#### P1-06：SMTP/IMAP 地址允许租户管理员触达服务端内网

- **证据（代码确认）**：`/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/email/accounts/route.ts:10-17,25-42` 仅校验主机字符串和 1–65535 端口；`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/email/smtp.ts:6-8`、`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/email/imap.ts:30-31` 使用其值直接连接，没有共享 Firecrawl URL 防护或同等内网阻断。
- **影响/前提**：工作区 owner/admin 可配置 loopback、私网或可重新解析至内网的主机，借测试/收发流程尝试探测和连接应用可达服务。协议限制降低部分利用方式，但不消除出站内网访问风险；未做真实内网探测。[R3]
- **整改/验收**：SMTP/IMAP专用目标策略、DNS/IP 分类、解析结果连接绑定和出站防火墙共同约束，覆盖 IPv4/IPv6/混合解析和 DNS 重绑定。多租户 SaaS 默认禁止内网目标；自托管内部邮箱需显式部署级白名单，不能由普通租户开启。验 loopback/私网拒绝、公网邮箱正常、TLS 身份验证不被连接绑定破坏。[R6]

#### P1-07：计费套餐显示配额，但 AI 执行不读取订阅权益

- **证据（代码确认）**：`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/billing/index.ts:56-81` 按订阅状态显示套餐及配额；`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/tenant-ai.ts:11-18,53-70,95-115` 由工作区管理员独立设置上限，AI 预留仅读取 `tenant_ai_settings`，没有接入套餐 entitlement。
- **影响**：购买/取消/欠费后的套餐变化不能可靠控制实际 AI 额度；免费租户与计费页显示的限额可能不一致。当前请求/Token 预算也不能直接当作货币成本预算或供应商账单。
- **整改/验收**：明确 BYOK 与平台统付的产品规则，建立服务端唯一权益来源；套餐硬上限与租户自设软上限取符合规则的有效额度。覆盖免费/试用/升级/降级/取消/欠费恢复、月切换、并发预留、失败结算和权限变更；页面与实际拒绝行为一致。

#### P1-08：Stripe event ID 幂等未防止不同事件乱序覆盖订阅状态

- **证据（代码确认）**：`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/billing/index.ts:199-238` 去重后直接 upsert/更新订阅状态；没有对对象快照的时序或已终止状态进行保护。
- **影响**：取消事件先处理、较早的 active 更新后到达时，后者仍可能覆盖取消结果。Stripe 不保证交付顺序，单个 event ID 幂等只能拦截同一事件重复，不能解决不同事件的乱序。[R1]
- **整改/验收**：按订阅串行处理并获取/对账 Stripe 权威对象状态，设计终态和权益投影规则；不能只加 `event.created` 比较就声称充分解决并发/同秒事件。以数据库测试复现 created/updated/deleted 乱序、发票失败/恢复乱序和重试，验证最终状态、权益及账单一致。

### 5. P1：发布门禁及真实链路缺口（与代码缺陷分开）

#### P1-09：构建/开发依赖的 High 风险仍阻断现有 CI 门禁

- **证据（registry 审计确认）**：全量 13 High、4 Moderate；受影响链包括 OpenNext/Wrangler/Miniflare、shadcn/ts-morph/glob、Next ESLint 和 Drizzle 开发工具链。`/Users/mac/Documents/ChatGPT/tradepilot/.github/workflows/ci.yml:54-55` 全量 `npm audit --audit-level=high` 不会因生产依赖为零而放行。
- **整改/验收**：逐链定位真正 advisory 与可触发条件，选择兼容的受修复版本，按锁文件重新安装并跑 lint/类型/构建/全部测试及 Cloudflare 路径（若作为支持目标）。不能降门槛或强制套用破坏性降级来制造通过结果；例外必须有风险评估、负责人、补偿措施和到期日。
- **安装兼容债务**：CI/Docker 使用 `--legacy-peer-deps` 绕过 Auth.js 对 Nodemailer 的 peer 声明。当前 tests 通过不等于所有 peer 组合受上游支持，升级时应优先取消绕行；未使用 Auth.js Email Provider不代表可忽略整个安装图的校验。

#### P1-10：支付、邮件、Webhook 和外部服务没有真实端到端验收证据

- **证据（验收缺口）**：源码/单元测试存在，但本轮没有真实提供商调用。Webhook 接收端 `/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/webhook/incoming/route.ts:24-31` 主要完成验证和记录，不代表业务事件已分发完成。LiveKit/视频等平台限制仍见 `/Users/mac/Documents/ChatGPT/tradepilot/src/proxy.ts:44-60`。
- **门禁**：分别使用专用 staging 租户、商户 sandbox、自有测试邮箱和受限额度，验证成功、失败、超时、限速、重复/乱序、重试与费用记录。支付必须覆盖购买、续费、失败恢复、取消/到期、退款及发票对账；邮件必须覆盖真正发送、收件人拒绝、IMAP 重连/游标和退订抑制；Webhook 必须覆盖轮换/重放和业务落库；视频必须覆盖实际资产持久化与权限。
- **验收资料**：供应商请求 ID、结果、租户账本/资产记录、脱敏日志、回滚或停用步骤及负责人。没有这些证据，不承诺“可自动获客、自动投放、稳定收款/收发”。

#### P1-11：公网生产安全和可靠性需要实际部署验收

- **证据（验收缺口）**：`/Users/mac/Documents/ChatGPT/tradepilot/docs/production-operations.md:35-75` 已列出 HTTPS、Secret、最小权限、监控、负载、灾备和回滚 runbook，但没有本轮执行/验收记录。
- **门禁**：生产域名 HTTPS/HTTP 跳转和安全 Cookie；运行/迁移数据库角色分离；独立 Secret Manager/KMS 或经审查的同等级受控存储；外部监控真实触发并送达告警；目标负载以上的压力/突增/恢复；异地 PostgreSQL+媒体+配置/密钥恢复及应用回滚。要求事先定义 SLO、RPO/RTO、容量和告警负责人，并记录实测结果，不推定开发机可承载多少客户。
- **本机环境提醒**：3461 预览绑定 `127.0.0.1`，另有不同的 TradePilot 容器将 **3460** 绑定 `0.0.0.0`/IPv6。后者并非当前预览；是否可从外部访问取决于宿主机网络/防火墙，本轮未探测或改变，运营方应单独确认用途和暴露范围。

### 6. P2：硬化、可靠性和覆盖改进

| 编号 | 证据与风险 | 建议及验收 |
|---|---|---|
| P2-01 上传内存上限不闭合 | `/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/media/route.ts:21-28` 缺失 Content-Length 按 0 处理，在文件检查前已 `formData()` 完整解析，随后再转 Buffer。默认媒体上限为 100 MB，并不限制所有 multipart 总开销/并发 RSS | 流式累计实际字节、限制文件数/字段/总请求和并发；网关 body/time 限额与应用限制共同生效。用合成 chunked 超限/伪造长度/并发上传验收，不在预览压测 |
| P2-02 GET 退订有写入副作用 | `/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/email/unsubscribe/route.ts:32-53` 的 GET 与 POST 都写入抑制，链接扫描器/预取可能误退订 | GET 展示确认，不改状态；明确 POST 执行，保留符合 RFC 8058 的免登录 one-click POST。测试扫描器 GET、有效/过期令牌、重复 POST 与抑制生效 [R4] |
| P2-03 CSV 公式与转义 | `/Users/mac/Documents/ChatGPT/tradepilot/src/app/api/products/export/route.ts:7-9` 将产品字段直接放入引号，未处理嵌入引号/换行或公式前缀 | 所有字段统一 CSV 序列化和公式防护；测试引号、分隔符、换行及 `= + - @` 等前缀，复查其余导出路径，不以外层引号代替公式防护 |
| P2-04 响应安全边界与 URL 配置 | `/Users/mac/Documents/ChatGPT/tradepilot/next.config.ts:12` 没有应用级 headers；`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/auth.ts:87-95` 的 Secure Cookie 依赖部署 URL 为 HTTPS | 明确由应用还是网关配置 CSP/frame/referrer/HSTS，检查真实域名最终响应；验证 TLS 终止、可信 Host/代理、Cookie 和 API 缓存，不宣称“无应用 headers 就必然无网关防护” |
| P2-05 加密主密钥轮换迁移不足 | `/Users/mac/Documents/ChatGPT/tradepilot/src/lib/tenant-secret.ts:3-26` 从配置/认证 secret 派生单一加密密钥，无 key ID/双读迁移；直接轮换可能使 AI、邮件等密文不可读 | 分离认证与数据加密密钥，设计带 key ID 的密文信封、先新写/双读再批量重加密/吊销的迁移及恢复；测试跨工作区 AAD、旧备份恢复与失败不覆盖密文 |
| P2-06 多副本与全数据备份边界 | `/Users/mac/Documents/ChatGPT/tradepilot/scripts/db-backup.mjs:11-16` 仅执行 PostgreSQL dump；管理员资料及实例配置仍分别见 `/Users/mac/Documents/ChatGPT/tradepilot/src/lib/account.ts:30-53`、`/Users/mac/Documents/ChatGPT/tradepilot/src/lib/api-config/store.ts:25-38` 的本地文件 | 明确单实例/多副本支持边界，处理共享配置的一致性/并发写入；DB、对象/Worker卷、应用配置与解密密钥分别备份。新环境恢复后逐项核对资产/账号/租户权限；浏览器草稿不能算服务端持久化 |
| P2-07 细粒度权限仍需端到端负向覆盖 | 客户负责人/团队/private/workspace ACL 已存在，见 `/Users/mac/Documents/ChatGPT/tradepilot/src/lib/contact-access.ts:48-98` 和 `/Users/mac/Documents/ChatGPT/tradepilot/src/lib/crm-repository.ts:60-68`；迁移没有 PostgreSQL RLS 策略 | RLS 缺失本身不是已证明泄露，但当前主要依赖应用层隔离。补两租户×三角色×私有/团队/共享客户的真实 HTTP/浏览器测试，覆盖关联业务、统计、搜索、导入导出、邮件和下载；评估 RLS/最小权限作纵深防御，不把现有集成测试说成全部路由已验收 |

### 7. 数据在哪里，以及数据库配置的审计结论

**不是所有数据都在数据库。** 当前需要以下独立持久化与备份边界：

| 数据 | 当前落点 | 审计说明 |
|---|---|---|
| 公司、租户用户、密码哈希、角色/偏好/会话版本 | PostgreSQL `companies` / `users` | 用户密码不是明文存入业务记录；部署管理员是下一行例外 |
| 部署管理员资料、偏好和改密记录 | 应用数据目录 `admin-account.json` | 独立本地文件；没有记录时仍可使用初始化环境密码 |
| CRM、履约、单证、消息、邮件/账号参数、获客任务与视频任务元数据 | PostgreSQL `crm_records` / `crm_record_links` / `crm_counters` 等 | 工作区访问控制和复合关联约束；元数据不是媒体二进制 |
| 租户 AI Key/用量、Webhook 凭据/事件、限流计数、套餐/订阅/支付事件、邮件凭据/同意/抑制 | PostgreSQL 独立 SaaS 表 | 敏感 Key/邮箱密码使用密文；仍依赖外部解密主密钥 |
| 实例 API 配置 | 应用数据目录 `ai-config.enc.json` | 加密文件而不是租户配置表；共享费用和多副本一致性需另治理 |
| 媒体/生成视频/封面 | local/S3 对象或 Worker 数据卷；DB `media_assets` 保存元数据 | 仅恢复数据库不能恢复媒体；S3 私有策略和生命周期未真实验收 |
| AI 营销方案及部分页面未提交草稿 | 当前浏览器 localStorage，例如 `tradepilot_campaign_draft` | 不跨浏览器自动同步，清理浏览器会丢失；不能对客户承诺云端保存 |
| 环境配置、AUTH_SECRET/配置解密密钥、证书 | `.env`/运行环境或部署 Secret 管理 | 不应和数据库 dump 共用无保护备份、不得提交仓库或传给前端 |

数据库配置已统一解析：`/Users/mac/Documents/ChatGPT/tradepilot/src/db/config.ts:1-8` 与 `/Users/mac/Documents/ChatGPT/tradepilot/scripts/database/config.mjs` 供 Web/迁移/备份等共用。默认 Compose 使用 Docker 内网 `postgres`、离散 `PG*` 参数和持久卷，**不映射数据库公网端口**；外部库应为 Web 与迁移同时配置同一连接、验证证书的 TLS 和 CA 挂载。不是只修改一处 `DATABASE_URL` 就能让现有 Compose 改用外部库。

初学者完整配置说明仍在 `/Users/mac/Documents/ChatGPT/tradepilot/docs/database-management.md`。上线前必须：运行/迁移角色分离、备份权限与异地保存、恢复至新空库演练；禁止为了换配置运行 `docker compose down -v`。旧版内存/文件示例不会自动正确迁移到不同客户名下。

### 8. 已具备的正向控制（应保留并扩展）

1. 工作区 `AsyncLocalStorage` 上下文与 fail-closed Repository；数据库不可用不回退到共享内存“假成功”。核心隔离、相同 ID 独立、跨租户关联拒绝及并发业务约束有独立 PostgreSQL 测试。
2. 公司/账号状态与会话版本检查；改密、重置、禁用和角色变化有撤销测试，管理写入重新检查权限并留审计记录。
3. 迁移 checksum、连续历史、并发锁与事务；拒绝修改已执行迁移，最新迁移包含 `0008_subscription_unpaid_status.sql`。
4. AI/邮件/Webhook 密文使用 AES-GCM 与租户/用途 AAD；公共响应脱敏；AI 额度预留与分布式限流避免只依赖进程本地计数。
5. Stripe 回调签名/时窗、流式请求体上限及 event ID 幂等已有测试；租户 Webhook 已有轮换/宽限、HMAC、时间窗及重放检查。**不要把这些安全控制当作业务生命周期验收。**
6. metrics 使用独立 Bearer 凭据；未配置时禁用，正常业务日志避免记录正文/密钥；备份文件按私有权限创建，恢复显式目标且拒绝非空库。

### 9. 建议整改顺序与最终验收单

| 顺序 | 建议负责方向 | 工作与关闭条件 |
|---|---|---|
| 第一批：安全边界 | 平台/认证/后端 | 关闭 P1-01～P1-06；为默认密码、登录喷洒、兼容抓取越权、营销伪装/重新订阅、主动媒体与内网邮箱分别补负向回归测试 |
| 第二批：收费闭环 | 计费/AI/集成 | 关闭 P1-07、P1-08；套餐统一权益源、乱序权威状态对账、AI/邮件/抓取成本台账；用 Stripe sandbox 跑完整订阅生命周期并保留证据 |
| 第三批：真实业务与数据 | 邮件/获客/媒体/权限 | 完成 P1-10 和 P2 对应硬化；真实提供商成功/失败/超时验收；完整双租户三角色 E2E；持久媒体及跨重启/恢复校验 |
| 第四批：发布与运维 | 构建/安全/运维 | 关闭 P1-09、P1-11；兼容升级后 CI 全绿，HTTPS/Secret/最小权限、告警送达、压测和异地恢复/回滚有书面记录与负责人 |

最终放行不能只看页面或测试总数，至少同时具备：

- [ ] 所有 P1 关闭或有被正式批准、限时且不违反现有发布门禁的例外；不能将已知公共弱凭据、同源主动内容或邮件抑制绕过作为常态发布。
- [ ] 固定支持版本/架构与锁文件可重复安装；lint、类型、构建、120+ 回归测试、隔离 PG 与新增安全 E2E/多副本测试通过，依赖门禁通过。
- [ ] 两个真实登录的 staging 租户按三个角色验证业务读写/导入导出/关联/媒体，停用/改密/数据库故障后 fail closed，权限结果可审计。
- [ ] 支付/权益/预算、邮件/退订、Webhook/轮换及所有承诺的供应商链路成功与失败均有可重现证据；未承诺的功能明确禁用并标示。
- [ ] 生产域名 HTTPS 与安全 Cookie/响应策略已检查，Secret 和备份最小权限可追溯，告警能真实送达负责人。
- [ ] 目标容量/延迟/错误率、供应商费用上限与停用机制已测试；异地恢复到新环境、完整媒体/密钥与兼容应用回滚实测满足约定 RPO/RTO。

**本轮变更范围：只在本报告末尾追加当前复审结论。没有修复业务代码、修改凭据、重启/重建现有 Docker、发送邮件、执行付款或迁移正式数据库。** 既存工作区改动保留不动。

### 10. 官方参考（本轮核对，不替代本项目实测）

- [R1] Stripe《Webhooks》/ Event ordering、Duplicate events：事件交付不保证顺序；不同事件与重复事件需要分别处理。`https://docs.stripe.com/webhooks`
- [R2] OWASP《File Upload Cheat Sheet》/ Content-Type、文件类型与存储位置：客户端声明的类型不能作可信依据，应限制上传类型并隔离活动内容。`https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html`
- [R3] OWASP《SSRF Prevention Cheat Sheet》/ DNS/IP 与 Network Layer：校验地址与出站网络防护需组合，避免 DNS 重绑定及绕过。`https://cheatsheetseries.owasp.org/cheatsheets/SSRF_Prevention_Cheat_Sheet.html`
- [R4] RFC 8058，Sections 1/3/4：one-click unsubscribe 使用 POST，文档专门讨论自动抓取 GET 导致误退订的问题；还要求相关头部获得有效 DKIM 签名。当前有 one-click 头部不证明发件服务已完成 DKIM/投递验收。`https://www.rfc-editor.org/rfc/rfc8058.html`
- [R5] OWASP《Authentication Cheat Sheet》/ Login Throttling：登录应防范暴力破解、凭据填充与密码喷洒，设计账号级节流并兼顾锁定 DoS 风险。`https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html`
- [R6] Nodemailer《SMTP transport》/ TLS：`secure:false` 允许机会式 STARTTLS，而 `requireTLS` 用于要求升级；配置“证书校验开启”并不等于所有租户连接均强制 TLS。`https://nodemailer.com/smtp`

## P1-01～P1-08 代码整改与隔离验证（2026-10-07）

**当前结论：8 项代码整改已实现并通过隔离回归；不等于生产放行，公网 SaaS 仍为 NO-GO。** 本节更新前文「全面复审」P1-01～P1-08 的当前整改状态，保留原发现及历史证据不变。P1-09～P1-11、真实 staging 验收和下述边界仍未关闭。

### 1. 逐项整改记录

| 编号 | 本轮代码措施 | 隔离验证与当前状态 |
|---|---|---|
| P1-01 管理员凭据 | 新安装随机生成初始密码；production 初始化/认证/启动统一执行至少 16 位、两类字符及弱密码拒绝策略。已保存哈希优先，不被环境变量重置；首次登录强制改密。损坏/非法管理员记录拒绝回退，生产管理员不能继续用历史弱密码登录。 | 覆盖公开示例/弱密码、已保存强密码优先、首次改密限制，以及损坏 JSON/null/array/非法哈希等记录。代码及隔离验证通过；旧预览需先按个人中心升级说明处理弱密码，本轮未修改现有密码。 |
| P1-02 登录滥用 | 密码计算前在 PostgreSQL 原子预留账号/IP 尝试；跨副本共享窗口和递增退避，拒绝不持续延长锁定。未验证来源共用桶，仅明确配置的可信代理头与共享 Secret 匹配才接受真实 IP；数据库故障拒绝认证，不回退内存。 | 三个独立子进程共享账号限额；覆盖退避/窗口恢复、100 个不同账号的 IP 喷洒、伪造代理头与断库 fail-closed。代码及隔离验证通过；实际反向代理信任链仍需部署验收。 |
| P1-03 Firecrawl 租户边界 | 搜索与产品抓取只使用工作区加密 Cloud Key 和固定官方端点，不回退实例 Key。两项业务共用 UTC 日预算，成功/失败/pending 均计次；租户和平台上限取小值。正式预览与兼容产品导入入口统一租户上下文、平台权限、8,000 字节正文上限和昂贵接口限流；公开无凭据 HTTP(S) URL 先验证，再预留预算。 | 覆盖两个工作区 Key 隔离、无实例回退、成员伪造请求体仍拒绝、两个产品入口共用预算、失败计次、429/503 保留、私网 URL/正文超限不消耗供应商额度；三个独立子进程竞争预算及 UTC 日切换通过。仅 fetch 替身，没有真实供应商调用。 |
| P1-04 邮件同意与抑制 | 通用发送一律按营销执行，`marketing:false` 不能绕过。工作区成员/管理员不能代填同意或直接解除抑制；使用邮箱确认的 double opt-in，随机令牌哈希存库、绑定租户/邮箱、30 分钟有效且单次使用，明文令牌只通过固定确认邮件交给收件人。订阅/退订 GET 只展示表单，POST 才改状态；退订撤销确认并使旧挑战失效。 | 覆盖营销伪装、直接重新订阅、自报同意、扫描器 GET、令牌跨租户/过期/单次、确认邮件失败、确认与退订并发。邮件中心新增无令牌的「复制订阅申请链接」，链接本身不是同意证明。代码及隔离验证通过；真实 SMTP 投递、DKIM 和法域合规未验收。 |
| P1-05 主动媒体 | 上传同时校验 magic bytes、后缀与 MIME，拒绝 HTML/SVG/XML/脚本及伪装文件。验证后的图片/视频可 inline，PDF 强制下载；未验证历史记录统一 octet-stream、attachment、sandbox/nosniff。S3 签名下载覆盖主动 MIME/disposition；multipart 先按实际读取字节限制再解析，不能只信 Content-Length。 | 覆盖主动内容/伪装、chunked/虚假长度超限、租户隔离、Range/HEAD 和历史内容安全下载；S3 响应头覆盖使用无网络替身验证。代码及隔离验证通过；不是直接流式上传 S3，仍为有界内存缓冲。 |
| P1-06 邮箱 SSRF/TLS | 保存与连接前检查全部 DNS 地址，拒绝本机/私网/metadata/保留地址；数值 IP 连接，保留原 hostname 的 TLS 证书校验/SNI。SMTP 仅 465 TLS 或 587 强制 STARTTLS，IMAP 仅 993 TLS 或 143 强制 STARTTLS。内网例外只可由部署层指定精确主机名→RFC1918 IPv4，不能通配符/loopback/metadata。 | 覆盖混合 DNS、IPv4/IPv6/mapped 私网、危险端口/TLS 降级及保存前拒绝、不写入凭据；同时补强 Firecrawl 十六进制 mapped IPv6 检测。代码及隔离验证通过；真实邮箱握手与出站防火墙仍需部署验收。 |
| P1-07 AI 套餐权益 | 计费展示与租户 AI 执行读取同一服务端权益源。仅有效 active/trialing 具有相应付费权益，失效/欠费等降为 free；停用/paused/closed/AI 关闭有效限额为 0。有效额度取套餐、平台硬上限、工作区自设预算的最小值；公司锁串行预留，failed/过期 pending 保守计预算，输出 clamp 一致。 | 覆盖订阅状态/有效期、免费降级、套餐/平台限制、停用、并发预留、失败及过期 pending。租户 AI 就绪状态只读自身 BYOK 和有效额度，页面指向「AI 用量」，不借用实例 Key。代码及隔离验证通过；真实支付权益联动仍待 staging。 |
| P1-08 Stripe 乱序 | 相关事件按 subscription/customer/company 串行化，读取 Stripe 当前 subscription 做权威对账，不按回调快照/到达次序猜状态。event ID 幂等且同 ID 不同 digest 拒绝；读取失败回滚收据以便重试。按服务器 Price catalog 匹配套餐，不信 metadata.plan_id；拒绝跨租户归属及已终止订阅复活。 | 覆盖旧/同秒/发票乱序、取消后复活、跨租户绑定、失败重试与未映射 Price。代码及隔离验证通过；供应商数据来自可控替身，尚未通过真实 Stripe sandbox 的订阅/续费/退款/发票验收。 |

主要实现定位：

- 管理员/登录：`scripts/security/admin-policy.mjs`、`src/lib/account.ts`、`src/lib/auth.ts`、`src/lib/login-security.ts`、安装/初始化/启动脚本。
- 获客/抓取：`src/lib/tenant-discovery.ts`、`src/lib/prospecting-discovery.ts`、`src/lib/firecrawl/preview-route.ts`、`src/app/api/firecrawl/preview/route.ts`、`src/app/api/products/import/route.ts`。
- 邮件：`src/lib/email/opt-in.ts`、`src/lib/email/compliance.ts`、`src/lib/email/sending.ts`、`src/lib/email/network-policy.ts`、SMTP/IMAP 接入与订阅/退订路由。
- 媒体：`src/lib/media-content.ts`、`src/lib/media-assets.ts`、`src/lib/object-storage.ts`、媒体路由。
- 权益/计费：`src/lib/billing/entitlements.ts`、`src/lib/billing/index.ts`、`src/lib/tenant-ai.ts`、`src/app/api/api-config/status/route.ts`。

### 2. 数据库迁移与升级影响

新增 `scripts/database/migrations/0009_audit_code_security.sql`，并更新 `src/db/migrations.ts` manifest。新增登录共享桶、工作区 Firecrawl 配置/使用记录、邮件确认挑战、媒体验证类型、营销确认时间及订阅事件/权威对账字段。

```text
SHA256 0009_audit_code_security.sql
02c9aedc789b4ef152d489519401e8e8a26b1d060e473773d6442f9f0cb38154
```

- 本轮迁移仅应用于 `127.0.0.1:55434/tradepilot_audit_test` 独立测试库，**没有迁移或清理业务数据库**，没有修改已应用的历史迁移。
- 旧营销同意没有 `confirmed_at` 时不能视作收件人已确认，需重新完成邮箱确认；不会把旧记录静默升级成合法营销同意。
- 旧媒体没有验证类型时强制下载，不删除历史文件。S3 桶仍须私有，不能靠应用签名头保护公开对象。
- 真正升级前备份数据库、Web/Worker 媒体卷、加密配置、原密钥与兼容旧镜像，先在 staging 验证迁移/旧数据行为。历史弱管理员密码先按 [个人中心升级说明](account.md#生产管理员与升级注意事项) 安全处理，不能删除管理员文件或绕过强密码策略。

### 3. 冗余清理与配置说明同步

- 删除业务搜索/抓取的实例配置 fallback；搜索回调和 Firecrawl Key 改为显式传入，避免隐式共享凭据。
- 删除 Stripe 按 invoice/事件快照推测状态的旧分支，统一权威 subscription 对账。
- 产品抓取弹窗由 **714 行精简为 242 行**，移除不再适用的实例 Docker 部署/轮询/命令复制/后台健康探测；保留工作区配置说明、抓取预览、确认入库。独立平台诊断与 CLI 部署能力保留。
- 同步 AI 就绪状态、首页/客户导入/询盘/报价/邮件/消息/订单/产品等配置提示：普通工作区引导「AI 用量」，平台管理员引导实例 API 配置中心；Firecrawl 业务引导工作区获客设置。
- 补齐 `.env.example`、Compose 变量透传，以及 README、API 配置、Docker 试用、AI 获客/营销、个人中心、数据库管理和生产运维说明，明确预算只是技术上限，不是供应商货币账单。
- 保留既有工作区改动及前轮冗余组件删除，不恢复已删除组件，不删除 `next-auth.d.ts`，不做无关依赖升级或 `npm audit fix --force`。

### 4. 本轮验证证据

执行版本：**Node 22.22.1 / Next.js 16.4.0**。数据库测试显式提供 `TEST_DATABASE_URL`，测试工具只接受 loopback 的 `*_test` 数据库，不回退业务 `DATABASE_URL`。生产构建/Compose 模板校验使用合成 Secret 与隔离配置，不打印真实 env。

| 验证 | 结果 | 证据 |
|---|---|---|
| `npm run lint` | 通过，无错误/警告 | `/tmp/tradepilot-audit-final-code.log` |
| `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` | 通过 | 同上，最终串行检查命令退出 0 |
| `npm test` | **129/129**，0 failed、0 skipped | 同上；安全基线见 `tests/business/audit-security.test.ts` |
| `npm run test:db` | **38/38**，0 failed、0 skipped | `/tmp/tradepilot-audit-final-database.log`；新增安全集成文件 `tests/database/audit-security.integration.ts` 含 23 项 |
| `npm run build` | Next.js 生产编译、类型检查与页面生成通过 | `/tmp/tradepilot-audit-production-build-final.log` |
| `docker compose --env-file /dev/null -f docker-compose.yml config --quiet` | 使用合成必需变量，退出 0 | `/tmp/tradepilot-audit-compose-check.log`；只是模板校验，不代表容器部署通过 |
| `git diff --check` | 通过 | 本轮最终变更检查 |

复跑代码检查可使用符合项目要求的 Node：

```bash
npm exec --yes --package=node@22.22.1 -- sh -c \
  'npm run lint && npx tsc --noEmit --noUnusedLocals --noUnusedParameters && npm test'
# test:db 必须另建独立本地 *_test 库，并显式设置 TEST_DATABASE_URL；不能指向业务库。
```

**证据边界：** 38 项为「数据库/安全集成测试组」，主要使用真实隔离 PostgreSQL，也包含无网络 S3 签名安全测试；HTTP 路由测试直接调用 route 和可信工作区上下文，供应商采用合成事件/fetch 替身。三个独立子进程验证了登录与 Firecrawl 配额跨进程共享，但不是完整多 Web 副本 E2E。没有真实浏览器双租户三角色验收，也没有真实 SMTP/IMAP、Stripe、Firecrawl、AI、LiveKit 或外部视频服务调用；不能仅据测试总数承诺生产闭环。

### 5. 部署状态、保留风险与下一步

- `http://localhost:3461` 的预览仍运行旧镜像；**本轮没有重建/重启现有 Docker、修改试用密码、发送真实邮件、支付扣款或启动生产 Worker**。源码修改尚未部署，旧页面不会自动体现本轮安全策略。
- 本轮隔离测试 PostgreSQL 容器与自建构建临时目录验证后清理；不动既有预览、其他实例或旧审计容器。`/tmp` 日志是本机临时证据，长期验收需归档脱敏日志与供应商请求 ID。
- **P1-09 未关闭**：本轮没有处理依赖安全升级或改变现有 CI High 门禁，也没有把历史依赖统计冒充最新扫描结论。
- **P1-10 未关闭**：真实支付生命周期、邮箱投递/IMAP、Webhook 业务分发、获客/AI/语音/视频仍需专用 staging 账号和受限额度验收。
- **P1-11 未关闭**：真实 HTTPS/安全 Cookie、Secret 管理、运行/迁移角色分离、告警送达、压测、异地恢复及回滚仍需实测和负责人签字。
- **P2 及产品规则仍需完善**：媒体为有界缓冲；租户 AI 预留/Firecrawl 请求数不是精确费用台账；平台管理员的实例文本 AI 不受租户预算约束；邮件/视频/成员数等套餐权益尚未全面统一；不能撤回已经交付供应商的在途邮件；客户权限仍需完整关联资源 E2E。

下一步建议先处理 P1-09 的兼容依赖修复与 CI，再在独立 staging 执行 P1-10 的真实业务验收和 P1-11 的生产运维演练。**在这些门禁满足前，保持 NO-GO，不开启公网自助注册或把本地试用直接作为商用站点。**

## Docker 本地升级准备与隔离启动验证（2026-10-08）

**状态：新版镜像已构建并完成隔离启动检查，尚未替换 3461 预览。** 用户要求将整改代码部署到本地 Docker；升级预检发现既有平台管理员仍使用 8 位弱密码，新 production 策略会拒绝该密码。已向用户询问是否允许更换为随机强密码，在获得确认前不改变凭据、不重建现有预览容器。

- 针对 `tradepilot-preview` 备份 PostgreSQL、Web 数据、Worker 媒体、实际私有 env/解析后配置，并保留旧 Web/Worker 镜像回滚标签。备份位于 `/Users/mac/Documents/ChatGPT/tradepilot/backups/preview-before-audit-deploy-20261008-090907`，目录 0700，文件 0600；包含敏感信息，禁止提交 Git 或公开分享。
- 用备份恢复到独立、无宿主机发布端口的临时 PostgreSQL，再执行待升级 `0005`～`0009`；10 个迁移就绪，原用户凭据/偏好/角色/启用状态在演练中保持一致。现有 3461 的真实数据库未迁移，仍为 `0000`～`0004`。
- 当前源码成功构建 `tradepilot-preview-tradepilot`、`tradepilot-preview-db-init`、`tradepilot-preview-video-worker`，分别保留 `audit-20261008` 标签。构建日志：`/tmp/tradepilot-preview-docker-build-20261008.log`；迁移演练日志：`/tmp/tradepilot-preview-migration-restore-check-20261008.log`。
- 新镜像使用合成 Secret 和隔离恢复库启动；`/api/health/live`、`/api/health/ready`、`/auth/login` 为 200，未登录的业务/工作区/账号/管理接口为 401。镜像运行版本为 Node **22.23.3**、Next.js **16.4.0**。本轮没有真实供应商调用或付费，也没有通过真实浏览器登录来证明全部业务闭环。
- 隔离容器及专用网络已清理，候选/回滚镜像与备份保留；运行预览镜像、原 env 和现有密码均未改变。**完成构建/演练不能写成已上线新版**；待用户确认密码处理后，才执行真实迁移、容器切换及登录/健康检查。
- P1-09～P1-11 的生产门禁不因本地 Docker 构建成功而关闭，公网 SaaS 结论仍为 NO-GO。

## GitHub 提交前验证（2026-10-09）

本轮按用户要求准备将当前成果推送到 `feifei9126/tradepilot` 的 `codex/ai-lead-workbench` 分支，不直接覆盖 `main`；这不是 Docker 切换或公网 SaaS 发布。

- 使用 Node **22.22.1** 重新执行 `npm run lint`、`npx tsc --noEmit --noUnusedLocals --noUnusedParameters`、`npm test`，全部通过，普通回归 **129/129**；证据：`/tmp/tradepilot-github-prepush-20261009.log`。
- 使用单独的 loopback `*_test` PostgreSQL tmpfs 容器重新执行 `npm run test:db`，数据库/安全集成 **38/38**，随后使用合成 Secret、独立数据目录执行 Next.js **16.4.0** 生产构建通过；临时数据库容器和构建数据目录已清理，不动业务数据库或已有 Docker 预览。证据：`/tmp/tradepilot-github-prepush-db-20261009.log`、`/tmp/tradepilot-github-prepush-build-20261009.log`。
- 全量 `npm audit --json` 的本轮结果为 **12 High、4 Moderate、0 Critical**，退出 1；证据：`/tmp/tradepilot-github-npm-audit-20261009.json`。这是当前锁文件/registry 返回结果，不改写前文历史统计。现有 CI 仍执行 `npm audit --audit-level=high`，**本轮没有降低门槛或用强制依赖修复掩盖风险**。
- 提交前核验真实环境值与常见 Key/Token/私钥特征；候选源码/文档未发现匹配的实际密钥。私有 `.env*`、`data/`、`backups/`、数据库 dump 与 `.next`/`node_modules` 不提交；公开示例配置和隔离测试值不是可用于线上服务的秘密。
- 现有预览管理员密码没有改动，3461 未切换新镜像。本轮没有真实发信、付款或外部供应商调用。P1-09～P1-11 仍未关闭，公网 SaaS 继续保持 **NO-GO**。

## 本地账号轮换与受控试用注册（2026-10-10）

本节记录后续按用户明确要求完成的本地 Docker 账号轮换和受控注册；不改写以上历史状态。当前预览运行新版镜像，公网 SaaS 仍是 **NO-GO**，注册开关只在私有本机 `.env.preview` 启用。

- 将活动部署管理员登录邮箱改为用户指定邮箱，显示名设为 `Xiaofei9126`。活动数据库中的旧 `preview@tradepilot.local` owner 行已删除；原 `tradepilot-admin` 工作区保留，由 Compose `db-init` 用新管理员邮箱重新初始化 owner。用户记录核验为旧邮箱 0、新邮箱 1、工作区 1。
- 管理员新密码保存在 `.env.preview`（0600）供部署初始化；`/app/data/admin-account.json` 仅保存 PBKDF2-SHA256 加盐哈希，验证哈希与当前配置相符。会话版本已轮换，旧登录会话失效。登录页不再预填账号/密码；开发认证、初始化 seed 和启动脚本不再包含旧演示账号或密码回退，也不向终端打印管理员密码。
- 自助注册通过 `TRADEPILOT_SELF_REGISTRATION` 显式控制：Compose/`.env.example` 默认 `false`，本机 `.env.preview` 为 `true`。注册 POST 需要同源 JSON，实际 body 有上限；每来源每小时 30 次、每邮箱每天 5 次。注册密码要求 12–128 位、至少两类字符和 8 个不同字符。每个新邮箱创建一个独立 workspace owner；这**不是**加入其他人的团队，团队成员仍由 workspace owner/admin 在「团队管理」中添加。
- 回归测试：Node 22.22.1 下 lint、严格类型检查和普通测试通过，**131/131**；独立 tmpfs PostgreSQL 数据库集成 **42/42**。额外在隔离 Docker/PostgreSQL、无公开端口环境完成注册 API 烟测：开关开启、跨站 403、弱密码 400、注册 201、重复邮箱最终 429、健康 200；测试租户已清理。
- Next.js 16.4.0 / Node 22 Docker 镜像构建成功。已部署的 `tradepilot-preview`：`/api/health/live` 与 `/api/health/ready` 返回 200；真实管理员 Credentials 登录取得 session，`isPlatformAdmin=true`；注册状态 `/api/auth/register` 为 `enabled=true`。
- 账号轮换前制作了 0600 数据库 dump 与 Web 数据卷备份，旧镜像标签保留。之后对本地已知回滚快照做定向脱敏：只移除旧管理员邮箱/密码和旧用户行，保留其余工作区/审计/媒体/配置数据；扫描本地 `backups/` 的原始文件和 tar 内容，未再匹配旧邮箱或旧密码。历史 Git 提交和聊天记录不做重写；其中可能仍出现已退役的旧示例字符串，不能再用于登录。
- 新密码曾在此聊天中传输；生产级密码卫生建议在首次使用后再轮换，并确保新值只通过私有 `.env`/受控 Secret 管理。当前示例配置仍保持自助注册关闭，**不要把本机试用开关直接用于公网**。
- 本次修改尚未提交或推送到 GitHub；也没有部署到 PocketBay。P1-09～P1-11 与供应商、HTTPS/Secret、告警、压测、灾备等生产门禁继续保持未关闭。


## 业务 UI 设计与本地预览更新（2026-10-13）

按用户提供的创意工作室参考，将视觉重写为 TradePilot「远航增长工作台」：墨绿与暖米白官网/认证故事、清晰的业务路径，以及明亮可读的运营数据区。保留 Next.js 与现有业务实现。

- 官网使用本地港口图片、大字品牌、三段业务说明与真实页面入口；未引用原提示词的创意视频、虚构转换率或示例订单金额。中英文官网可切换。
- 后台统一绿色主操作、墨绿导航、字体/边线/圆角；平台管理独立分组，普通用户在整理侧栏中也不能看到平台入口。移除菜单固定假数量和固定虚构通知；顶部主操作接通现有询盘录入窗口，点击即可开始填写，没有变更写入 API。
- AI 获客、AI 营销及 SaaS 操作指南以原生 details/summary 提供，鼠标/键盘都可展开；配置说明保留。Firecrawl Key/预算表单更紧凑，业务 handler 与 API 不变。
- lint、严格类型检查和普通回归 **131/131** 通过；Docker 生产构建成功。隔离真实 PostgreSQL/浏览器角色检查通过：普通工作区 owner 访问管理 API 为 403，管理页为 307 跳转，运营者可进入。
- 浏览器验证桌面、平板与手机（1440/768/390/375px）及移动导航、快捷搜索、指南和中英文切换；没有页面脚本异常、5xx、缺图或页面级横向溢出。这不是完整 WCAG 人工/读屏验收，也不是所有业务 E2E。
- 已更新本机 `tradepilot-preview` Web；PostgreSQL 和视频服务未重建，私有 env 内容未变，没有更改账号/密码或数据库结构。较早镜像保留为 `ui-fallback-20261013`，更新前精确镜像因 Docker 内容缺失未能快照，本次未回滚。
- PocketBay 上传仍暂停，没有推送 GitHub；既有公网 SaaS NO-GO 与 P1-09～P1-11 门禁不因视觉更新而改变。

优化后的完整设计提示词与实现说明见 `docs/design/ui-direction-2026-10-13.md`。本机证据：`/tmp/tradepilot-ui-checks-20261013.log`、`/tmp/tradepilot-ui-docker-build-20261013.log`、`/tmp/tradepilot-ui-roles-20261013.log`。


### 2026-10-13：微信服务号与 WhatsApp 官方消息渠道

新增租户渠道配置、公众号安全模式 AES 回调与验证、WhatsApp Cloud API HMAC 回调与文字发送、统一消息收件箱及发送回执。旧设备绑定页面替换为「消息渠道」，失效的旧绑定生成/确认接口继续关闭。渠道消息自动建立来源客户，沿用客户 ACL；会话按渠道账号和外部用户区分。AI 草稿依然由用户确认发送。

新增前向迁移 `0010_messaging_channels.sql`，更新发布 manifest 和数据库就绪检查，新增渠道账号、事件去重、发送幂等表。配置密钥以租户/账号 AAD 加密，敏感密钥不会通过列表返回；查看接入 Token/EncodingAESKey 仅限工作区管理员并写审计。HTTP 回调不依赖登录 Cookie，但必须验证官方签名和接收账号。配置、测试和发送 API 仍经过租户认证、CSRF 校验和共享限流。

验证证据：

- ESLint、严格 TypeScript、`npm test`：**146/146**，日志 `/tmp/tradepilot-channels-checks-20261013.log`。
- 独立 loopback PostgreSQL `*_test` 数据库集成：**52/52**，含凭据加密/隔离、客户 ACL、并发去重、冲突回滚、微信官方 GET 验证与 AES POST、WhatsApp HMAC、发送幂等和提前到达/乱序回执。日志 `/tmp/tradepilot-channels-db-tests-20261013.log`。
- 新增 XML 解密测试对照微信官方文档公开 AES 样例，避免只验证自行生成的密文。
- Docker 生产构建成功，镜像 `tradepilot-preview-tradepilot:channels-20261013`，日志 `/tmp/tradepilot-channels-docker-build-20261013.log`。
- 独立 Docker/浏览器环境通过匿名回调、未登录配置拒绝、两种渠道自动入库与客户创建、停用拦截及 1440/390/375 像素页面验证；合成账号和临时容器已清理。日志 `/tmp/tradepilot-channels-browser-20261013.log`，截图与结果位于本地 `tradepilot-channels-20261013` 可视化目录。
- 本地 preview 应用新增迁移并替换 Web 容器，PostgreSQL/视频容器未重建。部署前数据库和 Web 数据备份目录为 `backups/preview-before-channels-20261013-160510`（0700，内部文件 0600），原 Web 镜像保留 `channels-before-20261013` 标签。私有 env 和管理员账号文件 SHA256 未变，工作区/用户/CRM 记录数未变。日志 `/tmp/tradepilot-channels-deploy-20261013.log`。
- 新锁文件的生产依赖审计为 0 漏洞，日志 `/tmp/tradepilot-channels-production-audit-20261013.json`。这仅覆盖生产依赖，不代表开发依赖的既有 High 门禁已经解决。

边界：真实微信/Meta 后台尚未由本轮操作完成配置，不存在真实平台消息验收证据。当前本地 `localhost` 不能作为官方公网回调，需要账号凭据、平台权限、服务器出口 IP/微信白名单及正式 HTTPS 域名。公众号接入仅接收发给服务号的消息；WhatsApp 使用官方 Business Cloud API。媒体只记录类型及说明，不下载二进制；模板群发、微信菜单编辑和个人微信聊天同步未实现。本轮没有恢复 PocketBay 上传或推送 GitHub。旧镜像与备份是恢复材料，迁移增加后的回退必须同时评估数据库版本；不可简单换旧镜像并认为健康检查仍会通过。


### 2026-10-14：GitHub 更新前验证与 README 同步

README 更新为当前品牌与界面，增加公开官网和空白手机登录页面截图、注册/角色说明、AI 获客与营销说明、微信/WhatsApp 配置和手机浏览器使用边界，并补充品牌与渠道文档入口。新的截图不包含账号密码或客户数据。

本轮重新执行 ESLint、严格 TypeScript、146 项单元/业务测试、52 项独立 PostgreSQL 集成测试和 Next.js 生产构建，均通过。日志分别为 `/tmp/tradepilot-github-checks-20261014.log` 和 `/tmp/tradepilot-github-database-checks-20261014.log`。本地相对文档/图片引用检查通过；提交候选文件与当前部署私有值比对及常见 token/private-key 模式检查未发现命中，私有 env、备份和数据卷继续排除。

2026-10-14 全量 npm 审计仍为 **12 High、4 Moderate、0 Critical**，日志 `/tmp/tradepilot-github-dependency-audit-20261014.json`，退出 1。当前 CI 的 High 门禁预计仍会失败；本轮不升级无关依赖、不降低门槛、不以本地构建结果宣称生产验收完成。真实服务号与 Meta 消息接入、付费服务联调及生产运维门禁保持未验收状态。


### 2026-10-14：Apple Silicon Docker / Workerd 运行路径隔离

报告中的 `spawn .../workerd-linux-arm64/bin/workerd ENOENT` 不等于应安装 macOS 二进制：Docker Desktop 的目标容器是 Linux ARM64。独立 Alpine ARM64 builder 中确认官方 Linux ARM64 Workerd 文件存在，但直接执行仍显示 `not found`；实验 glibc ARM64 builder 中该版本 Workerd 出现段错误。当前提交的生产 `next build` 本已按 phase 跳过 Cloudflare 开发模拟器，未复现报告中的生产构建失败；本轮进一步消除了默认 Node.js 开发阶段对 Workerd 的隐式依赖。

最终改动：默认开发、Docker 构建与生产启动均使用 Node.js，不导入或初始化 Cloudflare 开发模拟器。只有 `TRADEPILOT_RUNTIME=cloudflare` 且 Next.js development phase 才显式启用模拟器。Docker builder/runner 设置 `TRADEPILOT_RUNTIME=node`，基础镜像继续使用原生 Alpine，未保留 AMD64 模拟或 Debian workaround，未改动 package-lock、数据库迁移及运行中的服务。

验证：

- 新配置测试先观察到默认与 Node 模式仍导入模拟器的失败，再修改实现通过；生产 phase 即使指定 Cloudflare 模式也不初始化，Cloudflare 开发模式则保留显式入口。
- ESLint、严格 TypeScript、`npm test` **148/148** 通过；日志 `/tmp/tradepilot-arm64-node-checks-20261014.log`。
- `docker build --pull --no-cache --platform linux/arm64 --target runner` 成功，镜像 `tradepilot-arm64-node:20261014` 确认为 `linux/arm64`；日志 `/tmp/tradepilot-arm64-node-build-20261014.log`。
- 独立 ARM64 PostgreSQL + ARM64 Web 容器，合成管理员账号登录成功；`/api/health/live` 200、`/api/health/ready` ready；1440/390px 的工作台、AI 获客、消息渠道共 6 个页面场景均渲染正常，无脚本错误或页面溢出。日志 `/tmp/tradepilot-arm64-smoke-20261014.log`。
- 测试容器、临时库、网络与合成 Secret 文件均已清理，原业务/视频容器未被替换。实验 Workerd builder 不是最终产品实现；真实 Cloudflare 生产部署、AMD64 镜像及所有 M 系列具体设备没有因此宣称已验收。

README、Docker 试用指南与 Cloudflare 指南说明原生容器平台、重建方式、显式 Cloudflare 开发入口及默认宿主机端口 3461（容器端口 3456）。本次没有发布预构建镜像或把尚未合并的分支当作 GitHub main 版本。


### 2026-10-15：CI 失败与 Cloudflare 打包修复

本轮针对 GitHub Actions `38667281301`、`38667285250` 和本地复现的 Cloudflare 构建失败，不绕过原 High/Critical 审计门禁，不改管理员账号、业务数据库、部署 Secrets 或默认分支。

1. **安装器用例的后台清理竞态**：原用例在 `nohup docker compose` 写日志前就删除临时目录，偶发 `ENOTEMPTY`。测试专用 shell 现在 source 复制的安装器并 `wait` 子进程；真实安装器仍保留后台下载行为。带延迟的回归先红后绿，完整安装器套件连续 10 轮（60 个用例执行）通过。
2. **Cloudflare 漏打包 PostgreSQL socket 实现**：本地原构建明确失败于 `Could not resolve pg-cloudflare`，因为 Node 文件追踪只复制了默认空入口。按 Next.js 本地文档使用 `outputFileTracingIncludes`，精确包含该包 `dist` / `esm`，不 externalize 缺失模块。修复后 `npm run cfbuild` 与 `wrangler deploy --dry-run` 通过；CI 新增这两个独立步骤，仅打包不上传。
3. **自动安装的 peer 策略不一致**：新增项目 `.npmrc`，固定与锁文件、Docker 和 CI 已使用的 `legacy-peer-deps=true` 一致。Auth.js 声明旧版可选 Nodemailer peer，本项目 SMTP 直接使用 Nodemailer 10，未使用 Auth.js Email provider；不为消除安装错误降级邮件库。`npm ci --ignore-scripts --dry-run` 验证不再需要调用者手加该参数。这不代表已经取得 Cloudflare 远端失败日志。
4. **可升级依赖与冗余清理**：Wrangler 更新至 4.151.0，连带 Miniflare 使用修复版 sharp；删除未被应用引用的 shadcn CLI 及其传递依赖。未使用 `npm audit fix --force` 或退回旧 Next.js/邮件库。
5. **无上游修复版的 braces**：官方 GHSA-vfj7-8cjw-p6xm 在本轮查询时 `first_patched_version=null`，registry 最新仍为 3.0.3。采用明确标为本地分支的 `vendor/braces`（MIT、`@tradepilot/braces@3.0.3-tradepilot.1`、private），原 tarball/integrity/源文件哈希在 `UPSTREAM.json`，不是伪称上游已发布补丁。最小代码差异只为解析/递归 AST walker 增加迭代式深度、节点数、子节点环校验。长度 9003、低于原上限 10000 的输入在原版触发栈溢出，补丁以稳定 SyntaxError 提前拒绝；还覆盖直接 AST、括号、未闭合模式和 options 不可解除上限。2800 次正常操作的输出摘要与原版一致，且源码还原哈希回归确保没有混入无关上游修改。

本地补丁只沿 ESLint → fast-glob → micromatch 的开发链使用；`overrides` 与锁文件回归防止遗留未打补丁的嵌套副本，Docker 在安装前复制该固定源目录。Registry 来源测试仍拒绝其他非官方 URL/任意本地包，只允许这一固定链接。上游正式修复后应复用回归验证并移除本地分支、override 和 Docker COPY。npm 漏洞库不会独立覆盖这一本地分支，因此回归、来源记录和人工 review 必须保留。

**审计结论**：原 `npm audit --audit-level=high --registry=https://registry.npmjs.org` 现在通过，High/Critical 为 0；保留的 4 个 Moderate 都来自 drizzle-kit 的旧 esbuild 开发工具链，未伪称全量零漏洞。原工作流命令和 High/Critical 阈值未降低，也未添加 advisory allowlist。生产依赖需独立以 `npm audit --omit=dev` 验证。

本轮修复不等于已经合并 main、发布线上 Worker 或验收 Workers 的数据库/文件持久化。Cloudflare 本机没有登录授权，无法据本地构建结果声称远端 check 已转绿。完整验证记录见 [CI 修复记录](./ci-repair-2026-10-15.md)。
