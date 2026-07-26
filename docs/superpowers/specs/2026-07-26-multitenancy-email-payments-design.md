# TradePilot 多租户、邮件收发与订单收款设计

日期：2026-07-26
状态：已确认，待实现计划

## 1. 背景

TradePilot 已把客户、产品、询盘、报价、订单和物流接入 PostgreSQL，并通过真实 `companyId` 隔离核心业务数据。当前实现仍有三个明显缺口：

1. `users.company_id` 只能表达一个账号属于一个组织，缺少成员邀请、角色权限和工作区切换。
2. 邮件页面只保存进程内配置草稿和演示邮件，没有持久化账户、真实收发、同步和凭据保护。
3. 订单没有真实收款流程，无法通过 Stripe、支付宝或微信支付生成付款入口、处理可靠回调和退款。

本设计在不破坏现有 PostgreSQL 业务数据和本地内存演示模式的前提下补齐这三个能力。生产环境继续强制 PostgreSQL；`npm run dev` 在没有 `DATABASE_URL` 时继续使用单租户内存演示数据。

## 2. 目标与非目标

### 2.1 目标

- 一个用户可以加入多个组织，并在有权访问的组织间切换。
- 提供组织创建、成员邀请、邀请接受、角色变更和成员停用功能。
- 所有管理、邮件和支付数据都以 `company_id` 隔离，并在数据库和应用层同时校验租户边界。
- Cloudflare 部署通过 Resend 发信，并通过 Resend Webhook 或 Cloudflare Email Routing 收信。
- Docker 和本地 PostgreSQL 部署通过 SMTP 发信，并由独立进程定时执行 IMAP 增量同步。
- 邮件账户、线程、邮件、附件元数据、发件队列和同步游标持久化到 PostgreSQL。
- 为订单创建 Stripe Checkout、支付宝电脑网站支付和微信 Native 二维码收款。
- 由验签且幂等的服务商回调更新收款、退款和订单付款状态。
- 改进 Cloudflare 与 Docker 初始化流程，使新部署只需准备数据库、主加密密钥和所选服务商凭据。

### 2.2 非目标

- 本阶段不实现 TradePilot SaaS 套餐、周期订阅或平台向租户收费。
- 本阶段不实现 Gmail 或 Microsoft 365 OAuth 授权；SMTP/IMAP 使用服务商提供的应用专用密码。
- 本阶段不实现自动换汇、分账、资金托管、拒付仲裁或会计总账。
- 本阶段不让 Cloudflare Worker 维护常驻 IMAP 连接。
- 本阶段不把任何真实 API Key、商户私钥、数据库地址或邮箱密码写入 Git、浏览器存储或日志。

## 3. 总体架构

采用“统一领域模型 + 服务商适配器”架构，而不是让路由直接调用第三方 SDK。

```text
UI / Public payment page
          |
    Authenticated API / Signed webhook API
          |
 Organization access service
          |
   Domain services and repositories
      /                     \
Email provider adapters    Payment provider adapters
Resend / SMTP / IMAP       Stripe / Alipay / WeChat Pay
          |                         |
        PostgreSQL + attachment storage
```

路由只负责认证、输入解析和 HTTP 响应；领域服务负责权限、状态机、幂等和跨表事务；适配器负责第三方协议；仓库负责租户限定的数据库访问。服务商响应必须先归一化为内部事件，再进入领域事务。

功能按以下顺序实现：

1. 多租户成员关系、权限和工作区切换。
2. 邮件持久化、发件队列和双部署模式适配器。
3. 订单收款模型、公开付款页和三个支付适配器。
4. 设置界面、部署脚本、迁移、端到端验证和文档。

## 4. 多租户与权限

### 4.1 数据模型

新增 `organization_memberships`：

- `company_id`、`user_id`：联合唯一，均使用外键。
- `role`：`owner | admin | member | viewer`。
- `status`：`active | suspended`。
- `created_at`、`updated_at`、`created_by`。

新增 `organization_invitations`：

- `id`、`company_id`、`email`、`role`、`invited_by`。
- `token_hash`：只保存随机邀请令牌的 SHA-256 哈希。
- `expires_at`：默认邀请后 48 小时。
- `accepted_at`、`revoked_at`、`created_at`。
- 同一组织、同一邮箱同一时间最多存在一个有效邀请。

