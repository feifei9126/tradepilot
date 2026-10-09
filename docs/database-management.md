# 数据库管理与配置（初学者指南）

> 推荐使用 **PostgreSQL 16 + Docker Compose**。数据库页 `/app/database` 仅平台管理员可见，提供只读健康诊断、迁移完整性和统计，不是在线 SQL 编辑器，也不会替你清空或恢复数据库。

## 1. 所有数据都在数据库吗？

**不是。核心账号与业务已入 PostgreSQL，但媒体、部署配置和浏览器草稿需要分别备份。**

| 数据 | 存放位置 | 要不要备份 |
|---|---|---|
| 公司、注册用户、密码哈希、角色、偏好、会话版本 | PostgreSQL `companies` / `users` | 要 |
| 客户、询盘、报价、订单、产品、供应商、出货、物流、单证、消息、邮件草稿、账号参数、字段 / 流程 | PostgreSQL `crm_records`（按工作区 JSONB） | 要 |
| AI 获客的人设、任务、线索、执行状态 | PostgreSQL `crm_records` | 要 |
| 视频任务的标题、状态、Worker 地址等元数据 | PostgreSQL `crm_records` | 要；元数据不是视频文件 |
| 业务关联与序号、管理操作审计、迁移历史 | PostgreSQL `crm_record_links` / `crm_counters` / `audit_events` / `tradepilot_migrations` | 要 |
| 租户 AI / Firecrawl 加密 Key、配置、请求 / Token / 每日抓取预算台账 | PostgreSQL `tenant_ai_settings` / `ai_usage_events` / `tenant_discovery_settings` / `discovery_usage_events` | 要，同时单独备份加密主密钥 |
| 订阅、套餐、支付事件，邮箱加密凭据 / 发送事件 / 同意 / 抑制，租户 Webhook | PostgreSQL 对应 SaaS 关系表 | 要，同时单独备份加密/签名密钥 |
| 媒体 MIME 校验、对象路径和工作区授权元数据 | PostgreSQL `media_assets`；内容仍在应用媒体卷 / S3 | 数据库和媒体都要 |
| 登录共享节流计数 | PostgreSQL `auth_login_buckets` | 恢复时确认限流和会话策略，不靠重启清除 |
| **部署管理员**资料、偏好、密码哈希 | 应用数据卷 `/app/data/admin-account.json` | 要；与注册用户不同 |
| 实例 API 密钥 / 配置 | 应用数据卷中的加密配置文件 | 要，并单独保管解密主密钥 |
| 渲染视频、素材、封面 | Worker 数据卷 `/app/openmontage-workspace`，或你的外部对象存储 | 要 |
| `.env`、`AUTH_SECRET`、`TRADEPILOT_CONFIG_KEY`、数据库 CA | 服务器配置 / secret 管理系统 | 要，单独加密保存 |
| 页面未提交的输入、部分浏览器设置 / 草稿 | 当前浏览器 localStorage | 不会自动同步到数据库；清理浏览器可能丢失 |

数据库备份**不能**替代媒体卷、配置卷、密钥和浏览器草稿备份。旧版内存示例、获客/视频/邮件文件不会自动导入数据库，更不会自动分给新的客户。需要迁移旧文件时应先备份、确认归属、做独立导入和核验；不要直接把所有旧数据写进每个工作区。

## 2. 推荐：内置 Docker 数据库

### 第一次安装

1. 首先复制配置，不要覆盖已有配置：

   ```bash
   cp .env.example .env        # 仅第一次、且 .env 不存在时执行
   chmod 600 .env
   openssl rand -hex 32        # 用生成结果填写 AUTH_SECRET
   openssl rand -hex 32        # 用另一份结果填写 POSTGRES_PASSWORD
   ```

2. 在 `.env` 填写管理员邮箱、**生产强密码**、`AUTH_SECRET` 和 `POSTGRES_PASSWORD`。示例密码 `12345678` 仅用于本机预览，不能用于公网。不要把真实配置提交 Git。
3. 启动：

   ```bash
   docker compose up -d --build
   docker compose ps -a
   docker compose logs --tail=100 db-init
   ```

4. 顺序是：PostgreSQL 就绪 → `db-init` 执行迁移与首次账号初始化 → Web 启动。`db-init` 最终 `Exited (0)` 是正常的，它是一次性任务，不是常驻服务。
5. 登录后进入 **数据库管理**，确认“本版本结构就绪”，然后在 **SaaS 工作区** 创建客户公司。

也可运行 `bash install.sh`，它会在缺少数据库密码时生成随机值；已有账号和密码默认不会被初始化脚本覆盖。

