# Cloudflare Workers 部署说明

## 当前可用范围

本地默认 `npm run dev` 使用 Node.js，不初始化 Cloudflare 模拟器。只有调试 Workers bindings 时才显式运行 `TRADEPILOT_RUNTIME=cloudflare npm run dev`（macOS/Linux），或在该开发环境的 `.env.local` 设置 `TRADEPILOT_RUNTIME=cloudflare`。不要把这个选项用于 Docker；生产 `next build` / `next start` 无论该设置如何都不会初始化开发模拟器。OpenNext 的 Cloudflare 构建仍通过 `npm run cfbuild` 执行。

TradePilot 的 Web 使用 Next.js + OpenNext，生成 `.open-next/worker.js` 和静态资产；不是 Cloudflare Pages 静态导出，也不是 GitHub Pages 项目。

**当前分支不能直接作为 Docker 完整功能的 Cloudflare 替代部署。** 2026-09-20 的本地检查结果：

| 检查 | 结果 |
| --- | --- |
| `npm run cfbuild` | OpenNext 构建通过 |
| `npx wrangler deploy --dry-run` | Worker 与资产打包通过，未上传 |
| Wrangler 本地 Workers 运行时登录 | 隔离测试账号登录通过 |
| API 配置 GET | 返回 200，可读取默认配置 |
| API 配置 PUT | 返回 400，`operation not permitted`，本地文件不能作为持久存储 |
| 线上发布 | 需要账号授权和运行时适配；上述检查不代表已部署到线上 |

构建工具还报告了来自生成的 UI 依赖代码的重复对象键警告；构建未因此失败。不要把 dry-run 当成线上发布或完整功能验收。

## 2026-10-22：1101 与登录代理异常修复

针对 `2026-10-22 09:22:23 UTC` 报告的 1101，本地使用实际生成的 Worker 重现了两处运行时异常：

- Next.js 16.4 新增 `server/preview-props.json`，旧 OpenNext Cloudflare 1.20.9 未内联该文件，动态页面抛出 `Unexpected loadManifest(...)`。锁定 Next.js / eslint-config-next 16.4.2 与 OpenNext Cloudflare 1.20.13，并提交锁文件。
- 登录代理静态导入账号、注册和登录限流模块，数据库依赖令 Next.js 产物导出异步模块。Workerd 加载代理时报 `Method Promise.prototype.then called on incompatible receiver`。这些依赖现改为在认证回调内加载；已有会话仍查询权威账号状态，保留密码变更、账号停用与数据库故障时的访问限制。构建继续使用 Next.js 默认打包器。

升级适配器带入的 `@node-minify/core` 间接依赖 `glob` 固定为同一主版本的修复版 10.5.0，避免引入已知的高危 CLI 命令注入漏洞。ESLint 忽略 Wrangler 生成目录，避免预览和 dry-run 后扫描生成的大型 Worker。

GitHub CI 新增实际运行 Workerd 的检查；单纯构建与 dry-run 成功不能发现上述异常：

```bash
npm ci --legacy-peer-deps --registry=https://registry.npmjs.org
npm run cfbuild
npx wrangler deploy --dry-run --outdir /tmp/tradepilot-worker-dry-run
npm run test:cloudflare
```

`test:cloudflare` 在随机本地端口启动 Worker，使用临时认证密钥和隔离状态，清空数据库与管理员测试配置。它验证首页、登录/注册页、存活接口、匿名会话、业务接口 401、后台登录跳转、已有加密会话在数据库未配置时返回 503、失效管理员会话被拒绝，以及凭据登录在数据库不可用时拒绝登录。结束后关闭测试进程并移除临时目录，不上传 Worker。

**发布路径：提交并合并 GitHub 修复，由已连接的 Cloudflare Workers Builds 自动部署。** 在 Cloudflare 的 Git 集成中确认仓库为 `feifei9126/tradepilot`、生产分支为 `main`、根目录为仓库根、构建命令为 `npm run cfbuild`、部署命令为 `npx wrangler deploy`。保持 `wrangler.jsonc` 的 Worker 名称、静态资产及自引用绑定一致。不要同时手工上传另一份产物。

部署后分别验证 `/`、`/auth/login`、`/api/health/live`、`/api/auth/session`、未登录的 `/api/contacts` 与 `/app`。`/api/health/ready` 在数据库未配置/不可用时应返回受控的 JSON 503；它不等于 1101。页面恢复与无数据库的本地运行测试不代表真实数据库登录、API 配置持久化或外部 AI/语音/视频服务已在生产验收；以下运行时与存储限制仍适用。

