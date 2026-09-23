# Cloudflare Workers 部署说明

## 当前可用范围

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

## 上线前必须解决

### 1. 配置与业务数据持久化

- `src/lib/api-config/store.ts` 使用同步文件读取、AES-256-GCM 加密、临时文件与原子重命名，适用于单实例 Node + 持久磁盘。
- `src/lib/product-video/job-repository.ts` 将任务写入 JSON 文件，也需要持久磁盘。
- Workers 的文件系统是虚拟文件系统；`/tmp` 是请求级临时空间，不能跨请求保存 API Key 或视频任务。**不要通过把数据目录改成 `/tmp` 来“修复”保存。**
- 需要为配置与任务接入 D1、Durable Objects、外部 PostgreSQL 或其他合适的持久化服务，同时实现并发版本校验、加密、权限隔离和备份；仅添加 binding 不会自动迁移现有文件存储代码。
- 客户、询盘、订单等主体业务数据仍是进程内存状态，不同 Worker 实例不共享。当前 `DATABASE_URL` 主要用于注册账号，不意味着 CRM 全部持久化。

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
npm ci
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

3. 配置持久化服务的 binding / 连接并运行相应迁移。当前仓库没有完成这一层，不能省略或宣称已接入。
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
