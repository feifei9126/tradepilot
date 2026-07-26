# TradePilot 订单收款实现计划

> **面向 AI 代理的工作者：** 实现前读取 `superpowers:executing-plans`。本计划依赖多租户计划的成员授权、AES-256-GCM 封装和迁移基线；只实现外贸订单收款，不实现 SaaS 订阅。

**目标：** 为订单生成 Stripe Checkout、支付宝电脑网站支付和微信 Native 二维码，使用统一收款/退款状态，完成签名验证、金额校验和 webhook 幂等。

**架构：** 订单收款领域服务负责金额和状态机；每个 provider adapter 只负责创建交易、验签、退款和事件归一化。服务商 webhook 通过公开 account ID 找到租户配置，再在事务中写入事件和更新订单。

**技术栈：** Drizzle、Web Crypto、原生 HTTPS/fetch、Stripe API、支付宝 RSA2、微信支付 v3、现有 `qrcode`、Node test + tsx。

---

### 任务 1：建立货币和状态机失败测试

**文件：**
- 创建：`src/lib/payments/money.ts`
- 创建：`src/lib/payments/types.ts`
- 创建：`tests/business/payment-money.test.ts`
- 创建：`tests/business/payment-state.test.ts`

- [ ] **步骤 1：写金额失败测试**

```ts
test("money uses minor units and rejects over-collection", () => {
  assert.equal(toMinorUnits("12.30", "USD"), 1230);
  assert.equal(toMinorUnits("12", "JPY"), 12);
  assert.throws(() => toMinorUnits("12.3", "JPY"), /precision/);
  assert.throws(() => toMinorUnits("-1", "USD"), /positive/);
  assert.throws(() => assertCollectable({ paid: 900, pending: 200, total: 1000 }), /exceed/);
});
```

- [ ] **步骤 2：运行确认失败**

运行：`npx tsx --test tests/business/payment-money.test.ts tests/business/payment-state.test.ts`

预期：FAIL，报缺少支付金额模块。

- [ ] **步骤 3：实现整数金额和状态转换**

`toMinorUnits` 使用货币小数位表和十进制定点解析，不使用浮点数；`reducePaymentStatus` 只允许 `pending -> paid/failed/cancelled/expired` 与退款派生状态，拒绝 paid 回到 pending。

- [ ] **步骤 4：运行绿色测试并提交**

```bash
npx tsx --test tests/business/payment-money.test.ts tests/business/payment-state.test.ts
git add src/lib/payments/money.ts src/lib/payments/types.ts tests/business/payment-money.test.ts tests/business/payment-state.test.ts
git commit -m "feat(payment): add money and payment state primitives"
```

### 任务 2：创建支付 schema、迁移和租户配置服务

**文件：**
- 创建：`src/db/schema/payment_accounts.ts`
- 创建：`src/db/schema/payment_requests.ts`
- 创建：`src/db/schema/payment_events.ts`
- 创建：`src/db/schema/payment_refunds.ts`
- 修改：`src/db/schema/index.ts`
- 创建：`src/db/migrations/0003_order_payments.sql`
- 创建：`src/lib/payments/repository.ts`
- 创建：`src/lib/payments/config.ts`
- 修改：`src/lib/business/types.ts`
- 创建：`tests/database/payment-migrations.test.ts`

- [ ] **步骤 1：定义租户表**

支付账户保存 provider、display name、public account ID、加密 credentials、enabled 和 health 状态；收款请求保存 order ID、company ID、amount minor、currency、token hash、expiresAt、status；provider event 使用 `(provider, provider_event_id)` 唯一；refund 使用 provider refund ID 和应用幂等键唯一。

- [ ] **步骤 2：写迁移失败/幂等测试**

迁移两次不能重复表或索引；旧订单的 payment status 默认 `unpaid`；Company A 创建的 payment request 在 Company B 查询返回 null。

- [ ] **步骤 3：实现 migration 和 repository**

收款创建事务锁订单，计算 `total - paid - pending`，小于请求金额时返回 `PAYMENT_AMOUNT_EXCEEDED`。`createPaymentRequest` 生成 32 字节公开 token，只保存哈希；`getPublicPayment` 只返回公开展示字段。

- [ ] **步骤 4：实现 provider 配置接口**

用 Zod 校验 Stripe/Alipay/WeChat 配置；调用 `sealSecret` 保存私钥和 key；读取返回 `configured` 和尾部标识，不返回明文。停用账户前查询 pending/refundable 交易，保留软停用。

- [ ] **步骤 5：运行数据库测试并提交**

