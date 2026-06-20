<p align="center">
  <img src="https://img.shields.io/github/license/tradepilot/tradepilot" alt="License">
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome">
</段>



<p 对齐="居中">
  <strong>面向 1-5 人小型外贸公司<br/>
  开源免费 · 自带 AI · 一键部署 · 功能全覆盖 </strong>
</段>

<p 对齐="居中">
  <i>年费 ¥0 vs 竞品 ¥5,000-30,000/年</i>
</段>

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

中国50万家外贸企业中，1-5人小团队占绝大多数。cross-border-erp（跨境 ERP）、foreign-trade-management（外贸管理）、small-business-erp（小型企业 ERP）、import-export-management（进出口管理）他们面临的困境：

|      问题      |       传统方案       |         我们的方案            |
|---------------|----------------------|-------------------------------|
| **AI 被锁定** | 商业软件额外加收 AI 费 | **自带 API Key，用多少付多少** |
| **部署复杂**  | 需专业 IT 团队         | **bash install.sh 一键搞定** |
| **数据安全**  | 客户资料存第三方服务器  | **数据留在自己服务器** |
| **功能冗余**  |大而全但 80% 用不上     | **模块化插件，按需安装** |

### 三大差异化

| ⭐ | 能力 | 说明 |
|:--:|------|------|
| **开源** | AGPL v3 | 代码完全公开，可审计、可定制、可私有部署 |
| **AI** | 自带 API Key | 支持 DeepSeek/OpenAI/通义千问/Ollama，费用仅为商业软件的 1/20 |
| **部署** | 一键安装 | Docker 一键启动，非技术人员 5 分钟上手 |

---


##✨ 功能一览

### CRM 核心
- **客户管理** — 360° 客户档案、联系人、跟进时间线、标签分组
- **询盘管理** — 多渠道来源、状态流转、AI 自动回复
- **报价管理** — 多币种、Incoterms、一键 PDF 导出、版本管理
- **订单管理** — 订单进度追踪、多币种、盈亏测算

### 邮件中心
- **邮件收件箱** — 多邮箱绑定、收件/发件/草稿/垃圾箱
- **AI 辅助** — AI 写邮件、翻译、回复建议
- **邮箱设置** — IMAP/SMTP 配置

### 文档与单证
- **商业发票** — 自动生成、预览、下载
- **装箱单** — 同数据源自动填充
- **提单 / 产地证 / MSDS**

### AI 能力
- **AI 邮件** — 根据上下文自动生成开发信
- **AI 询盘分析** — 自动提取客户需求
- **AI 跟单建议** — 基于订单状态推荐下一步
- **AI 翻译** — 多语言邮件翻译
- **AI 产品描述** — 自动生成多语言产品描述
- **支持模型** — DeepSeek、GPT-4o、通义千问、Ollama（本地）

### 数据决策
- **仪表盘** — KPI 卡片、销售漏斗、AI 用量监控
- **实时汇率** — 多数据源切换

### 扩展能力
- **插件市场** — 一键安装扩展（邮件营销、基础财务、团队协作等）
- **侧栏定制** — 菜单排序、显示隐藏

---

## 🚀 快速开始
项目演示地址：https://tradepilot.us.kg/
### 方式一：Docker 一键部署（推荐，¥0）

```bash
# 安装 Docker（如已安装可跳过）
curl -fsSL https://get.docker.com | bash

# 下载并启动 TradePilot
git clone https://github.com/tradepilot/tradepilot.git
cd tradepilot
bash install.sh
```

打开浏览器访问 `http://localhost:3456`，创建账号即可使用。

### 方式二：本地开发运行

```bash
git clone https://github.com/tradepilot/tradepilot.git
cd tradepilot
npm install
npx next dev -p 3456
```

### 方式三：云服务器部署

购买一台 2 核 4G 云服务器（腾讯云/阿里云轻量应用服务器 ¥68/月起），SSH 登录后执行方式一的命令即可。

### 配置 AI

启动后，进入「设置 → AI 提供商」，填入你的 API Key：

```
DeepSeek：   sk-xxxx（注册即送额度）
OpenAI：     sk-xxxx（按量付费）
通义千问：   免费额度
Ollama：     本地部署（完全免费）
```

---

## 📦 技术栈

| 说明 |
|------|------|------|
| **前端框架** | Next.js 16 + React 19 | 全栈 React 框架 |
| **UI 组件** | shadcn/ui + Tailwind CSS | 美观、可定制 |
| **数据库** | SQLite（默认）/ PostgreSQL | 无需额外配置 |
| **AI 引擎** | LLM Gateway | 统一抽象，支持多模型 |
| **容器化** | Docker + Docker Compose | 一键部署 |
| **包管理** | npm | |

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
├── plugins/              # 插件系统（6 个插件）
├── Dockerfile
├── docker-compose.yml
├── install.sh
└── README.md
```

---

## 📊 与竞品对比

| 对比项 | OKKI | 富通天下 | 孚盟软件 | **TradePilot** |
|--------|:----:|:--------:|:--------:|:-------------:|
| 年费 | ¥20,000+ | ¥5,000-30,000 | ¥5,000-20,000 | **¥0** |
| 开源 | ❌ | ❌ | ❌ | **✅ AGPL v3** |
| 数据自主 | ❌ SaaS | ❌ SaaS | ❌ SaaS | **✅ 自部署** |
| AI 自配 Key | ❌ | ❌ | ❌ | **✅** |
| 客户管理 | ✅ | ✅ | ✅ | **✅** |
| 邮件管理 | ✅ | ✅ | ✅ | **✅** |
| 报价单 | ✅ | ✅ | ✅ | **✅** |
| 订单管理 | ✅ | ✅ | ✅ | **✅** |
| 多币种 | ✅ | ✅ | ✅ | **✅** |
| 单证生成 | ✅ | ✅ | ❌ | **⚡ 基础** |
| 插件扩展 | ❌ | ❌ | ❌ | **✅ 插件市场** |
| 部署难度 | 注册即用 | 注册即用 | 注册即用 | **⭐ 5分钟** |

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
git clone https://github.com/tradepilot/tradepilot.git
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
  <a href="https://github.com/tradepilot/tradepilot">GitHub</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="https://github.com/tradepilot/tradepilot/issues">反馈</a>
</p>
