<p align="center">
  <img src="public/icon-192x192.png" width="88" alt="TradePilot logo" />
</p>

<h1 align="center">TradePilot</h1>

<p align="center">
  <strong>开源 AI 客服营销、外贸 CRM 与产品视频工作台</strong>
</p>

<p align="center">
  询盘 · 客户 · 报价 · 订单 · AI 营销 · AI 获客 · 实时语音客服 · 产品视频
</p>

<p align="center">
  <a href="https://tradepilot.us.kg/"><strong>在线演示</strong></a>
  ·
  <a href="#快速部署"><strong>快速部署</strong></a>
  ·
  <a href="#产品视频工作流"><strong>视频工作流</strong></a>
  ·
  <a href="https://github.com/feifei9126/tradepilot/issues"><strong>反馈问题</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/feifei9126/tradepilot" alt="AGPL-3.0 license" />
  <img src="https://img.shields.io/github/stars/feifei9126/tradepilot?style=flat" alt="GitHub stars" />
  <img src="https://img.shields.io/github/last-commit/feifei9126/tradepilot" alt="Last commit" />
  <img src="https://img.shields.io/badge/Next.js-16-111827" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/Docker-self--hosted-1769e0" alt="Docker self-hosted" />
</p>

---

> **SaaS 上线状态：仍为 NO-GO，暂不向公网开放自助注册。** 本分支已将核心业务迁移到租户隔离的 PostgreSQL，并新增工作区、团队与数据库管理。支付订阅、租户 AI 密钥/预算、SMTP/IMAP 和 Webhook 已有基础接入与安全控制；本轮完成审计 P1-01～P1-08 的源码整改及隔离验证，但真实供应商验收、依赖安全门禁和生产运维验收仍未完成。可在受控本地环境验证邀请制多工作区，不代表商用上线验收通过。历史问题与整改证据见 [SaaS 上线功能审计](docs/saas-launch-audit-2026-09-29.md)。

## 先看效果

