# Docker 本地试用（PostgreSQL / 多用户版）

默认启动 PostgreSQL 16、一次性数据库初始化、CRM Web 和视频适配器。以下手动命令不启动需要外部服务密钥的语音服务，也不拉取 MoneyPrinterTurbo / Redis。`bash install.sh` 另会在后台启动 MoneyPrinterTurbo；不要把两种启动方式混淆。

## Apple Silicon（M1 / M2 / M3 / ARM64）

Docker Desktop 在 Apple Silicon 上使用 Linux ARM64 容器，因此 `workerd-linux-arm64` 是 Linux 容器的正确包；`workerd-darwin-arm64` 只用于直接运行在 macOS 上的工具。Alpine 使用 musl，预编译的 glibc 二进制即使存在，也可能报 `ENOENT` / `not found`。

TradePilot 的 Docker 服务运行在 Node.js，正常 `next build` / `next start` 不需要 Workerd。默认本地开发同样不初始化 Cloudflare 模拟器；只有显式设置 `TRADEPILOT_RUNTIME=cloudflare` 的 `next dev` 才加载它。Dockerfile 的构建和运行阶段固定使用 `TRADEPILOT_RUNTIME=node`，生产依赖与应用继续在目标架构的 Alpine 镜像中构建和运行，无需 AMD64 模拟或替换 macOS 二进制。

已有安装先保留原 `.env` 和数据卷，再重建 Web 与数据库初始化镜像：

```bash
docker compose build --no-cache tradepilot db-init
docker compose up -d tradepilot
docker compose ps -a
```

这只更新镜像和容器，不删除数据库或媒体卷；不要使用 `docker compose down -v`。若使用自定义项目名或 env 文件，以上命令增加原有 `-p` / `--env-file` 参数。

需要明确构建 ARM64 镜像时：

```bash
docker buildx build --platform linux/arm64 --target runner -t tradepilot:arm64 --load .
```

容器监听 `3456`，当前 Compose 默认映射到宿主机 `127.0.0.1:3461`；以 `.env` 中的 `PORT` 与 `docker compose ps` 显示为准。MoneyPrinterTurbo 的 8080 和 Redis 属于独立服务，运行正常不代表 CRM Web 已启动。

## 1. 首次配置

在项目根目录创建 `.env`（不要提交到 Git），设置：

```dotenv
BIND_ADDRESS=127.0.0.1
PORT=3461
AUTH_URL=http://localhost:3461
AUTH_SECRET=替换为随机密钥
TRADEPILOT_ADMIN_EMAIL=admin@tradepilot.local
TRADEPILOT_ADMIN_PASSWORD=替换为高强度密码
POSTGRES_PASSWORD=替换为独立数据库强密码
TRADEPILOT_WORKSPACE_SLUG=tradepilot-admin
TRADEPILOT_RESET_ADMIN_PASSWORD=false
```

可分别使用 `openssl rand -hex 32` 和 `openssl rand -hex 18` 生成密钥及密码。生产模式的管理员初始密码至少 16 位、包含两类字符，并拒绝公开示例/明显弱密码；首次登录还须改密。建议 `chmod 600 .env`。如果已有 env 文件，保留原认证/配置密钥、管理员身份和端口，不要用示例覆盖已有配置；历史弱管理员密码需按下文升级注意事项处理。`AUTH_URL` 与浏览器访问地址必须一致。默认绑定 loopback；不建议把本地试用直接暴露到公网。

```bash
# 在项目根目录；先校验，不输出含密码的完整配置
docker compose config --quiet
docker compose up -d --build tradepilot video-worker
docker compose ps -a
docker compose logs --tail=50 db-init
```

启动顺序是 PostgreSQL 健康 → `db-init` 迁移及初始化成功（退出 0）→ Web。初始化重跑不会覆盖已有数据库用户密码，也不会重新启用被停用的账号。首次会创建部署工作区；示例业务数据默认不导入。

打开 `http://localhost:3461/auth/login`，使用配置的部署管理员登录；若已在个人中心改过密码，以保存后的密码为准。部署管理员拥有平台管理权限，不应共享给客户。

## 2. 开始使用

1. **系统 → SaaS 管理**（仅部署运行者/平台管理员）：创建独立公司/工作区，设置人数上限并指定所有者；创建完成的一次性临时密码只显示一次。
2. 所有者登录，按提示在 **个人中心** 改密；旧会话将失效，需要重新登录。
3. **系统 → 团队管理**：所有者可创建管理员/成员；管理员只能管理普通成员。普通成员不具备团队管理或平台管理权限。
4. **系统 → 数据库管理**（仅平台管理员）：检查连接、结构迁移、统计、容量与 TLS；页面不提供任意 SQL、清空或在线恢复操作。
5. 普通工作区所有者/管理员在 **AI 用量** 配置自己的文本 Key、模型与月预算，在 **AI 获客 → 获客服务配置** 配置自己的 Firecrawl Cloud Key 与日预算；成员只能查看就绪状态，不能修改 Key 或借用实例 Key。文本额度取有效套餐、平台硬上限、工作区预算的最小值；搜索与产品抓取共用 UTC 日请求上限，失败也计次。**API 配置中心**仅平台管理员管理实例级服务，不替代上述工作区配置。
6. 阅读页面内的 AI 获客/营销说明；邮件中心「保存草稿」不发邮件，「复制订阅申请链接」也不代表收件人已确认同意。真实收发及供应商费用需另行验证。

