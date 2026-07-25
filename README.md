<p align="center">
  <img src="public/icon-192x192.png" width="88" alt="TradePilot logo" />
</p>

<h1 align="center">TradePilot</h1>

<p align="center">
  <strong>开源 AI 外贸 CRM、订单履约与产品视频工作台</strong>
</p>

<p align="center">
  客户 · 询盘 · 报价 · 订单 · 出货 · AI 模型 · 产品视频
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

## 先看效果

[![TradePilot 全球贸易控制台](public/tradepilot-console.png)](https://tradepilot.us.kg/)

| 在线演示 | 信息                                                   |
| -------- | ------------------------------------------------------ |
| 地址     | [https://tradepilot.us.kg/](https://tradepilot.us.kg/) |
| 测试账号 | `demo@tradepilot.dev`                                  |
| 测试密码 | `12345678`                                             |

TradePilot 面向 1-5 人外贸团队，把分散的客户资料、报价、订单、出货、AI 配置和产品内容生产放进同一个可自托管工作区。它不是只有一张 KPI 看板的演示项目，仓库同时包含业务 API、输入校验、测试、Docker 部署、视频 Worker 和第三方服务接入说明。

## 为什么是 TradePilot

| 你需要解决的问题           | TradePilot 的处理方式                                             |
| -------------------------- | ----------------------------------------------------------------- |
| 客户、询盘、报价和订单分散 | 用一条业务链关联客户、报价、订单、出货和单证草稿                  |
| AI 平台被单一供应商锁定    | BYOK，自行配置 OpenAI、DeepSeek、通义千问、Ollama 或兼容 API      |
| 产品网页和素材整理耗时     | Firecrawl 抓取产品资料、图片和视频，确认后再导入                  |
| 产品视频制作链路割裂       | 本地 FFmpeg、MoneyPrinterTurbo、OpenMontage 三种生产路径统一管理  |
| SaaS 数据与二次开发受限    | AGPL-3.0 开源，支持 Docker 自托管和源码级扩展                     |
| 设置项容易配置失败         | 提供 Base URL、请求路径、模型映射、User-Agent、Headers 和代理覆盖 |

## 核心能力

### 外贸 CRM 与订单履约

- 客户档案、联系人、标签、来源与跟进状态
- 询盘创建、状态流转和 AI 回复草稿
- 报价草稿、贸易术语、成本加价与人工接受确认
- 报价转订单、订单进度、沟通记录和交期风险
- 出货、物流、供应商、财务汇总与单证草稿
- 基于真实业务记录生成的仪表盘、销售漏斗和待办提醒

### AI 模型与 Ollama

- 支持 OpenAI、DeepSeek、通义千问与 OpenAI 兼容服务
- 支持 Ollama 本地模型检测、推荐模型和安装命令
- 可配置完整 API 请求地址、模型映射和自定义请求头
- 支持自定义 User-Agent、本地代理与请求地址覆盖
- API Key 保存在当前浏览器，通过 TradePilot 服务端发起请求

### Firecrawl 产品采集

- 从公开产品页提取名称、描述、规格、图片和视频
- 导入前预览与人工确认，不直接污染产品数据
- 抓取到的视频可进入 MoneyPrinterTurbo 重新编排
- 本地环境提供 Docker 检测、部署进度、日志和连接验证

### 产品视频工作流

| 模式        | 适合场景           | 运行方式                                       |
| ----------- | ------------------ | ---------------------------------------------- |
| 本地快速    | 内部确认、快速样片 | FFmpeg Worker 生成可播放 MP4                   |
| AI 自动成片 | 社媒推广、客户介绍 | MoneyPrinterTurbo 处理配音、字幕、音乐和多素材 |
| 高级制作    | 品牌项目、复杂镜头 | OpenMontage 命令适配器接入自定义流水线         |

产品视频页包含引擎健康状态、素材输入、任务队列、进度、预览、下载、批量选择和删除。任务数据可写入持久卷，服务重启后仍可查询。

## 快速部署

### Docker 一键部署

前置条件：Docker Desktop，或已启用 Compose 插件的 Docker Engine。

```bash
git clone https://github.com/feifei9126/tradepilot.git
cd tradepilot
bash install.sh
```

安装器会：

1. 生成认证密钥和随机管理员密码。
2. 构建并启动 TradePilot 与本地视频 Worker。
3. 在后台启动 MoneyPrinterTurbo 和 Redis。
4. 在终端输出登录账号、密码和服务状态命令。

完成后访问 [http://localhost:3456](http://localhost:3456)。

常用命令：

```bash
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

### 本地开发

```bash
git clone https://github.com/feifei9126/tradepilot.git
cd tradepilot
npm install
npm run dev
```

开发地址为 [http://localhost:3458](http://localhost:3458)。未配置环境变量时使用演示账号 `demo@tradepilot.dev` / `12345678`。

生产运行：

```bash
npm run build
npm start
```

`npm start` 会同时管理 Next.js 和本地视频 Worker；无需再开第二个终端。只启动网页可设置 `TRADEPILOT_START_VIDEO_WORKER=false`。

### Cloudflare Workers

仓库保留 OpenNext + Wrangler 部署配置。数据库连接和认证信息必须使用 Cloudflare Secrets，禁止写入 `wrangler.jsonc`：

```bash
npm install
npx wrangler secret put DATABASE_URL
npx wrangler secret put AUTH_SECRET
npx wrangler secret put TRADEPILOT_ADMIN_EMAIL
npx wrangler secret put TRADEPILOT_ADMIN_PASSWORD
npm run deploy:cloudflare
```

初始化 PostgreSQL / Neon 表和管理员账号：

```bash
DATABASE_URL='postgresql://...' \
TRADEPILOT_ADMIN_EMAIL='admin@example.com' \
TRADEPILOT_ADMIN_PASSWORD='replace-with-a-strong-password' \
npm run db:init
```

Cloudflare Workers 不运行 Docker、FFmpeg 或本地文件系统任务。使用 Cloudflare 部署时，需要把 Firecrawl、MoneyPrinterTurbo 和 OpenMontage Worker 部署为独立服务，再通过环境变量连接。完整产品视频能力优先推荐 Docker 部署。

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
  J[OpenAI / DeepSeek / 通义千问 / Ollama] --> D
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
| `TRADEPILOT_ADMIN_PASSWORD` | 部署管理员密码                              |
| `DATABASE_URL`              | 可选，启用 PostgreSQL / Neon 注册账号       |
| `TRADEPILOT_DATA_DIR`       | 产品视频任务持久化目录                      |
| `OPENMONTAGE_WORKER_URL`    | OpenMontage / 本地 FFmpeg Worker 地址       |
| `MONEYPRINTERTURBO_URL`     | MoneyPrinterTurbo API 地址                  |
| `FIRECRAWL_API_URL`         | Firecrawl Cloud 或自托管 API 地址           |
| `FIRECRAWL_API_KEY`         | Firecrawl API Key                           |

## 数据与功能边界

开源项目的可信度来自边界清楚，而不是功能列表越长越好：

- 客户、询盘、报价和订单的默认演示数据保存在进程内，服务重启后恢复种子数据。
- PostgreSQL / Neon 当前用于注册账号；业务多租户持久化仍需要继续接入。
- 邮件中心保存草稿和非敏感连接参数，真实 IMAP/SMTP 收发需要独立 Worker。
- 单证为可下载的业务草稿，对外使用前必须核对卖方、包装、支付和合规字段。
- 插件通过源码目录与脚本管理，不在生产环境执行未经审查的第三方运行时代码。
- AI 输出、抓取内容和视频脚本都应由业务人员确认后使用。

## 技术栈

| 层级      | 技术                                           |
| --------- | ---------------------------------------------- |
| Web       | Next.js 16、React 19、TypeScript、Tailwind CSS |
| UI        | Base UI、Lucide、Motion                        |
| Auth / DB | NextAuth、Drizzle ORM、Neon PostgreSQL         |
| AI        | OpenAI 兼容请求层、Ollama                      |
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
├── tests/                   # 业务、Firecrawl、产品视频测试
├── workers/openmontage-adapter/
├── docs/                    # 集成与部署说明
├── docker-compose.yml
├── install.sh
└── wrangler.jsonc
```

深入文档：

- [Firecrawl 产品媒体采集](docs/firecrawl-product-media.md)
- [MoneyPrinterTurbo 产品视频](docs/moneyprinterturbo-product-video.md)
- [OpenMontage 产品视频](docs/openmontage-product-video.md)
- [架构说明](ARCHITECTURE.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)

## 验证

```bash
npm test
npm run lint
npm run build
```

当前测试覆盖报价转订单、出货状态联动、输入完整性、Webhook 鉴权、Ollama 地址安全、Firecrawl SSRF 防护、视频任务持久化和 Worker 资产地址约束。

## 适用场景

TradePilot 适合寻找以下方案的开发者和小型团队：开源外贸 CRM、外贸订单管理系统、跨境贸易管理、自托管 CRM、私有化 AI 跟单、Ollama 外贸应用、Firecrawl 商品采集，以及产品视频自动生成工作流。

## 参与项目

- 使用问题与功能建议：[GitHub Issues](https://github.com/feifei9126/tradepilot/issues)
- 提交代码前阅读：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全问题请按：[SECURITY.md](SECURITY.md)

如果这个项目解决了你的实际问题，可以在 GitHub 点 Star，帮助更多需要开源外贸管理工具的团队发现它。

## License

TradePilot 使用 [GNU AGPL-3.0](LICENSE) 许可证。通过网络提供修改后的版本时，请遵守 AGPL-3.0 的源代码开放要求。