[![TradePilot 全球贸易控制台](public/tradepilot-console.png)](https://tradepilot.us.kg/)

> 仓库中的在线演示链接不保证与当前代码同步。新部署使用自己配置的管理员账号，**不要将本地试用密码用于公网环境**。
>
> **部署状态说明：** Docker + PostgreSQL 是当前试用路径；Cloudflare Workers 有 OpenNext 构建入口，但本次数据库连接/迁移尚未在 Workers 运行时验收，部署管理员、API 配置和视频素材仍有本地存储依赖，不能作为等价部署。详见 [Cloudflare 部署与限制](docs/cloudflare-deployment.md)。

TradePilot 面向 1-5 人外贸团队，把分散的客户资料、报价、订单、出货、AI 配置和产品内容生产放进同一个可自托管工作区。它不是只有一张 KPI 看板的演示项目，仓库同时包含业务 API、输入校验、测试、Docker 部署、视频 Worker 和第三方服务接入说明。

## 为什么是 TradePilot

| 你需要解决的问题           | TradePilot 的处理方式                                             |
| -------------------------- | ----------------------------------------------------------------- |
| 客户、询盘、报价和订单分散 | 用一条业务链关联客户、报价、订单、出货和单证草稿                  |
| AI 平台被单一供应商锁定    | 独立 API 配置中心，支持 12 个官方、聚合和本地接入选项      |
| 产品网页和素材整理耗时     | Firecrawl 抓取产品资料、图片和视频，确认后再导入                  |
| 产品视频制作链路割裂       | 本地 FFmpeg、MoneyPrinterTurbo、OpenMontage 三种生产路径统一管理  |
| SaaS 数据与二次开发受限    | AGPL-3.0 开源，支持 Docker 自托管和源码级扩展                     |
| 设置项容易配置失败         | 四步配置引导、平台地址预设、任务模型覆盖与连接测试 |

## 核心能力

### 外贸 CRM 与订单履约

- 客户档案、联系人、标签、来源与跟进状态
- 询盘创建、状态流转和 AI 回复草稿
- 报价草稿、贸易术语、成本加价与人工接受确认
- 报价转订单、订单进度、沟通记录和交期风险
- 出货、物流、供应商、财务汇总与单证草稿
- 基于真实业务记录生成的仪表盘、销售漏斗和待办提醒

### 独立 API 配置中心

**平台管理员**登录后从 **系统 → API 配置中心**（`/app/api-config`）管理实例服务，不在“设置”页面分散填写。以下四步与提供商选项描述平台入口；普通工作区的文本 Key、模型和预算在 **AI 用量**（`/app/ai-usage`）配置，Firecrawl Cloud Key 在 **AI 获客 → 获客服务配置** 配置。工作区配置需所有者/管理员操作，普通成员不能借用平台共享 Key。

1. **接入文本模型**：选择平台，填写 API Key、模型 ID 和接口地址。
2. **分配 AI 功能**：询盘、邮件、文字客服、客户资料识别、产品资料补全、报价、跟单、获客文案和视频脚本共用默认 API，也可逐项覆盖模型。
3. **连接语音与视频**：集中管理 LiveKit / OpenAI Realtime、视频适配器、MoneyPrinterTurbo；此处的 Firecrawl 仅用于实例诊断，不作为工作区业务抓取的凭据回退。
4. **验证并开始使用**：先保存，再测试连接；模型调用可能产生费用。

| 分类 | 接入选项 |
| --- | --- |
| 官方平台 | OpenAI（ChatGPT）、Kimi（Moonshot）、豆包（火山方舟）、Google Gemini、智谱 GLM、DeepSeek、通义千问 |
| 第三方聚合 | OpenRouter、硅基流动（SiliconFlow）、New API / One API 网关 |
| 本地及自定义 | Ollama、其他 OpenAI 兼容 API |

- 预设提供接口地址、模型 ID 填写提示和文档入口。新平台模型以账号控制台实际可用 ID 为准。
- 聚合平台可按业务功能选择不同厂商模型，仍共用聚合平台自身的地址和 Key。
- **Docker / Node 密钥存于服务端 AES-256-GCM 加密文件，不回显给浏览器。** 仅部署管理员可管理；当前是单实例配置，不是多租户密钥保险库。
- 切换平台清空旧密钥、请求头与任务模型，避免将旧凭据发给新服务。旧浏览器配置仅在明确选择后迁移。
- 文本接口采用 OpenAI Chat Completions 协议；不是所有图像、视频或实时语音模型都能通过这一接口调用。

详见 [统一 API 配置指南](docs/api-configuration.md)。

### LiveKit AI 语音客服与营销

登录后进入 **AI 语音客服**（`/app/voice-agent`）：

- 客服答疑 / 营销意向两种场景，中英文实时语音与字幕。
- 收集客户意向后由操作员确认，再创建 CRM 客户。
- 支持人工跟进请求与本地下载对话记录。
- 独立 Python Agent Worker 使用 LiveKit + OpenAI Realtime，在配置中心保存连接信息后加载。

**统一入口不等于一个 Key 访问所有服务。** 其他文本平台的 Key 不会用于 OpenAI Realtime。当前是内部工作台，不包含公开访客入口、自动电话外呼或真实人工坐席转接。AI 营销生成营销文案；AI 获客可在配置 Firecrawl 后按任务搜索公开网页、自动登记和初筛线索，但不登录社媒、自动投放或群发。

详见 [LiveKit Agents 接入说明](docs/livekit-agents.md)。

### Firecrawl 产品采集

- 从公开产品页提取名称、描述、规格、图片和视频
- 导入前预览与人工确认，不直接污染产品数据
- 抓取到的视频可进入 MoneyPrinterTurbo 重新编排
- 工作区所有者/管理员先在 **AI 获客 → 获客服务配置** 保存自己的 Firecrawl Cloud Key 和日预算；不使用实例 Key 或任意自托管地址
- 产品抓取与获客搜索共用工作区 UTC 日请求预算，失败和未结算请求也计次；这不是供应商的精确费用账单
- 当前产品抓取入口仅对平台管理员开放，普通成员不能通过兼容 API 绕过；弹窗提供配置提示、预览与确认，不再负责安装/部署 Firecrawl
- 独立平台诊断与 CLI 部署能力仍保留，不能把健康检查通过视作真实抓取验收

### 产品视频工作流

| 模式        | 适合场景           | 运行方式                                       |
| ----------- | ------------------ | ---------------------------------------------- |
| 本地快速    | 内部确认、快速样片 | FFmpeg Worker 生成可播放 MP4                   |
| AI 自动成片 | 社媒推广、客户介绍 | MoneyPrinterTurbo 处理配音、字幕、音乐和多素材 |
| 高级制作    | 品牌项目、复杂镜头 | OpenMontage 命令适配器接入自定义流水线         |

产品视频页包含引擎健康状态、素材输入、任务队列、进度、预览、下载、批量选择和删除。可勾选使用统一 AI 模型生成脚本，再交给渲染服务。视频任务元数据按工作区保存到 PostgreSQL，渲染文件保存到 Worker 卷或外部对象存储；两者需分别备份，数据库恢复不会还原 MP4 文件。

## 快速部署

### Docker 一键部署

前置条件：Docker Desktop，或已启用 Compose 插件的 Docker Engine。

```bash
git clone https://github.com/feifei9126/tradepilot.git
cd tradepilot
bash install.sh
```

安装器会：

1. 补充缺失的认证密钥、管理员密码和随机 PostgreSQL 密码，不覆盖已有账号配置。
2. 启动 PostgreSQL，执行前向迁移与首次账号初始化，再启动 TradePilot 和本地视频 Worker。
3. 在后台启动 MoneyPrinterTurbo 和 Redis。
4. 输出首次初始化账号、密码和状态命令；已有账号以个人中心修改后的密码为准，数据库密码不打印。

默认访问 [http://localhost:3461](http://localhost:3461)，以安装器实际输出为准。

常用命令：

```bash
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

### 最小 Docker 试用（推荐先从这里开始）

启动 Web、内置 PostgreSQL、一次性迁移与视频适配器，不自动拉取 MoneyPrinterTurbo / Redis，也不调用付费模型：

```bash
cp .env.example .env # 仅首次且 .env 不存在时执行；已有配置不要覆盖
chmod 600 .env
# 编辑 .env：填写随机 AUTH_SECRET、POSTGRES_PASSWORD、强管理员密码
# 默认 AUTH_URL=http://localhost:3461；随机值可用 openssl rand -hex 32 生成。
# 不要覆盖已有部署的加密密钥；修改端口时同时修改 PORT 和 AUTH_URL。
docker compose up -d --build tradepilot video-worker
```

使用 `.env` 中的管理员账号登录，然后进入 API 配置中心。语音 Worker 按需启动：

```bash
docker compose --profile voice up -d --build livekit-agent
```

**使用期间保持 Docker Desktop 运行。** 默认仅监听本机 `127.0.0.1:3461`，其他电脑不能直接访问。若页面打不开，先检查 Docker，再执行 `docker compose ps`；已创建的试用容器可先启动 `postgres`，再启动 `tradepilot video-worker`；有版本变化时使用 `up` 重新执行迁移。不要执行 `docker compose down -v`，以免删除数据卷。

完整说明：[Docker 本地试用](docs/docker-trial.md)。

### 本地开发

> 当前 NextAuth 版本把 Nodemailer 声明为可选 peer（范围仅到 8.x），而 TradePilot 的租户 SMTP 使用 Nodemailer 10。项目不使用 NextAuth Email Provider，因此安装命令需带 `--legacy-peer-deps`；此参数会跳过 npm 的 peer 依赖校验，依赖升级后应复查并在上游兼容后移除。

```bash
git clone https://github.com/feifei9126/tradepilot.git
cd tradepilot
npm ci --legacy-peer-deps
# 准备 PostgreSQL，配置 .env.local 的 PG*、AUTH_SECRET 和管理员账号
# 详细步骤见 docs/database-management.md
npm run db:init
npm run dev
```

开发地址为 [http://localhost:3458](http://localhost:3458)。数据库是必需项，不可用时业务返回 503，不会回退共享内存。演示账号仅在显式设置 `TRADEPILOT_SEED_DEMO=true` 初始化时创建，生产不得使用演示密码。

生产运行：

```bash
npm run build
npm start
```

`npm start` 会同时管理 Next.js 和本地视频 Worker；无需再开第二个终端。只启动网页可设置 `TRADEPILOT_START_VIDEO_WORKER=false`。

### Cloudflare Workers（构建预览，非 Docker 等价部署）

GitHub 用于托管源码；本项目有登录、服务端 API 和独立 Worker，**不能直接部署为 GitHub Pages 静态站点**。

仓库使用 OpenNext + Wrangler 生成 Cloudflare Worker：

```bash
npm ci --legacy-peer-deps
npm run cfbuild
npx wrangler deploy --dry-run
```

**构建通过不代表功能可上线。** 当前仍有以下必须处理的限制：

- 部署管理员与 API 配置仍使用本地文件；Workers 没有等价持久磁盘，不能用 `/tmp` 代替。
- CRM、获客和视频任务元数据已迁移 PostgreSQL，但连接池、事务锁、迁移启动与 TLS 仍须在 Workers 运行时独立验收；不能拿 Docker 测试结果替代。
- Python LiveKit Agent、FFmpeg、MoneyPrinterTurbo 和抓取引擎需要独立服务，不会随 Web Worker 一起部署。
- `DATABASE_URL` 不会自动迁移旧版 JSON 文件、媒体或解密主密钥，也不会让外部 Worker 自动上线。

在接入持久化存储、配置线上强凭据并完成运行时验收前，不建议覆盖既有线上站点。Cloudflare 登录、Secrets、隔离预览、验收和回滚步骤见 [Cloudflare 部署说明](docs/cloudflare-deployment.md)。

## 工作流

```mermaid
flowchart LR
  A[公开产品页] --> B[Firecrawl 预览]
  B --> C[产品目录]
  C --> D[询盘与报价]
  D --> E[订单与履约]
  C --> F[产品视频]
  F --> G[本地 FFmpeg]
  F --> H[MoneyPrinterTurbo]
  F --> I[OpenMontage]
  J[统一 API 配置中心：官方模型 / 聚合平台 / Ollama] --> D
  J --> F
```

## 配置

复制环境变量模板：

```bash
cp .env.example .env
```

关键配置：

| 变量                        | 用途                                        |
| --------------------------- | ------------------------------------------- |
| `AUTH_SECRET`               | NextAuth 会话签名密钥，生产环境必须随机生成 |
| `TRADEPILOT_ADMIN_EMAIL`    | 部署管理员邮箱                              |
| `TRADEPILOT_ADMIN_PASSWORD` | 生产初始密码至少 16 位、两类字符；已保存哈希优先，不被环境变量重置 |
| `DATABASE_URL`              | 外部 PostgreSQL 连接；Docker 也可使用离散 `PG*` 变量（业务数据库必需） |
| `METRICS_TOKEN`              | 可选，启用 Bearer Token 保护的 Prometheus `/api/metrics` 端点 |
| `TRADEPILOT_DATA_DIR`       | API 加密配置与产品视频任务目录（Docker / Node）                      |
| `OPENMONTAGE_WORKER_URL`    | OpenMontage / 本地 FFmpeg Worker 地址       |
| `MONEYPRINTERTURBO_URL`     | MoneyPrinterTurbo API 地址                  |
| `FIRECRAWL_API_URL`         | 平台实例 Firecrawl 诊断地址；不作为租户搜索/产品抓取回退 |
| `FIRECRAWL_API_KEY`         | 平台实例 Firecrawl 诊断 Key；业务使用工作区加密 Cloud Key |
| `TRADEPILOT_CONFIG_KEY`     | 可选独立配置加密密钥；未设置时使用 `AUTH_SECRET`，至少 32 字符 |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit 连接参数 |
| `OPENAI_API_KEY`            | 可选 OpenAI Realtime 环境回退凭据，不自动作为统一文本 Key |

## 数据与功能边界

开源项目的可信度来自边界清楚，而不是功能列表越长越好：

- 当前 CRM 与获客等核心业务数据以 PostgreSQL 为持久化存储；数据库不可用时业务请求失败，不回退到共享内存样例数据。管理员配置、媒体文件和浏览器草稿仍分别位于配置卷、Worker/对象存储和浏览器本地，须按[数据库管理指南](docs/database-management.md)分别备份。
- 工作区和团队权限已有数据库与服务端隔离基础，但这不等于全部 API 均已完成生产级客户对象权限审计；公网 SaaS 当前仍为 NO-GO。
- 邮件支持账号配置、草稿及部分 IMAP/SMTP 接入代码；真实生产邮件链路、租户级运行、退订合规和供应商验收仍须完成，不应仅凭页面宣称全自动邮件营销已就绪。
- 单证为可下载的业务草稿，对外使用前必须核对卖方、包装、支付和合规字段。
- 插件通过源码目录与脚本管理，不在生产环境执行未经审查的第三方运行时代码。
- AI 输出、抓取内容和视频脚本都应由业务人员确认后使用。
- 密钥、数据库 URL、真实客户资料、加密配置文件和数据卷都不能提交到 GitHub；更换加密密钥前须备份原密钥与配置文件。
- 真实模型、实时语音、抓取与完整视频渲染需要对应账号权限和独立服务；本地 mock 测试不等于真实厂商联调。
- 仓库含 CI 依赖审计与 Dependabot 配置，但每次安全告警仍须人工分级修复；公网部署前必须使用 HTTPS、独立强凭据和 Secret Manager，不能照搬公开试用账号。

## 技术栈

| 层级      | 技术                                           |
| --------- | ---------------------------------------------- |
| Web       | Next.js 16、React 19、TypeScript、Tailwind CSS |
| UI        | Base UI、Lucide、Motion                        |
| Auth / DB | NextAuth、Drizzle ORM、pg、PostgreSQL 16（支持外部 PostgreSQL） |
| AI        | 统一配置、OpenAI 兼容请求层、Ollama                      |
| 语音      | LiveKit Agents、OpenAI Realtime、Python / uv |
| 采集      | Firecrawl                                      |
| 视频      | FFmpeg、MoneyPrinterTurbo、OpenMontage Adapter |
| 部署      | Docker Compose、OpenNext、Cloudflare Workers   |
| 测试      | Node Test Runner、TSX                          |

## 项目结构

```text
tradepilot/
├── src/app/                 # 页面与 API 路由
├── src/components/          # 业务组件与 UI 基础组件
├── src/lib/                 # AI、业务、采集、视频与安全逻辑
├── tests/                   # 业务、配置安全、LiveKit、视频与构建测试
├── agents/customer-service/ # 独立 Python LiveKit Agent Worker
├── workers/openmontage-adapter/
├── docs/                    # 集成与部署说明
├── docker-compose.yml
├── install.sh
└── wrangler.jsonc
```

深入文档：

- [统一 API 配置与 12 个提供商接入](docs/api-configuration.md)
- [Docker 本地试用与恢复](docs/docker-trial.md)
- [SaaS 多工作区 / 团队权限（初学者）](docs/saas-multi-user.md)
- [数据库配置 / 迁移 / 备份恢复（初学者）](docs/database-management.md)
- [SaaS 上线审计与整改证据](docs/saas-launch-audit-2026-09-29.md)
- [生产运维、监控与发布门禁](docs/production-operations.md)
- [AI 获客使用说明](docs/prospecting.md)
- [AI 营销使用说明](docs/ai-marketing.md)
- [LiveKit AI 语音客服](docs/livekit-agents.md)
- [Cloudflare 部署限制与验收](docs/cloudflare-deployment.md)

- [Firecrawl 产品媒体采集](docs/firecrawl-product-media.md)
- [MoneyPrinterTurbo 产品视频](docs/moneyprinterturbo-product-video.md)
- [OpenMontage 产品视频](docs/openmontage-product-video.md)
- [架构说明](ARCHITECTURE.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)

## 验证

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
# 必须显式指定独立的 loopback 测试库（库名以 _test 结尾，不能用生产库）
TEST_DATABASE_URL=独立测试库连接串 npm run test:db
# 如使用 LiveKit Worker（需安装 uv）
uv run --directory agents/customer-service pytest -q
uv run --directory agents/customer-service ruff check .
# Cloudflare 构建检查，不会上传
npm run cfbuild
npx wrangler deploy --dry-run
```

单元测试覆盖业务流程、输入限制、账号会话、服务配置、请求安全与媒体地址。独立 PostgreSQL 集成测试覆盖双租户 CRUD/导入导出隔离、复合外键、权限、并发名额、会话撤销、迁移/初始化重跑和数据库故障拒绝。内部路由测试不替代真实 HTTP 登录、付费厂商联调、HTTPS/安全审计、压测或灾备制度；不得以构建成功宣称生产验收完成。

## 适用场景

TradePilot 适合寻找以下方案的开发者和小型团队：开源外贸 CRM、外贸订单管理系统、跨境贸易管理、自托管 CRM、私有化 AI 跟单、Ollama 外贸应用、Firecrawl 商品采集，以及产品视频自动生成工作流。

## 参与项目

- 使用问题与功能建议：[GitHub Issues](https://github.com/feifei9126/tradepilot/issues)
- 提交代码前阅读：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全问题请按：[SECURITY.md](SECURITY.md)

如果这个项目解决了你的实际问题，可以在 GitHub 点 Star，帮助更多需要开源外贸管理工具的团队发现它。

## License

TradePilot 使用 [GNU AGPL-3.0](LICENSE) 许可证。通过网络提供修改后的版本时，请遵守 AGPL-3.0 的源代码开放要求。
