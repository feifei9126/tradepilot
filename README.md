<p align="center">
  <img src="https://img.shields.io/github/license/feifei9126/tradepilot" alt="License">
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome">
</p>

<h1 align="center">TradePilot · 开源 AI 外贸管理平台</h1>

<p align="center">
  <strong>面向 1-5 人小型外贸公司<br/>
  开源免费 · 自配 AI · 一键部署 · 可继续二次开发</strong>
</p>

<p align="center">
  <i>年费 ¥0 vs 竞品 ¥5,000-30,000/年</i>
</p>

---

## 📋 目录

- [为什么选择 TradePilot？](#-为什么选择-tradepilot)
- [功能一览](#-功能一览)
- [快速开始](#-快速开始)
- [技术栈](#-技术栈)
- [项目结构](#-项目结构)
- [截图](#-截图)
- [与竞品对比](#-与竞品对比)
- [贡献指南](#-贡献指南)
- [许可证](#-许可证)

---

## 💡 为什么选择 TradePilot？

### 痛点

中国 50 万家外贸企业中，1-5 人小团队占绝大多数。他们面临的困境：

| 问题          | 传统方案               | 我们的方案                     |
| ------------- | ---------------------- | ------------------------------ |
| **年费高昂**  | 小满 OKKI ¥20,000+/年  | **¥0（开源免费）**             |
| **AI 被锁定** | 商业软件额外加收 AI 费 | **自带 API Key，用多少付多少** |
| **部署复杂**  | 需专业 IT 团队         | **bash install.sh 一键搞定**   |
| **数据控制**  | 客户资料存第三方服务器 | **自行部署和管理运行环境**     |
| **二次开发**  | 依赖厂商排期           | **源码可审查和修改**           |

### 三大差异化

|    ⭐    | 能力         | 说明                                                       |
| :------: | ------------ | ---------------------------------------------------------- |
| **开源** | AGPL v3      | 代码完全公开，可审计、可定制、可私有部署                   |
|  **AI**  | 自带 API Key | 支持 DeepSeek/OpenAI/通义千问/Ollama，费用由所选服务商决定 |
| **部署** | 一键安装     | Docker Compose 构建并启动主站和视频 Worker                 |

---

## ✨ 功能一览

### CRM 核心

- **客户管理** — 360° 客户档案、联系人、跟进时间线、标签分组
- **询盘管理** — 多渠道来源、状态流转、AI 回复草稿
- **报价管理** — AI 报价草稿、状态确认、接受后转订单
- **订单管理** — 订单进度、沟通记录、出货与单证草稿

### 邮件中心

- **邮件工作台** — 示例邮件查看、本地草稿与客户关联；真实收发需另接 IMAP/SMTP Worker
- **AI 辅助** — AI 邮件与回复草稿
- **邮箱设置** — 保存非敏感 IMAP/SMTP 连接参数草稿；当前未内置收发 Worker

### 文档与单证

- **单证草稿** — 商业发票、装箱单和形式发票的 HTML 预览与下载
- **使用边界** — 卖方、包装、支付等缺失字段需人工补全，对外使用前必须核对

### AI 能力

- **AI 邮件** — 根据上下文自动生成开发信
- **AI 客户导入** — 从聊天文本提取客户资料
- **AI 跟单建议** — 基于订单状态推荐下一步
- **AI 产品资料** — 根据产品名生成可编辑的资料草稿
- **支持模型** — DeepSeek、GPT-4o、通义千问、Ollama（本地）
- **产品视频** — 本地 FFmpeg、MoneyPrinterTurbo AI 自动成片与 OpenMontage 高级制作

### 数据决策

- **仪表盘** — 基于当前内存业务记录生成 KPI、销售漏斗和交付提醒
- **汇率参考** — 通过 Frankfurter/ECB 获取公开参考汇率；请求失败时不伪造数据

### 扩展能力

- **插件开发** — 创建和审查插件源码骨架；当前版本不自动加载第三方运行时代码
- **侧栏定制** — 菜单排序、显示隐藏

---

## 🚀 快速开始

### 方式一：Docker 一键部署（推荐，¥0）

```bash
# 安装 Docker（如已安装可跳过）
curl -fsSL https://get.docker.com | bash

# 下载并启动 TradePilot
git clone https://github.com/feifei9126/tradepilot.git
cd tradepilot
bash install.sh
```

安装完成后打开 `http://localhost:3456`。脚本会生成随机管理员密码、写入项目 `.env`，并在终端显示登录账号和密码。

### 方式二：本地开发运行

```bash
git clone https://github.com/feifei9126/tradepilot.git
cd tradepilot
npm install
npm run dev
```

本地开发未配置管理员环境变量时，可使用 `demo@tradepilot.dev` / `password`；生产模式必须配置 `TRADEPILOT_ADMIN_EMAIL` 和 `TRADEPILOT_ADMIN_PASSWORD`。

本机已经使用 PM2 常驻运行时，执行 `./start.sh` 只会重启现有 TradePilot 实例，不会重复创建进程。需要进入 Next.js 开发模式时，先执行 `pm2 stop tradepilot`，避免与常驻服务争用端口和 `.next` 构建目录。

### 方式三：云服务器部署

购买一台 2 核 4G 云服务器（腾讯云/阿里云轻量应用服务器 ¥68/月起），SSH 登录后执行方式一的命令即可。

### 配置 AI

启动后，进入「设置 → AI 提供商」，填入你的 API Key：

```
DeepSeek：   sk-xxxx（按服务商当前规则计费）
OpenAI：     sk-xxxx（按量付费）
通义千问：   按服务商当前规则计费
Ollama：     模型本地运行，硬件和电力成本自理
```

### 配置产品视频

Docker 一键脚本先启动 TradePilot 和本地 FFmpeg Worker，再在后台启动 MoneyPrinterTurbo 和 Redis。主站无需等待 AI 视频镜像下载；连接状态可在产品视频页查看，失败后也可以单独重试。产品视频任务保存在持久卷中，服务重启后仍可查询、预览和删除。

```bash
bash install.sh
```

产品视频页提供三种引擎：

- `本地快速`：用 FFmpeg 和产品图片生成基础验证成片。
- `AI 自动成片`：MoneyPrinterTurbo 生成配音、字幕、背景音乐和多素材短视频。
- `高级制作`：通过 OpenMontage 命令流水线完成复杂镜头与动效。

本地 Node.js 开发时，执行 `npm start` 会自动启动网页和本地 FFmpeg Worker，不需要第二个终端。MoneyPrinterTurbo 推荐通过 Docker Compose 启动：

```bash
docker compose up -d moneyprinterturbo
```

需要单独调试 Worker 时执行：

```bash
npm run video-worker
```

单独启动 Web 时设置：

```bash
OPENMONTAGE_WORKER_URL=http://localhost:8787
```

MoneyPrinterTurbo 使用私有 Docker 网络，不要把 8080 端口直接暴露到公网。跨服务器部署必须增加 HTTPS 和访问控制。

详细说明见 [MoneyPrinterTurbo 集成文档](docs/moneyprinterturbo-product-video.md)、[OpenMontage 集成文档](docs/openmontage-product-video.md)和 [Firecrawl 产品媒体采集](docs/firecrawl-product-media.md)。

### 配置 Firecrawl 产品采集

Firecrawl 把公开商品网页转换成可确认的产品资料、图片和视频素材；抓到的视频可在产品视频页交给 MoneyPrinterTurbo 重新编排。进入「产品」→「Firecrawl 抓取」，页面会说明完整流程，并提供环境检测、后台部署进度、日志和连接验证。

本机部署只需先启动 Docker Desktop，再点击「一键部署 Firecrawl」。命令行兜底方式：

```bash
npm run firecrawl:deploy
```

安装器固定使用官方 `v2.11.0` 完整 Compose，并在启动后执行真实抓取验证。已有 Firecrawl Cloud 或自托管服务仍可通过 `FIRECRAWL_API_URL`、`FIRECRAWL_API_KEY` 配置，环境变量优先于本机托管配置。详细前置条件、Docker 场景和故障排查见 [Firecrawl 产品媒体采集](docs/firecrawl-product-media.md)。

---

## 📦 技术栈

| 层级         | 技术                              | 说明                                       |
| ------------ | --------------------------------- | ------------------------------------------ |
| **前端框架** | Next.js 16 + React 19             | 全栈 React 框架                            |
| **UI 组件**  | shadcn/ui + Tailwind CSS          | 美观、可定制                               |
| **数据存储** | 进程内业务数据 + 视频任务文件仓库 | CRM 演示数据重启后复位；视频任务写入持久卷 |
| **AI 引擎**  | OpenAI 兼容请求层                 | 支持多提供商、自定义地址和 Ollama          |
| **容器化**   | Docker + Docker Compose           | 一键部署                                   |
| **包管理**   | npm                               |                                            |

---

## 📁 项目结构

```
tradepilot/
├── src/
│   ├── app/
│   │   ├── api/          # 46 个 API 路由
│   │   └── app/          # 28 个页面
│   ├── components/       # 24 个组件
│   ├── lib/              # 13 个模块
│   └── db/schema/        # 14 个数据表
├── plugins/              # 插件源码骨架（当前不自动加载运行）
├── Dockerfile
├── docker-compose.yml
├── install.sh
└── README.md
```

---

## 📊 与竞品对比

| 对比项      |   OKKI   | 富通天下 | 孚盟软件 |    **TradePilot**     |
| ----------- | :------: | :------: | :------: | :-------------------: |
| 软件许可费  | 商业订阅 | 商业订阅 | 商业订阅 | **AGPL v3，无许可费** |
| 开源        |    ❌    |    ❌    |    ❌    |    **✅ AGPL v3**     |
| 数据自主    | ❌ SaaS  | ❌ SaaS  | ❌ SaaS  |     **✅ 自部署**     |
| AI 自配 Key |    ❌    |    ❌    |    ❌    |        **✅**         |
| 客户管理    |    ✅    |    ✅    |    ✅    |        **✅**         |
| 邮件管理    |    ✅    |    ✅    |    ✅    |        **✅**         |
| 报价单      |    ✅    |    ✅    |    ✅    |        **✅**         |
| 订单管理    |    ✅    |    ✅    |    ✅    |        **✅**         |
| 多币种      |    ✅    |    ✅    |    ✅    |  **🚧 数据模型预留**  |
| 单证生成    |    ✅    |    ✅    |    ❌    |      **⚡ 基础**      |
| 插件扩展    |    ❌    |    ❌    |    ❌    |  **🚧 源码骨架管理**  |
| 部署方式    | 注册即用 | 注册即用 | 注册即用 | **Docker / 本机脚本** |

---

## 🤝 贡献指南

我们欢迎任何形式的贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与。

### 贡献方式

- 🐛 **提交 Issue** — 报告 Bug 或提出功能建议
- 📝 **完善文档** — 改进 README、添加教程
- 💻 **提交代码** — 修复 Bug、开发新功能
- 🌐 **翻译** — 添加多语言支持

### 开发环境

```bash
git clone https://github.com/feifei9126/tradepilot.git
cd tradepilot
npm install
npx next dev -p 3456
```

---

## 📄 许可证

本项目采用 **AGPL v3** 协议开源。

- ✅ 个人和商业用户可免费使用、修改、部署
- ✅ 修改后的代码如果作为网络服务提供，需要开源
- ❌ 不允许闭源的 SaaS 化商业利用而不回馈社区

---

<p align="center">
  <b>TradePilot</b> — 让小型外贸公司用极低成本享受大公司级别的数字化工具<br/>
  <a href="https://github.com/feifei9126/tradepilot">GitHub</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="https://github.com/feifei9126/tradepilot/issues">反馈</a>
</p>