### 默认如何连接

Compose 中 Web 与 `db-init` 使用完全相同的配置：

```dotenv
PGHOST=postgres
PGPORT=5432
PGDATABASE=tradepilot
PGUSER=tradepilot
PGPASSWORD=来自 .env 的 POSTGRES_PASSWORD
PGSSLMODE=disable
```

`postgres` 是 Docker 内网服务名，不是 `localhost`。默认不映射数据库端口到宿主机/公网。`disable` 仅适用于这种受信本机内部网络，外部库应验证 TLS。数据库持久化在 `<Compose 项目名>_tradepilot_postgres` 卷；应用和媒体另有自己的卷。

**禁止误操作**：`docker compose down -v` 会删数据卷；不要运行。`docker compose restart` 不会删卷。已有数据库卷不会因为修改 `.env` 中的 `POSTGRES_PASSWORD` 自动修改数据库角色密码；轮换需在数据库端安全改密后同步 Web/初始化配置，再重建服务。

## 3. 本机 Node / 外部 PostgreSQL

本机 `npm run dev` 不会启动数据库。先准备数据库，写 `.env.local`（勿提交）：

```dotenv
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=tradepilot
PGUSER=tradepilot
PGPASSWORD=你的数据库密码
PGSSLMODE=disable
TRADEPILOT_ADMIN_EMAIL=你的邮箱
TRADEPILOT_ADMIN_PASSWORD=首次初始化用的强密码
AUTH_SECRET=至少32字符的随机密钥
AUTH_URL=http://localhost:3458
```

```bash
npm run db:init       # 迁移 + 首次所有者初始化
npm run dev
```

也支持 `DATABASE_URL`；**连接主机/数据库/用户名/密码优先采用 URL**，URL 中的 TLS 参数优先于同名 PG 环境参数。密码包含 `@:/#%` 等字符必须 URL 编码，初学者优先使用上面的离散 `PG*` 配置。不要一处连接正式库、另一处连接本地库。

外部库推荐：

```dotenv
PGHOST=db.example.com
PGPORT=5432
PGDATABASE=tradepilot
PGUSER=tradepilot
PGPASSWORD=只保存在服务器的强密码
PGSSLMODE=verify-full
PGSSLROOTCERT=/run/secrets/postgres-ca.pem
```

- `disable`：无 TLS；仅本机受信网络。
- `require`：加密但不验证服务器身份，本实现不接受在该模式同时配置根 CA。
- `verify-ca`：验证 CA 链，但不校验主机名。
- `verify-full`：验证 CA 与主机名；本实现必须提供可读的根 CA 文件。
- 拒绝 `prefer` 等静默回退策略和不支持的 URL 选项；`channel_binding=require` 当前不支持。客户端证书需同时提供 `PGSSLCERT` 与 `PGSSLKEY`，不能在 `disable` 下使用。
- Node Web、迁移和备份工具共用解析器，防止不同程序连接到不同主机或使用不同 TLS 策略。

### Docker 改用外部库时，不是只改 `.env` 就够了

默认 `docker-compose.yml` 明确固定连接内部 `postgres`。请创建专用的外部部署文件，或在维护窗口调整现有 Compose：

1. **同时**修改 `tradepilot.environment` 和 `db-init.environment` 的所有 PG 参数，或为二者设置相同的 `DATABASE_URL`。
2. 给两个服务同时只读挂载 CA 文件，环境变量指向容器内的路径，而不是宿主机路径。
3. 删除 `db-init` 对内置 `postgres` 的依赖；移除/禁用内置数据库。保留 Web 对 `db-init: service_completed_successfully` 的依赖。
4. 保留应用/媒体数据卷和原来的 `AUTH_SECRET`、配置解密密钥、管理员设置以及 Worker 配置。不要为了换库重建空数据卷。
5. 新库先迁移、校验结构和权限，再切换。不要同时启动两套会写入同一媒体/本地配置文件的 Web 副本。

运行时业务账号应最小权限；迁移需要建表/扩展权限。如果服务商限制扩展创建，请由 DBA 提前准备 `pgcrypto`、`vector` 等迁移所需扩展，或按版本化迁移策略处理。不要修改已应用的 SQL 来绕过检查。默认 Compose 数据库角色权限较高，不能原样视为生产最小权限部署。

## 4. 结构 / 迁移管理

数据库页检查：连接、数据库版本与容量、会话传输是否 TLS、本版迁移的校验和、表/列/索引、账号/工作区/业务分类统计。**显示 TLS 已启用不等于已验证服务器身份**，实际验证策略以配置为准。统计不暴露密码、完整连接串、客户记录内容或 API 密钥；仅平台管理员可读。