本地受控试用如需自助注册，可在私有 `.env.preview` 增加 `TRADEPILOT_SELF_REGISTRATION=true` 并重建 Web 容器。默认关闭；每个新邮箱会创建一个**独立工作区所有者**，不会加入当前团队。不要将该开关直接用于公网生产。

详细说明见 [SaaS 多用户管理](./saas-multi-user.md)、[数据库管理](./database-management.md)、[个人中心](./account.md)。

## 3. 已有预览的安全升级

本机既有预览使用独立项目名 `tradepilot-preview` 和 `.env.preview`；不能混用默认项目或其他实例的卷。**本轮源码整改没有执行这些升级命令，3461 仍是旧镜像，现有试用密码未改。** 新生产代码会拒绝历史弱管理员密码；升级前先在受控旧实例的个人中心改为强密码，并按 [个人中心升级说明](account.md#生产管理员与升级注意事项) 备份，不能删除管理员文件来绕过检查。数据库密钥补充在私有 `.env.preview.database`，不覆盖原预览文件：

```bash
docker compose -p tradepilot-preview --env-file .env.preview --env-file .env.preview.database config --quiet
docker compose -p tradepilot-preview --env-file .env.preview --env-file .env.preview.database up -d --build tradepilot video-worker
```

升级前备份原 env、Web 数据卷、Worker 媒体卷和旧镜像；已有数据库还需数据库备份。旧版内存 CRM 无可自动恢复的持久历史，本次不会把其示例数组伪装成客户数据。旧获客 JSON/视频任务文件可随卷归档，但**不会自动导入新数据库**；如确有历史数据，需要单独核对格式、租户归属和去重后做迁移。不要直接删除旧文件。

## 4. 日常操作

下列通用命令默认使用 `.env` / 默认项目。已有预览需加上前述项目名和两个 `--env-file` 参数：

```bash
# 日志可能敏感，不要公开
docker compose logs --tail=100 postgres db-init tradepilot video-worker
# 暂停 Web / Worker，保留数据库和所有卷
docker compose stop tradepilot video-worker
# 恢复已创建的容器（环境不变）
docker compose start tradepilot video-worker
# 修改代码或配置后更新；仅 restart 不会更新容器环境
docker compose up -d --build tradepilot video-worker
# 数据库备份；复制到宿主机及异地，见数据库管理指南
docker compose exec tradepilot npm run db:backup -- /app/data/backups/before-upgrade.dump
```

容器配置为 `unless-stopped`；需保持 Docker Desktop 运行。**不要用 `down -v`，该命令会删除数据库及命名卷。** 恢复只能指向独立空库，不能覆盖在线库。

## 5. 数据与功能边界

- 工作区、数据库账号、核心 CRM、获客记录、邮件草稿/账号参数、视频任务元数据及字段/流程配置已按工作区存入 PostgreSQL。数据库故障返回 503，不回退共享内存或文件。
- 隔离是服务端工作区上下文 + tenant-bound SQL + 复合外键；目前没有启用 PostgreSQL RLS。客户已有负责人、团队和 private/team/workspace 访问检查，但不能据此承诺完整的字段/部门权限或所有关联资源都已端到端验收。
- 部署管理员档案、加密的实例 API 配置仍在 Web 数据卷；素材/视频在 Worker 卷或对象存储；浏览器部分草稿在 localStorage。**数据库 dump 不是整站备份**，当前也未完成多副本配置一致性。
- 邮件页面保存草稿不发送；后端已有 SMTP 发送、IMAP 同步、double opt-in 和退订抑制，真实收发仍需接口集成与测试邮箱验收。Webhook 已有租户凭据、轮换/签名/重放校验及入站记录，但未完成真实业务分发验收；手机/设备绑定仍 fail-closed 暂停。视频 Worker 健康不等于所有付费/外部渲染链路均已验证。
- LiveKit 实际语音会话需要 LiveKit / OpenAI 配置与独立 Agent。参见 [LiveKit 指南](./livekit-agents.md)，配置后启动 `voice` profile 中的 `livekit-agent`。
- Docker 和默认 Node.js 开发/生产均不初始化 Cloudflare 模拟器。只有 `TRADEPILOT_RUNTIME=cloudflare` 的开发阶段显式启用；Cloudflare 另需运行时/存储适配。

**本文描述本机多用户验证路径，不是公网 SaaS 上线许可。** 支付与租户 AI 配额等基础代码已存在；真实支付生命周期、邮件/退订合规、外部供应商链路、依赖安全门禁，以及 HTTPS、Secret/最小权限、监控/压测与灾备仍未完成生产验收。以审计文档最新整改表为准。