现有 `users.company_id` 在本阶段保留为默认工作区兼容字段，迁移为每个现有用户创建对应的 `organization_memberships` 记录。成员关系成为访问授权的唯一依据；后续兼容窗口结束后再单独迁移默认工作区字段，当前迁移不删除列和数据。

### 4.2 会话与切换

登录时从有效成员关系选择 `users.company_id` 指向的默认组织；如果默认组织不可用，则选择最早的有效成员关系。Auth.js JWT 保存当前 `companyId`，但它只表达用户选择，不作为最终权限依据。

`POST /api/organizations/switch` 接收目标组织 ID。服务端查询有效成员关系，验证通过后重新签发会话并更新默认工作区。业务 API 在创建仓库前重新查询成员关系，使用数据库中的角色覆盖 JWT 角色，因此成员停用和角色变更无需等待旧 JWT 过期。

本地内存演示模式继续使用固定演示用户和演示组织，不开放真实邀请发送；相关页面明确显示演示模式。

### 4.3 权限矩阵

| 操作 | owner | admin | member | viewer |
|---|---:|---:|---:|---:|
| 读取业务数据 | 是 | 是 | 是 | 是 |
| 修改业务数据 | 是 | 是 | 是 | 否 |
| 创建订单收款 | 是 | 是 | 是 | 否 |
| 使用已配置邮箱收发 | 是 | 是 | 是 | 否 |
| 配置邮箱和支付账户 | 是 | 是 | 否 | 否 |
| 邀请、停用 member/viewer | 是 | 是 | 否 | 否 |
| 管理 admin/owner | 是 | 否 | 否 | 否 |
| 修改组织或删除组织 | 是 | 否 | 否 | 否 |
| 发起退款 | 是 | 是 | 否 | 否 |

任何操作都不能移除、停用或降级组织中的最后一名 active owner。用户不能提升到高于自己权限的角色，也不能修改自己的 owner 身份来绕过最后 owner 规则。

### 4.4 邀请流程

管理员创建邀请后，服务端生成至少 256 bit 随机令牌，只在创建响应和邀请邮件中返回原始令牌。组织尚未配置发信账户时，创建响应允许有权限的操作者复制一次邀请链接；原始令牌不写入数据库、审计摘要或日志。接受邀请时在一个事务中锁定邀请、验证哈希、有效期、邮箱和消费状态，然后创建或激活成员关系并标记邀请已接受。重复消费返回一致的冲突错误，不创建重复成员。

如果受邀邮箱尚未注册，邀请链接先进入注册页；注册成功后继续接受邀请。已登录但邮箱不匹配时不允许接受。

## 5. 邮件收发

### 5.1 数据模型

新增以下租户表：

- `email_accounts`：名称、邮箱、发送/接收 provider、加密凭据、连接参数、启用状态和最后健康状态。
- `email_threads`：标准化主题、参与者摘要、最后邮件时间、关联客户/询盘/订单。
- `email_messages`：账户、线程、方向、文件夹、Message-ID、In-Reply-To、发件人、收件人 JSON、主题、纯文本、清理后的 HTML、时间和已读状态。
- `email_attachments`：邮件、文件名、MIME、大小、内容哈希和对象存储键。
- `email_sync_cursors`：账户、文件夹、UIDVALIDITY、最后 UID 和最后同步时间。
- `email_outbox`：待发送内容、幂等键、尝试次数、租约、下次重试时间和最终状态。
- `email_provider_events`：服务商、事件 ID、负载哈希、处理状态和错误分类，服务商事件 ID 唯一。

同一账户的 Message-ID 与方向建立唯一约束；缺少 Message-ID 的邮件用账户、规范化发送方、时间、主题和正文哈希生成稳定去重键。

### 5.2 Cloudflare 模式

- 发信：API 在事务中写入 `email_outbox`，调度处理器通过 Resend HTTPS API 发送。成功后保存服务商邮件 ID；临时失败按指数退避重试，永久失败进入 failed 状态。
- 收信：Resend inbound webhook 和 Cloudflare Email Routing `email()` 事件都转换为相同的 `InboundEmail` 结构，再调用同一个持久化服务。
- Cloudflare Worker 不建立 IMAP 长连接，也不使用 SMTP 端口。
- OpenNext Worker 使用薄入口包装 `fetch`、`scheduled` 和可选 `email` 处理器，HTTP 应用逻辑仍由 OpenNext 处理。

### 5.3 Docker 与本地 PostgreSQL 模式

Docker Compose 新增独立 `mail-worker` 进程：