```bash
npm run db:migrate                              # 只升级结构，不初始化账号
npm run db:init                                 # 结构 + 首次部署所有者；已有账号默认保留
# Docker 使用相同环境：
docker compose run --rm --no-deps db-init         # 重跑；不要加 --reset-password
```

迁移 SQL 位于 `scripts/database/migrations/`：

- 全局迁移锁串行化并发初始化；每个迁移一个事务。
- 所有已安装迁移的 SHA-256 在执行新 SQL **之前**校验。已运行文件被改动、版本未知或历史有空洞会拒绝执行。
- 不修改历史迁移，不手动删除迁移记录。新增前向迁移并先在隔离环境测试。
- 目前迁移以新增结构/约束为主，没有自动 DOWN。升级前备份；回滚在维护窗口恢复到**新空库**再切流，不覆盖原库。
- 新约束可能因历史脏数据拒绝执行；应单独审计/修正数据。大表还需评估锁与索引策略，此处未证明生产规模零停机。
- 初次 bootstrap 不启用共享 CRM 样例；`TRADEPILOT_SEED_DEMO=true` 只用于明确的演示，不可用于公开环境。
- `--reset-password` 或 `TRADEPILOT_RESET_ADMIN_PASSWORD=true` 只针对数据库初始化账号、会撤销旧会话，不会恢复禁用账号；不要长期保留该开关。不会重置 `/app/data/admin-account.json` 中的部署管理员。

数据库断开：请求返回 503，不能回退到共享内存/文件。不要把连接失败当成“初始化空系统成功”。

### 4.1 本次安全升级：0009（2026-10-07）

新增 `0009_audit_code_security.sql`，并同步应用迁移 manifest 的 SHA-256。新增登录共享节流、租户 Firecrawl 配置/使用事件、邮箱确认挑战；媒体增加 `verified_mime_type`，同意增加 `confirmed_at`，订阅增加事件时间/ID 与 `reconciled_at`。未改动 0000～0008，也没有删除既有客户、媒体或同意记录。

升级影响：

1. 先备份数据库、配置卷、媒体和加密主密钥；在 staging 执行 `db:migrate` 并验证 checksum/重复执行，再部署应用。不要把运行新代码却没有 0009 的实例放进流量。
2. **旧同意记录不会自动视为已确认**：没有收件人验证的历史记录，其 `confirmed_at` 保持空；需让收件人重新完成邮件确认。不得批量 SQL 填确认时间来绕过流程。
3. **旧媒体不删除，但默认强制下载**：没有内容验证标记时覆盖旧 MIME。需恢复 inline 时，应经新上传验证链路重入；不能仅按旧 MIME 回填 `verified_mime_type`。
4. **旧抓取共享配置不自动分给租户**：每工作区在获客页保存自己的 Cloud Key；没有 Key 时拒绝请求，不回退实例共享密钥。
5. **旧订阅事件不自动视为已对账**：用 staging/sandbox 重放验证当前权威状态。真实生产存量需要受控对账计划，不能凭旧 `metadata.plan_id` 回填付费权益。
6. 运行账号需对新表具备必要读写权限；分离迁移角色。生产权限/连接不明时先停止升级，不用超级权限掩盖问题。
7. schema 为扩展型、无自动 DOWN；即便旧应用能读取新 schema，也**不能回退到重新开放营销豁免、主动媒体、共享 Key 或弱密码的旧安全逻辑**。故障时优先修复前向代码或按安全事故回滚方案隔离有风险的功能。

本轮仅迁移独立 loopback `*_test` 数据库；未对现有预览/业务库执行迁移。新数据库集成测试增加多进程登录节流、BYOK/并发预算、收件人确认/退订、媒体下载/Range、邮箱内网保存拒绝、AI 订阅权益与乱序 Stripe 权威对账；SMTP/IMAP、S3、Stripe 的真实供应商链路仍需 staging 验收。

## 5. 安全备份

需要 PostgreSQL 客户端 `pg_dump` / `psql` / `pg_restore`，版本应兼容服务器；Docker 镜像包含 PG16 客户端。

```bash
npm run db:backup -- backups/tradepilot-before-upgrade.dump
# Docker 示例：
docker compose exec tradepilot npm run db:backup -- /app/data/backups/before-upgrade.dump
# 立即复制到宿主机（这个目录也要仅自己可读）：
mkdir -p backups && chmod 700 backups
docker compose cp tradepilot:/app/data/backups/before-upgrade.dump ./backups/before-upgrade.dump
chmod 600 backups/before-upgrade.dump
```