```bash
npx tsx --test tests/database/payment-migrations.test.ts tests/business/payment-money.test.ts
git add src/db/schema src/db/migrations/0003_order_payments.sql src/lib/payments src/lib/business/types.ts tests/database/payment-migrations.test.ts
git commit -m "feat(payment): persist order payments and provider accounts"
```

### 任务 3：实现 Stripe 适配器和签名验证

**文件：**
- 创建：`src/lib/payments/providers/contracts.ts`
- 创建：`src/lib/payments/providers/stripe.ts`
- 创建：`src/lib/payments/signatures/stripe.ts`
- 创建：`tests/business/stripe-provider.test.ts`
- 创建：`tests/business/payment-signatures.test.ts`

- [ ] **步骤 1：写 Stripe 测试**

用注入的 fetch 断言 Checkout 请求使用 minor amount、currency、success/cancel URL、metadata paymentRequestId 和幂等键；使用 Stripe 官方签名格式测试有效、过期、错误 secret 的 webhook。

- [ ] **步骤 2：实现 Checkout**

`createCheckout` 调用 `https://api.stripe.com/v1/checkout/sessions`，使用 Basic auth、form-urlencoded body 和 `Idempotency-Key`；只保存 session ID 和 URL，不保存完整请求头。

- [ ] **步骤 3：实现 webhook 验签与事件映射**

读取 raw body，解析 `t=timestamp,v1=signature`，使用 HMAC-SHA256 constant-time compare，时间窗口默认 300 秒；把 `checkout.session.completed`、`payment_intent.payment_failed` 和退款事件归一化。

- [ ] **步骤 4：实现退款**

调用 `/v1/refunds`，使用 payment intent ID、amount 和幂等键；退款金额不超过已收净额。

- [ ] **步骤 5：运行测试并提交**

```bash
npx tsx --test tests/business/stripe-provider.test.ts tests/business/payment-signatures.test.ts
git add src/lib/payments/providers src/lib/payments/signatures tests/business/stripe-provider.test.ts tests/business/payment-signatures.test.ts
git commit -m "feat(payment): add stripe checkout webhooks and refunds"
```

### 任务 4：实现支付宝电脑网站支付

**文件：**
- 创建：`src/lib/payments/providers/alipay.ts`
- 创建：`src/lib/payments/signatures/alipay.ts`
- 创建：`tests/business/alipay-provider.test.ts`

- [ ] **步骤 1：写 RSA2 和参数校验测试**

测试官方 RSA2 签名向量、中文参数 URL 编码、通知字段验签、`app_id`/seller/total_amount/order ID 不匹配，以及交易状态不是 `TRADE_SUCCESS` 时不记账。

- [ ] **步骤 2：实现请求签名**

按支付宝 ASCII 参数排序规则排除 sign/sign_type，使用 PKCS#1 v1.5 RSA-SHA256 私钥签名，POST 到网关；私钥从解密配置得到，签名函数接受 `Uint8Array` 而不是日志字符串。

- [ ] **步骤 3：实现同步通知和退款**

电脑网站支付返回跳转 URL；异步 notify 使用官方 `notify_id` 验证和字段校验。退款请求使用商户订单号、退款金额和应用幂等键，归一化为内部 refund 事件。

- [ ] **步骤 4：运行测试并提交**

```bash
npx tsx --test tests/business/alipay-provider.test.ts tests/business/payment-signatures.test.ts
git add src/lib/payments/providers/alipay.ts src/lib/payments/signatures/alipay.ts tests/business/alipay-provider.test.ts
git commit -m "feat(payment): add alipay web payment and refunds"
```

### 任务 5：实现微信支付 Native v3

**文件：**
- 创建：`src/lib/payments/providers/wechat.ts`
- 创建：`src/lib/payments/signatures/wechat.ts`
- 创建：`tests/business/wechat-provider.test.ts`

- [ ] **步骤 1：写微信 v3 测试**

覆盖商户请求签名、平台回调签名、AES-256-GCM resource 解密、证书序列号错误、商户号/appId/金额/order ID 不匹配、重复通知和退款。

- [ ] **步骤 2：实现 Native 下单**

构造 canonical message `method + newline + path + newline + timestamp + newline + nonce + newline + body + newline`，使用商户 RSA 私钥签名，发送 `POST /v3/pay/transactions/native`，保存 `code_url`。

- [ ] **步骤 3：实现回调解密与退款**

先验证 `Wechatpay-*` header，再使用 API v3 Key 对 resource nonce/ciphertext/tag 做 AES-256-GCM 解密；退款调用 `/v3/refund/domestic/refunds` 并带幂等键。

- [ ] **步骤 4：运行测试并提交**

```bash
npx tsx --test tests/business/wechat-provider.test.ts tests/business/payment-signatures.test.ts
git add src/lib/payments/providers/wechat.ts src/lib/payments/signatures/wechat.ts tests/business/wechat-provider.test.ts
git commit -m "feat(payment): add wechat native payment and refunds"
```