## 页面可打开但登录失败

页面返回 200 只说明 Worker 能处理请求。登录限流记录与业务账号依赖 PostgreSQL；`/api/health/ready` 返回 503 时，可能是连接配置缺失、连接失败或迁移不完整，需要在授权后的平台诊断中确认。不要跳过数据库限流、使用内存替代共享状态或把管理员文件放在 `/tmp` 来强行放行。

认证服务无法读写限流记录时返回 `CredentialsSignin` 与公开错误码 `service_unavailable`，页面提示“登录服务暂时不可用”，不会显示连接地址或内部异常。Auth.js 的 `redirect: false` 结果可能同时包含 `ok: true` 和 `error`；登录/注册页必须确认没有 `error` 才跳转后台。

恢复登录需要按顺序完成：

1. 在 Cloudflare **运行时** Secrets 配置 Worker 可访问的 PostgreSQL 连接（`DATABASE_URL` 或完整的 `PG*`）。构建环境变量不等同于运行时 Secrets，本地 Docker 主机名不能用于云上连接。
2. 在可访问同一数据库的受信 Node.js 环境备份并执行 `npm run db:migrate`；新实例需按 `npm run db:init` 的说明初始化工作区和管理员。已有账号密码不得在升级时自动重置。
3. 检查管理员邮箱与初始密码 Secrets、`AUTH_SECRET`、实际 HTTPS `AUTH_URL`。生产管理员初始密码至少 16 位；公开演示密码 `12345678` 不可用于生产。
4. 确认就绪检查返回 200，再验证真实登录、会话读取、后台权限与账号改密。部署管理员改密仍依赖上述待适配的持久化存储；未经验证不能宣布完整登录闭环可用。

## 2026-10-15 构建修复

- 项目 `.npmrc` 固定与既有锁文件一致的 peer 解析策略，自动 npm 安装无需手工补 `--legacy-peer-deps`；这不关闭漏洞审计或安装脚本。
- `next.config.ts` 的 `outputFileTracingIncludes` 显式包含 `pg-cloudflare` 的 `dist` / `esm`，防止 Node 构建只追踪默认空入口、OpenNext Workerd 打包却缺少 socket 实现。
- GitHub CI 同时执行 `npm run cfbuild` 和 `npx wrangler deploy --dry-run`，不会在校验步骤上传 Worker 或改动 dashboard Secrets。
- 本轮本地构建与 dry-run 通过；这些结果**不是** Cloudflare 远端生产发布成功，也不改变下述持久化、外部服务和授权前提。细节见 [CI 修复记录](./ci-repair-2026-10-15.md)。

## 上线前必须解决

### 1. 配置与业务数据持久化

- `src/lib/api-config/store.ts` 使用同步文件读取、AES-256-GCM 加密、临时文件与原子重命名，适用于单实例 Node + 持久磁盘。
- 当前核心 CRM、获客、邮件草稿/账号参数和视频任务**元数据**已经改为 PostgreSQL 按工作区持久化，Docker 使用版本化迁移及工作区事务锁；不是原来的全局内存 CRM。
- 部署管理员档案与实例 API 配置仍使用本地持久文件，视频/素材仍依赖外部 Worker 卷或对象存储；尚未完成多副本一致性。
- Workers 的文件系统是虚拟文件系统；`/tmp` 是请求级临时空间，不能跨请求保存 API Key 或视频任务。**不要通过把数据目录改成 `/tmp` 来“修复”保存。**
- 需要验证 Workers → 外部 PostgreSQL 的驱动/连接池/TLS/网络适配，并用独立初始化环境运行迁移；当前 Docker 的 `postgres` 主机名与内部明文连接参数不能直接用于 Workers。仅配置 `DATABASE_URL` 或 binding 不代表 Workers 已验收。
- 需要为剩余本地管理员/配置文件接入合适的持久化服务，同时保留加密、会话撤销、并发版本校验和平台/租户权限边界；不要把请求级 `/tmp` 当持久化。参见 [数据库管理](./database-management.md) 的数据边界。

### 2. 独立计算服务

Cloudflare Web Worker 不会启动这些 Docker 服务：

- LiveKit Python Agent：运行在独立 Docker 主机或适配的 Agent 托管环境。
- FFmpeg / OpenMontage 视频适配器、MoneyPrinterTurbo：运行在独立计算服务上。
- Firecrawl：使用外部云服务或独立自托管服务。