- 轮询并租用 `email_outbox`，通过 SMTP 发送，避免请求超时和重复发信。
- 按账户与文件夹执行短连接 IMAP 增量同步，保存 UIDVALIDITY 和最后 UID。
- 账户并发、失败退避和最大执行时间可配置；单个账户失败不阻塞其他租户。
- Web 应用和邮件进程共享 PostgreSQL，不使用进程内队列。

`npm run dev` 无数据库时保留本地草稿，不尝试真实 SMTP/IMAP；配置 PostgreSQL 后可单独运行邮件进程进行联调。

### 5.4 邮件安全

- 邮箱密码、Resend Key 和 Webhook Secret 使用主密钥加密后存入 PostgreSQL。
- 加密使用 AES-256-GCM，每条记录使用随机 nonce，并把 `companyId + accountId + credentialVersion` 作为 AAD。
- `TRADEPILOT_CREDENTIALS_KEY` 是 32 字节 base64url 主密钥，只存在环境变量或 Cloudflare Secret。
- 凭据接口只返回 `configured: true/false` 和安全的尾部标识，永不返回密文或明文。
- SMTP/IMAP 主机拒绝回环、链路本地、云元数据和私网地址，Docker 管理员可通过显式的 `TRADEPILOT_ALLOW_PRIVATE_MAIL_HOSTS=true` 为内网邮件服务器放行。
- HTML 邮件在保存展示版本前清理脚本、表单和危险 URL；远程图片默认不加载。
- 附件限制单文件 10 MiB、单封邮件 25 MiB，并校验实际读取字节数。Cloudflare 使用 R2，Docker 使用持久化本地对象目录。

### 5.5 邮件界面

- 邮箱设置：新增、编辑、停用、测试发信、测试收信和查看最近同步错误。
- 邮件工作台：账户/文件夹切换、线程列表、搜索、已读/星标、撰写、回复、附件和业务对象关联。
- 组织设置中展示邮件运行模式，Cloudflare 不显示不可用的 IMAP 长连接选项。

## 6. 订单收款

### 6.1 数据模型

新增以下租户表：

- `payment_accounts`：服务商、显示名称、公开配置、加密凭据、启用状态和 Webhook 账户标识。
- `payment_requests`：订单、固定金额最小货币单位、币种、说明、公开令牌哈希、过期时间和聚合状态。
- `payment_attempts`：收款请求、服务商、服务商交易 ID、幂等键、付款 URL/二维码内容、状态、失败分类和有效期。
- `payment_provider_events`：账户、服务商事件 ID、负载哈希、收到时间和处理结果，联合唯一以保证幂等。
- `payment_refunds`：付款尝试、金额、服务商退款 ID、原因、状态、申请人和时间。

订单新增或派生 `payment_status` 与 `amount_paid_minor`。允许同一订单分多次收款，但任何新的有效收款请求都不能让“已收 + 待支付”超过订单应收金额。金额全部以整数最小货币单位保存，并通过明确的货币小数位表转换，禁止使用浮点数计算支付金额。

### 6.2 公开付款页

组织成员从订单详情创建固定金额、币种和有效期的收款请求。系统返回不可猜测的 `/pay/{token}` 链接；数据库只保存令牌哈希。

公开页面只展示付款所需的订单编号、商户显示名称、金额和已启用支付方式，不暴露客户、租户 ID、内部订单 ID或服务商凭据。频率限制和失败次数限制按令牌与来源地址执行。

服务商流程：

- Stripe：创建 Checkout Session 并跳转到 Stripe 托管页。
- 支付宝：创建电脑网站支付请求并跳转到支付宝页面。
- 微信支付：创建 Native 交易并把 `code_url` 渲染为二维码。

浏览器 return URL 只显示“正在确认”或最终数据库状态，绝不直接标记已付款。

### 6.3 回调与状态机

公开回调路由形如 `/api/webhooks/payments/{provider}/{accountPublicId}`。账户公开 ID 只用于选择配置；每个请求仍必须执行服务商验签：

- Stripe：使用原始请求体、时间戳和 endpoint secret 验证签名。
- 支付宝：按官方字段规范重建待验签字符串并验证 RSA2 签名，同时校验 `app_id`、seller、金额、币种和商户订单号。
- 微信支付 v3：校验平台证书序列号、时间戳、nonce 和签名，再用 API v3 Key 解密资源，并校验商户号、appId、金额和商户订单号。