脚本使用 custom-format；新建目录 0700、文件 0600，拒绝覆盖现有文件/符号链接，失败删除本次未完成文件。已有目录需自己确认权限。备份可能包含密码哈希、客户隐私和邮箱账号参数，需要加密、权限控制、异地保存和保留周期，不能放入源码或 Web 公开目录。数据库 dump 默认排除 owner/ACL，恢复后要重新设置最小权限。

同时备份应用数据卷、Worker / 对象存储和部署密钥。可以在维护窗口短暂停止写入后备份各卷，记录版本和校验和；不要把密钥直接塞进视频或公开附件。

## 6. 恢复演练：只能写入新的空目标库

1. 保留原库不动，创建独立空数据库；目标不提供外部访问，停止所有可能写入它的进程。
2. 将备份复制到恢复环境。**只恢复你信任的备份**；数据库备份内可包含可执行 SQL，不要用生产特权账号试不明来源文件。
3. 明确设置独立恢复凭据，不能省略：

   ```bash
   RESTORE_DATABASE_URL='postgresql://restore-user:编码后的密码@restore-host:5432/tradepilot_restore?sslmode=verify-full' \
   RESTORE_PGSSLROOTCERT='/run/secrets/postgres-ca.pem' \
   CONFIRM_RESTORE=I_HAVE_VERIFIED_THE_EMPTY_TARGET \
   npm run db:restore -- backups/tradepilot-before-upgrade.dump
   ```

   或使用 `RESTORE_PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD/PGSSLMODE/PGSSLROOTCERT`；脚本不会继承正式库的 `DATABASE_URL` / `PG*`。本地演练可以显式用 `RESTORE_PGSSLMODE=disable`。
4. 脚本先检查用户表/视图/序列等对象，发现非空目标立即拒绝。不会使用 `--clean`；恢复为一个事务，错误会回滚。空检查不能防止其他程序随后写入，所以恢复期间必须隔离并发写入。
5. 恢复后把 Web 或只读核验工具明确指向恢复库，核验迁移校验和、工作区/账号/记录数量、关键外键、登录与双租户隔离。恢复文件成功不等于业务可用。
6. 完成审核后才切换流量；保留原库和切回配置。数据恢复也会恢复旧密码/会话版本，因此事故恢复时还需按安全方案轮换/撤销会话和凭据。

**严禁把在线正式库作为恢复目标，严禁 `down -v`、清表或修改迁移历史来“修复”。**

## 7. 验证与排查

```bash
npm test
npx tsc --noEmit
npm run lint
# 必须另建独立本地 *_test 库，不能用正式 DATABASE_URL：
TEST_DATABASE_URL='postgresql://测试用户:编码后的密码@127.0.0.1:测试端口/tradepilot_test' npm run test:db
```

真实数据库测试只接受 loopback 的 `*_test` 库，会运行迁移，用本次跟踪的公司 UUID 清理自己的测试记录，不会 TRUNCATE。当前涵盖跨租户 IDOR/导出/外键、并发业务/配额、角色矩阵、强制改密/会话撤销、断库 fail-closed、初始化重跑及元数据持久性；内部 route 测试仍需配合真实浏览器/HTTP 登录验收。

| 现象 | 处理 |
|---|---|
| `POSTGRES_PASSWORD is required` | 在部署使用的 env 文件填写，不要覆盖现有预览 env |
| `db-init` 非零退出 / Web 不启动 | 查日志、数据库健康、权限、迁移一致性；不要跳过初始化依赖 |
| `verify-full` 配置失败 | 检查 CA 文件在两个容器内都存在且可读、证书主机名是否匹配 |
| 页面“结构未就绪” | 在相同数据库运行 `db:migrate`，不改历史校验和 |
| 已修改 `.env` 但连接仍旧 | 确认实际 Compose 的 env 文件，重建相应服务；只 `restart` 不更新容器环境 |
| 重启后数据不见 | 检查 Compose 项目名、卷名、数据库名，不要直接建立另一套空库 |
| API 密钥无法解密 | 恢复原配置解密密钥；不能随便重生成 `AUTH_SECRET` / `TRADEPILOT_CONFIG_KEY` |

## 8. 官方参考

- [PostgreSQL 16：pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html)
- [PostgreSQL 16：pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html)
- [PostgreSQL 16：libpq SSL](https://www.postgresql.org/docs/16/libpq-ssl.html)

公网部署仍需 HTTPS、最小权限、监控、压力测试、租户 BYOK/配额的真实服务验证及灾备制度。