### 任务 6：实现统一收款服务、webhook 和订单 API

**文件：**
- 创建：`src/lib/payments/service.ts`
- 创建：`src/app/api/payment-accounts/route.ts`
- 创建：`src/app/api/orders/[id]/payment-requests/route.ts`
- 创建：`src/app/api/payment-requests/[id]/refunds/route.ts`
- 创建：`src/app/api/webhooks/payments/[provider]/[accountId]/route.ts`
- 创建：`src/app/api/public/payments/[token]/route.ts`
- 创建：`tests/business/payment-service.test.ts`
- 创建：`tests/business/payment-webhooks.test.ts`

- [ ] **步骤 1：先写服务失败测试**

覆盖 member 创建收款、viewer 被拒、公开 token 过期、同一幂等键复用、金额不匹配、乱序 webhook、重复事件、部分收款和最后退款。

- [ ] **步骤 2：实现 provider registry**

`getPaymentProvider(provider)` 返回 Stripe/Alipay/WeChat adapter；未知 provider 返回 400；所有 adapter 通过同一 `CreateCheckoutResult`/`NormalizedPaymentEvent` contract。

- [ ] **步骤 3：实现收款 API 与公开启动流程**

创建请求先锁订单并写 payment request，再调用服务商；服务商创建失败时事务标记 attempt failed，不删除可审计的 request。公开 GET 只返回金额、币种、商户名和 enabled providers；POST 只接受 payment method 和 token。

- [ ] **步骤 4：实现 webhook 事务**

账户 ID 找到公司后解密凭据并验签；事件写入唯一表，锁 attempt，验证金额/币种/order ID，再更新 payment request、refund 和订单聚合状态。重复事件响应 200 且不重复记账。

- [ ] **步骤 5：实现退款 API**

仅 owner/admin 可调用；锁已收 attempt，校验剩余可退余额，调用 adapter，写 refund pending；服务商回调把 refund 转成 succeeded/failed。

- [ ] **步骤 6：运行绿色测试并提交**

```bash
npx tsx --test tests/business/payment-service.test.ts tests/business/payment-webhooks.test.ts tests/business/*provider.test.ts
npx tsc --noEmit
git add src/lib/payments src/app/api/payment-accounts src/app/api/orders src/app/api/payment-requests src/app/api/webhooks/payments src/app/api/public/payments tests/business/payment-service.test.ts tests/business/payment-webhooks.test.ts
git commit -m "feat(payment): add order checkout webhooks and refunds"
```

### 任务 7：支付界面和公开付款页

**文件：**
- 创建：`src/app/app/settings/payments/page.tsx`
- 创建：`src/app/pay/[token]/page.tsx`
- 修改：`src/app/app/orders/[id]/page.tsx`
- 创建：`tests/business/payment-pages.test.ts`

- [ ] **步骤 1：写页面 API 测试**

验证设置页不回显密钥，订单页只显示当前租户收款，公开页面不包含内部 UUID，微信 `code_url` 可生成二维码。

- [ ] **步骤 2：实现支付账户设置**

按 provider 展示字段和连接测试；保存后显示 configured/disabled/health 状态；删除按钮只能停用有交易的账户。

- [ ] **步骤 3：实现订单收款面板**

显示应收、已收、待收、收款历史、创建付款链接和退款记录；member 可创建，admin/owner 可退款，viewer 无写按钮。

- [ ] **步骤 4：实现公开付款页**

读取 `/api/public/payments/{token}`；Stripe/Alipay 显示跳转按钮，WeChat 显示二维码；回调后轮询安全状态，不展示服务商错误详情。

- [ ] **步骤 5：运行测试并提交**

```bash
npx tsx --test tests/business/payment-pages.test.ts tests/business/payment-service.test.ts
git add src/app/app/settings/payments src/app/pay src/app/app/orders/[id]/page.tsx tests/business/payment-pages.test.ts
git commit -m "feat(payment): add provider settings and public checkout page"
```

### 任务 8：支付阶段验收

- [ ] **步骤 1：运行所有支付和数据库测试**

```bash
npm run test:db
npx tsx --test tests/business/payment-*.test.ts tests/business/*provider.test.ts
```

- [ ] **步骤 2：检查秘密和金额实现**

```bash
rg -n "console\.(log|error).*secret|console\.(log|error).*private|Number\([^)]*amount|parseFloat\([^)]*amount" src/lib/payments src/app/api
```

预期：没有秘密日志或浮点金额计算。

- [ ] **步骤 3：提交阶段验收**

```bash
git commit --allow-empty -m "test(payment): verify order payment phase"
```