Docker 中的 `http://video-worker:8787`、`http://moneyprinterturbo:8080`、`host.docker.internal` 不能直接用于云上 Worker。需配置受保护、可访问的服务地址。现有 Python supervisor 从共享 Docker 数据卷读取加密配置；它不会自动同步未来的 Cloudflare 数据库，需要额外的受控同步方案，或独立配置同一 LiveKit 项目。

### 3. 公网安全

- 不使用本地演示密码；随机生成 `AUTH_SECRET` 和管理员强密码。
- `AUTH_URL` 必须是实际 HTTPS 访问地址，以启用正确的安全 Cookie 与同源校验。
- API Key、数据库连接和管理员密码只放 Cloudflare Secrets，不能写进 README、Wrangler `vars` 或 GitHub 工作流源码。
- 保存独立的加密密钥备份；不要在迁移时丢失原配置的解密密钥。
- 处理依赖漏洞、登录防滥用、业务权限与存储隔离后才开放真实客户数据。

## 准备与授权

在项目根目录执行；不要把授权码或 Token 发到聊天中：

```bash
gh auth login
gh auth status
npx wrangler login
npx wrangler whoami
```

GitHub 用于推送源码，Cloudflare 用于运行 Web Worker；两种授权互不替代。如账号包含多个 Cloudflare Account，先确认目标账户，不要随机选择或覆盖未知 Worker。

```bash
npm ci --legacy-peer-deps
npm test
npx tsc --noEmit
npm run cfbuild
npx wrangler deploy --dry-run
```

当前 `wrangler.jsonc` 的 Worker 名称是 `tradepilot`，并有同名 `WORKER_SELF_REFERENCE`。`keep_vars: true` 会保留既有服务变量，发布前需核对线上旧配置。

## 运行时适配完成后再发布

以下步骤是**后续操作说明，不代表本次已经执行**：

1. 优先建立隔离的预览 Worker。为它使用独立的 Wrangler 配置、Worker 名称、同名 `WORKER_SELF_REFERENCE`、数据库和 Secrets，不能只改 `--name` 却继续引用生产 Worker。
2. 在该目标 Worker 中交互录入密钥：

   ```bash
   # 这些命令默认针对 wrangler.jsonc 中的 tradepilot。
   # 预览配置应给每条命令增加 --config <预览配置路径>。
   npx wrangler secret put AUTH_SECRET
   npx wrangler secret put TRADEPILOT_ADMIN_EMAIL
   npx wrangler secret put TRADEPILOT_ADMIN_PASSWORD
   npx wrangler secret put AUTH_URL
   # 若运行时适配使用独立配置密钥或 PostgreSQL，再添加：
   npx wrangler secret put TRADEPILOT_CONFIG_KEY
   npx wrangler secret put DATABASE_URL
   ```

3. 验证外部 PostgreSQL binding / 连接与 TLS，运行当前迁移；另完成本地管理员/实例配置的 Workers 存储适配。Docker 已完成核心数据库层，不代表 Workers 运行时与剩余文件存储层已接入。
4. 确认 OpenNext 构建、dry-run、权限和存储测试后，用对应配置执行部署。当前默认命令为：

   ```bash
   npm run deploy:cloudflare
   ```

5. 记录 Wrangler 返回的部署版本与实际访问地址。部署没有返回成功之前，不把旧演示域名当作本次新部署结果。

## 验收与回滚

至少验证：

- HTTPS 登录、登出、未登录访问拦截和管理员权限。
- 保存配置后刷新、跨请求及新实例仍能读取，且浏览器不回显 Key。
- 并发写入发生版本冲突，不互相覆盖；其他工作区不能使用共享密钥。
- 使用真实账号验证一次小额模型调用；先取得调用授权，不把 mock 当真实联调。
- LiveKit 真实通话、独立 Worker 可达性、视频任务跨请求持久化。
- 业务数据不会因冷启动、实例切换或发布丢失。

部署前记录旧版本；如出现回归，按 Wrangler 当前提示执行 `npx wrangler rollback` 选择已确认的旧版本。回滚 Worker 不会自动回滚数据库迁移、Secrets 或外部服务，必须独立备份与恢复。

## 官方参考

- [OpenNext Cloudflare](https://opennext.js.org/cloudflare/get-started)
- [Workers Node.js 文件系统](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/)
- [Wrangler 命令](https://developers.cloudflare.com/workers/wrangler/commands/)
