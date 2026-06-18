# TradePilot 架构文档

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    前端层 (Next.js App Router)                │
│  app/page.tsx   app/app/*   app/auth/*                      │
│  Components: shadcn/ui + lucide icons                       │
├─────────────────────────────────────────────────────────────┤
│                    API 路由层 (Next.js)                       │
│  /api/contacts, /api/orders, /api/ai, ...                   │
├──────────────┬─────────────────────────┬────────────────────┤
│  服务层       │    AI 适配层             │   基础设施           │
│  services/    │    lib/ai/              │   auth, i18n       │
│  业务逻辑     │    providers/ (可插拔)    │                    │
│  跨模块编排   │    tasks/ (提示词)        │                    │
├──────────────┴─────────────────────────┴────────────────────┤
│                    数据访问层 (repositories/)                  │
│  接口: list / get / create / update / delete / query          │
├─────────────────────────────────────────────────────────────┤
│                    数据存储层                                 │
│  开发: In-Memory Store → 生产: PostgreSQL (Drizzle ORM)     │
│  缓存: Redis (可选)  搜索: Elasticsearch (可选)              │
└─────────────────────────────────────────────────────────────┘
```

## 模块结构

```
src/
  db/
    schema/        # Drizzle ORM 表定义 (18 个表)
      index.ts     # Schema 导出
      contacts.ts  # 客户 + 联系人
      products.ts  # 产品
      orders.ts    # 订单 + 里程碑
      quotations.ts# 报价单
      shipments.ts # 出货 + 单证
      inquiries.ts # 询盘
      suppliers.ts # 供应商 + 供应产品
      communications.ts # 沟通记录
      users.ts / companies.ts / ai_config.ts / settings.ts
      # ---- 以下为新模块 ----
      suppliers.ts # 仓库 / 库存 / 采购 / 财务 / 海关 / EDM / OA / 知识库
  lib/
    repositories/  # 数据访问层
      types.ts     # Repository 接口定义
      base.ts      # InMemoryRepository 基类
      index.ts     # 具体仓库实现
    services/      # 服务层
      index.ts     # 服务 + 跨模块编排
    ai/            # AI 适配层
      providers/   # 可插拔 AI 提供商
      tasks/       # AI 任务 (报价/建议/摘要)
    store.ts       # 内存数据存储 (MVP)
```

## 数据模型关系

```
Company (1) → Users (N)
Company (1) → Contacts (N) → ContactPersons (N)
Company (1) → Products (N) → Inventory (N)
Contact (1) → Inquiries (N) → Quotations (N) → Orders (N) → Shipments (N) → Documents (N)
Order (1) → OrderMilestones (N)
Order (1) → Communications (N)
Contact (1) → Communications (N)
Company (1) → Suppliers (N)
Supplier (N) → Products (M) [supplier_products]
Product (1) → Inventory (N) → InventoryTransactions (N)
Supplier (1) → PurchaseOrders (N)
Order (1) → Invoices (N)
Order (1) → Expenses (N)
Company (1) → AIProviderConfigs (N) → AITaskMappings (N)
```

## AI 层设计 (可插拔)

```typescript
interface AIProvider {
  id: string;        // "deepseek" | "openai" | "tongyi" | "ollama"
  name: string;      // 显示名称
  chat(props: ChatProps): Promise<ChatResponse>;
}

// 每个业务任务可配置不同 Provider
// 系统设置 → AI 配置 → 任务映射
```

## 模块演化路线

```
v0.5 (当前) → v1.0 (此版本) → v1.5 → v2.0
CRM         + 供应商管理     + 海关数据    + 独立站
订单         + 库存/进销存    + EDM 营销   + 插件市场
报价         + OA 审批流     + 智能问数   + 社区版
产品         + 财务管理       + RAG 管道
AI 报价      + 海关数据导入   + 多语言增强
多语言/币种   + 邮件营销
            + 知识库
```