回调处理在一个数据库事务中：锁定 provider event 与 payment attempt，拒绝负金额、错误币种、错误租户映射和非法状态倒退，写入唯一事件，更新付款尝试与退款，最后重新汇总订单收款状态。重复事件返回成功但不重复记账。

内部统一状态：

- 收款：`pending | requires_action | paid | failed | cancelled | expired`。
- 退款：`pending | succeeded | failed | cancelled`。
- 订单：`unpaid | partial | paid | partially_refunded | refunded`。

只有 `paid` 金额计入已收款；退款成功后从净收款中扣除。管理员可以发起不超过可退余额的部分或全额退款。服务商 API 接受幂等键，应用层也使用唯一退款请求键防止重复调用。

### 6.4 服务商账户与币种约束

每个组织配置自己的 Stripe、支付宝和微信商户账户。凭据与邮件凭据使用相同的加密封装，但使用不同 AAD 类型。保存后界面只显示配置状态和安全尾部标识；修改凭据必须重新提交完整值。仍有 pending 收款或可退款交易时不得硬删除支付账户，只能停用。

- Stripe 配置 secret key、publishable key 和 endpoint secret。
- 支付宝配置 appId、应用私钥、支付宝公钥和网关模式。
- 微信支付配置 appId、商户号、商户证书序列号、商户私钥、API v3 Key 和平台证书/公钥。

创建支付账户时做格式校验，提供不产生真实扣款的连接测试。支付宝和微信只在商户能力与订单币种兼容时显示；不兼容时返回明确的配置错误，不静默换汇。

## 7. API 与页面边界

新增主要 API：

- `/api/organizations`、`/api/organizations/switch`。
- `/api/organizations/members`、`/api/organizations/invitations`、`/api/invitations/accept`。
- `/api/email/accounts`、`/api/email/messages`、`/api/email/outbox`、`/api/email/sync`。
- `/api/webhooks/email/resend`。
- `/api/payment-accounts`、`/api/orders/{id}/payment-requests`、`/api/payment-requests/{id}/refunds`。
- `/api/webhooks/payments/{provider}/{accountPublicId}`。
- `/api/public/payments/{token}` 和服务商启动端点。

新增或调整页面：

- 应用导航中的组织切换器。
- 组织设置、成员与邀请页面。
- 邮箱设置和真实邮件工作台。
- 支付账户设置。
- 订单详情中的收款记录与退款面板。
- 公开 `/pay/{token}` 付款页。

所有写接口使用 Zod 校验、CSRF/同源保护和基于数据库成员关系的权限检查。公开 webhook 使用服务商签名而不是用户会话；公开付款接口使用高熵令牌、速率限制和固定字段响应。

## 8. 错误处理、审计与可观察性

领域错误使用稳定代码，例如：

- `MEMBERSHIP_REQUIRED`、`ROLE_REQUIRED`、`LAST_OWNER_REQUIRED`。
- `EMAIL_ACCOUNT_UNAVAILABLE`、`EMAIL_DELIVERY_FAILED`、`EMAIL_SYNC_FAILED`。
- `PAYMENT_PROVIDER_UNAVAILABLE`、`PAYMENT_SIGNATURE_INVALID`、`PAYMENT_AMOUNT_MISMATCH`、`PAYMENT_STATE_CONFLICT`。

客户端只看到可操作的安全提示；服务端日志使用错误分类、租户 ID、记录 ID 和追踪 ID，不记录凭据、邀请原始令牌、完整邮件正文、支付原始签名或支付私钥。

组织成员、邮箱配置、支付账户、收款和退款操作写入现有 `activity_logs`，记录操作者、动作、对象、时间和安全过滤后的变更摘要。Cloudflare Workers 日志可用于短期排错，PostgreSQL 审计记录用于业务追踪。

## 9. 数据迁移与兼容性

新增正式 SQL 迁移并遵循现有 migration journal：

1. 创建成员关系和邀请表。
2. 为每个现有用户回填 active membership；现有 `role` 回填到成员关系。
3. 创建邮件、对象存储元数据和队列表。
4. 创建支付账户、收款、事件和退款表。
5. 为所有子表建立包含 `company_id` 的复合外键、唯一索引和查询索引。

迁移使用 expand-first 策略，不删除现有表、列、用户或业务记录。迁移可重复执行，旧数据库与空数据库都必须通过。生产代码在 schema 未升级时返回 `DATABASE_SCHEMA_OUTDATED`，不回退到内存数据。

