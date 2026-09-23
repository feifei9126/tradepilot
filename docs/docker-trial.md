# Docker 本地试用

这套试用只启动 CRM Web 和视频适配器，不自动启用需要外部服务密钥的语音服务，也不拉取 MoneyPrinterTurbo/Redis。

## 首次配置

在项目根目录创建 `.env`（不要提交到 Git），设置：

```dotenv
BIND_ADDRESS=127.0.0.1
PORT=3456
AUTH_URL=http://localhost:3456
AUTH_SECRET=替换为随机密钥
TRADEPILOT_ADMIN_EMAIL=admin@tradepilot.local
TRADEPILOT_ADMIN_PASSWORD=替换为高强度密码
```

可分别使用 `openssl rand -hex 32` 和 `openssl rand -hex 18` 生成密钥及密码。建议 `chmod 600 .env`。如果已有 `.env`，保留现有配置，只补充缺失项。

```bash
docker compose up -d --build tradepilot video-worker
docker compose ps
```

打开 `http://localhost:3456/auth/login`，使用 `.env` 中的管理员账号登录。先打开 **系统 → API 配置中心**（`/app/api-config`），按四步向导填写服务配置。AI 语音客服页面位于 `/app/voice-agent`。

默认只监听本机，不能直接从其他电脑访问。不要在尚未修复现有依赖安全问题、配置 HTTPS 和验证权限之前开放公网。

## 日常操作

```bash
# 查看日志（注意不要公开含敏感信息的日志）
docker compose logs --tail=100 tradepilot video-worker
# 停止试用服务
docker compose stop tradepilot video-worker
# 恢复已创建的容器
docker compose start tradepilot video-worker
# 修改代码或配置后重建
docker compose up -d --build tradepilot video-worker
```

容器配置为 `unless-stopped`；需保持 Docker Desktop 运行。不要用 `down -v`，该命令会删除命名卷。

## 功能边界

- **CRM 核心客户等业务数据仍使用原项目内存存储，容器重启会丢失这些数据。** 命名卷不等于 CRM 已完成数据库持久化，试用请勿录入重要或真实客户资料。
- 视频适配器健康不代表所有渲染链路均已验证；此试用未启动 MoneyPrinterTurbo。
- LiveKit 页面可浏览，但实际语音会话需配置 `LIVEKIT_URL`、`LIVEKIT_API_KEY`、`LIVEKIT_API_SECRET` 和 `OPENAI_API_KEY`。参见 `docs/livekit-agents.md`，配置后启动 `voice` profile 中的 `livekit-agent` 服务。
- Docker 镜像构建和运行不应启动 Cloudflare 开发模拟器；`next.config.ts` 仅在开发阶段初始化它。