内存仓库为多租户、邮件草稿和模拟支付提供同接口的演示实现，但不会假装连接真实邮件或支付服务。真实发送/支付操作在演示模式返回明确的 `PROVIDER_NOT_CONFIGURED`。

## 10. 部署与一键配置

所有生产部署新增必需变量：

- `DATABASE_URL`。
- `AUTH_SECRET`。
- `TRADEPILOT_CREDENTIALS_KEY`：32 字节 base64url。
- `TRADEPILOT_APP_URL`：公开 HTTPS 根地址。

Cloudflare：

- `setup:cloudflare` 校验或生成安全密钥、设置 Secrets、运行/提示数据库迁移，并创建需要的 R2 binding 与 Cron Trigger。
- 租户在后台配置 Resend 和支付商户账户；这些服务商密钥加密后存入数据库，不进入 Cloudflare Git 构建变量。
- 构建继续执行 `npm run cfbuild`，部署继续执行 `npx wrangler deploy`。

Docker：

- 安装脚本生成主密钥并写入仅本机可读的 `.env`，不会输出密钥。
- Compose 增加共享数据库和附件卷的 `mail-worker`，带健康检查和自动重启。
- 安装脚本保持幂等，重新运行不删除 volume、不覆盖已有密钥、不改变租户或用户 ID。

## 11. 测试与验收

实现遵循测试驱动开发。每项行为先加入失败测试，再实现最小代码使其通过。

### 11.1 多租户测试

- 现有用户迁移后拥有正确成员关系，ID 和业务数据不变。
- 一个用户加入两个组织并切换后，只能看到当前组织数据。
- 伪造 `companyId`、过期 JWT、已停用成员和旧角色不能越权。
- owner/admin/member/viewer 权限矩阵逐项验证。
- 最后一名 owner 无法离开、停用或降级。
- 邀请过期、撤销、邮箱不匹配、重复消费和并发接受都不产生重复成员。

### 11.2 邮件测试

- 凭据加密后不含明文，错误主密钥和跨租户 AAD 无法解密。
- 账户、邮件、线程、附件和搜索不能跨租户访问。
- 发件队列租约、重试、崩溃恢复和幂等键不产生重复邮件。
- Resend、Email Routing 和 IMAP 输入归一化为相同邮件模型。
- IMAP UIDVALIDITY 重置、重复 UID、缺少 Message-ID 和断线重试正确处理。
- HTML 清理、远程图片策略、附件大小限制和危险主机验证生效。

### 11.3 支付测试

- 金额使用整数最小单位，零金额、负金额、超额待收和不支持币种被拒绝。
- Stripe、支付宝和微信使用官方格式测试向量验证签名和失败路径。
- 错误商户、错误租户、错误订单、金额不符和币种不符不能入账。
- 重复、乱序和并发 webhook 只记账一次，非法状态不能倒退。
- 部分收款、全额收款、部分退款和全额退款正确汇总订单状态。
- 公开令牌不可枚举，过期或撤销后不能创建新支付尝试。

### 11.4 发布验证

合并或推送前至少运行：

```bash
npm run test
npm run test:db
npm run test:deploy
npm run test:coverage
npm run lint
npx tsc --noEmit
npm run build
npm run cfbuild
npx wrangler deploy --dry-run
npm audit --audit-level=critical
```

带真实服务商凭据的沙箱 smoke test 是独立、显式的发布步骤，不在 CI 中保存或调用真实生产凭据。Docker 真实 IMAP/SMTP 和容器重启持久化测试只在安装 Docker 的环境运行；无法运行时必须在交付说明中明确列为未验证项。

## 12. 验收标准

本阶段完成需要同时满足：

1. 现有单组织用户与业务数据无损迁移，多组织切换和角色权限可用。
2. Cloudflare 可通过 Resend 发信并通过至少一种已配置的入站渠道收信。
3. Docker 可通过 SMTP 发信并通过定时 IMAP 增量同步收信。
4. 邮件内容、附件和业务关联持久化且严格按租户隔离。
5. 订单能够创建 Stripe、支付宝和微信支付入口，并由可靠回调更新付款状态。
6. 部分收款和管理员退款正确更新净收款与订单状态。
7. 凭据、邀请令牌和公开付款令牌均按本设计保护，日志不泄露秘密。
8. 新部署文档明确 Cloudflare 与 Docker 的最短配置路径，所有自动化验证通过或清楚报告环境限制。
