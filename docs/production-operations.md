# 生产运维与发布门禁（操作手册）

> 当前实现只提供运维基础设施和本地/CI 验收能力，不代表已完成生产演练。公开多租户 SaaS 的发布结论仍为 **NO-GO**；支付、服务商真链路、合规、外部告警、负载和灾备验收通过前，不得把本手册当作上线认证。

## 1. 本仓库当前可用的运维能力

- `/api/health/live`：进程存活探针，不依赖数据库。
- `/api/health/ready`：只在数据库连接和当前版本 schema/migration 校验通过时返回 200；不用于展示敏感数据库诊断。
- `/api/metrics`：可选 Prometheus 文本端点。必须配置 `METRICS_TOKEN`，并以 `Authorization: Bearer <token>` 调用。未配置或 token 太弱（少于 32 字符）时 fail closed，返回 503；凭据错误返回 401。仅导出应用/数据库就绪、进程 uptime 和内存等聚合指标，不导出租户标签、业务明细或凭据。
- GitHub Actions CI：使用 Node.js 22.22.0，执行 lint、TypeScript 检查、生产构建、单元/业务测试、独立 PostgreSQL 租户集成测试以及 lockfile 依赖审计。Dependabot 每周检查 npm 与 GitHub Actions 更新。
- npm 安装当前需使用 `--legacy-peer-deps`：Auth.js 的可选 Nodemailer peer 范围尚未覆盖项目直接 SMTP 使用的 Nodemailer 10；这会跳过 npm 的 peer 校验，不等于依赖兼容性已获上游背书。Dockerfile、CI 与文档已统一使用相同参数，升级 Auth.js/Nodemailer 时必须重新验证。
- PostgreSQL 备份 / 恢复工具：见[数据库管理指南](database-management.md)。这不包含媒体卷、实例配置卷及加密主密钥。

### 配置指标采集

生成 32 字符以上的随机 token（建议 32 字节随机数的十六进制编码），并只写入部署 Secret Manager / 容器 Secret，不要提交到 Git 或放进 `NEXT_PUBLIC_*`：

```bash
openssl rand -hex 32
```

将该值配置为服务端 `METRICS_TOKEN`。Prometheus 等采集器必须经受控内网、VPN 或具备 TLS 的反向代理访问 `/api/metrics`；不要为了采集而把该路径匿名暴露到公网。Prometheus 配置中使用 `Authorization` 请求头引用 Secret，不要把值写入仓库、仪表板截图、工单或命令历史。轮换时先更新采集器和服务端 Secret，再验证 scrape 成功；原 token 不应被应用日志记录。

建议先配置以下基于实际容量定义阈值的告警，而不是把示例阈值直接当 SLO：

| 信号 | 建议告警条件 | 初始响应 |
|---|---|---|
| 应用不可达 | scrape 失败或 `tradepilot_application_up == 0` 持续超过部署约定窗口 | 检查反向代理、容器健康、最近发布和依赖状态 |
| 数据库不可就绪 | `tradepilot_database_ready == 0` 持续超过部署约定窗口 | 检查 PostgreSQL、连接池、迁移版本；禁止自动清库/重置 |
| 内存压力 | RSS/heap 持续超过经压测确定的安全线 | 检查实例趋势和媒体任务；优先限流/扩容或回滚 |
| 磁盘/备份/队列 | 由宿主机、PostgreSQL、对象存储和 Worker exporter 提供 | 核验容量、备份最近成功时间及任务堆积 |

当前仓库**没有**内置 Prometheus、Alertmanager、APM、日志集中化或值班通知集成；需由运营方部署并测试告警路由、去重、升级和静默规则。 metrics 路由的 503/401 本身也不会通知维护人员。

## 2. 上线前安全配置

- 生产管理员初始密码至少 16 位、包含两类字符且不是公开样例；首次登录必须改密。已有管理员哈希优先于环境变量，损坏记录拒绝回退；升级前先处理旧弱密码，不自动重置账号。
- 使用正式 HTTPS 域名、强制 HTTP→HTTPS、HSTS 与可信反向代理；`AUTH_URL` 必须是正式 `https://` 地址。只开放代理入口，数据库、Worker、管理端口不得直接暴露公网。
- 每个环境独立生成 `AUTH_SECRET`、`TRADEPILOT_CONFIG_KEY`、`METRICS_TOKEN`、数据库/Redis/邮件/Webhook 密钥；通过云厂商 Secret Manager、Docker Secrets 或等价机制注入，限制读取身份并记录访问审计。开发、预览、生产不可共享秘密。
- 轮换先部署新凭据并验证，再吊销旧凭据；若配置密钥加密过实例文件，须按项目迁移流程解密/重加密，保留离线备份，不能直接换 key 造成配置永久不可读。
- 使用数据库 TLS `verify-full` 和独立最小权限运行账号；迁移账号与 Web 运行账号分离。不要将默认 Compose 超级权限角色视作生产授权设计。
- 保持公网注册关闭，直至双租户 E2E、对象权限和滥用防护通过；移除演示账号/测试数据，设置注册、邮件发送、AI 和抓取预算与限额。
- 邮件、Webhook、退订、付款和隐私请求必须先完成合规审查和真实服务验证。测试时仅使用自有地址、测试商户和专用租户。

## 3. 发布与回滚 runbook

### 发布前

1. 从已审查 commit 构建镜像并记录版本、依赖 lockfile、迁移编号、镜像 digest；对依赖漏洞进行分级，未处理 Critical/High 前停止发布。
2. 在隔离 staging 用生产同款拓扑和脱敏/合成数据完成 `npm run lint`、`npx tsc --noEmit`、`npm test`、`npm run test:db`，随后运行真实厂商 sandbox smoke。外部联调需验成功、鉴权失败、超时、限速、重试、重复请求和费用/用量记录。
3. 维护窗口前备份 PostgreSQL，并验证备份文件大小、权限、校验和及最近一次隔离恢复；另外备份媒体/对象存储、实例配置卷、Webhooks/邮件配置解密密钥。仅有一个未经恢复验证的 dump 不算灾备。
4. 迁移按 expand → deploy → backfill → contract 推进；先验证迁移可重复性与锁/耗时。当前迁移没有自动 down，禁止在生产直接回滚 schema 或编辑已执行迁移。
5. 通过 CI 门禁后先发布单实例/小流量，检查健康探针、指标、日志、登录、核心 CRM 读写和后台任务，再按预设观察窗口扩大流量。

### 出现故障时

1. 以 request ID、发布版本和指标定位；日志禁止记录 Authorization、密码、完整邮箱凭据、AI/Webhook 密钥、原始邮件正文或客户数据。
2. 若错误与新版本相关，停止扩大流量并切回上一个已验证镜像；保留当前数据库，不要自动执行破坏性 DOWN。
3. 若新版本迁移兼容旧版，先回滚应用；若数据已不可兼容，按演练过的恢复计划恢复到**隔离新库**、验证关键计数和权限，再切连接并观察。不可直接覆盖唯一生产库。
4. 记录事件时间线、影响租户/数据、检测时间、恢复时间、处置和后续行动；评估邮件/隐私/支付通知义务。

## 4. 备份、恢复与灾备验收

灾备负责人必须为业务确定 RPO/RTO、备份频率、保留期、异地位置和加密方式。至少覆盖：PostgreSQL、媒体对象/Worker 卷、部署配置卷、必要解密密钥、HTTPS/数据库证书、镜像和版本记录。备份与密钥需分离访问控制，至少一份位于主故障域之外。

生产启用前，安排隔离环境恢复演练并记录：恢复点时间、备份校验、恢复耗时、迁移校验、抽样数据/对象完整性、租户访问隔离、应用切换步骤、实测 RPO/RTO 和清理证明。恢复脚本默认拒绝非空目标库，遵守 [`docs/database-management.md`](database-management.md) 的确认门槛。不能以单元测试、一次本机演示或“备份任务显示成功”替代恢复演练。

## 5. 压测与容量门禁

仓库尚无经验证的生产吞吐量或用户容量承诺。投产前先定义目标并在 staging 压测：并发登录、租户列表/详情读写、导入导出、AI 预算拒绝、邮件队列、媒体上传/Range 下载、数据库池耗尽及 Worker 高负载。分别记录 p50/p95/p99 延迟、错误率、CPU/RSS、连接池等待、数据库锁/慢查询、队列延迟和成本；测试到目标负载以上并执行突增/恢复测试。

压测须用合成租户/数据，不打真实客户、不触发真实营销邮件/收费；提前限制供应商额度并设置 kill switch。根据结果确定 API/租户限额、数据库池、容器 CPU/内存、磁盘预留和扩容策略。不能仅按开发机结果推导生产容量。

## 6. 发布阻断清单

以下任一项未有负责人、书面验收证据和回滚方案，继续保持 SaaS **NO-GO**：支付/订阅生命周期；租户级 AI 密钥、预算和用量账单；SMTP/IMAP 与营销退订/同意/抑制流程；Webhook 租户凭据及重放保护；Firecrawl/AI/LiveKit/视频真实链路；多副本共享配置和持久媒体；客户级权限；公网 HTTPS 和生产 secret 管理；外部监控告警；依赖风险处置；目标负载压测；异地备份恢复与回滚演练。

## 7. 2026-10-07 代码安全升级配置（P1-01～P1-08）

先在隔离 staging 验收新镜像与 `0009_audit_code_security.sql`，备份后再升级业务环境。本轮整改**未操作现有预览/业务库，也未代运营方配置真实密钥**。

### 登录来源和跨副本节流

- PostgreSQL `auth_login_buckets` 保存共享计数，密码计算之前预留。账号最多 20 次 / 15 分钟，来源最多 100 次 / 15 分钟；连续失败触发递增退避。被拒请求不会延长退避锁，重启进程不会清除记录，数据库故障时拒绝认证。
- 默认忽略 `x-forwarded-for` / `x-real-ip`；无可验证来源的请求使用同一个 `unverified-peer` 桶。因此公网部署不能简单让所有流量保持默认并期待每访客独立限流。
- 只有掌控代理时设置 `TRADEPILOT_TRUSTED_CLIENT_IP_HEADER=x-real-ip` 和随机的 `TRADEPILOT_PROXY_AUTH_SECRET`（至少 32 字符）。代理必须**删除客户端传入的同名 IP 头及 `x-tradepilot-proxy-auth`，重新写入真实客户端 IP 和共享 secret**；IP 头只允许一个合法 IP，不能是逗号列表。应用检查 secret 相等后才采用 IP。
- 仅允许可信代理网络访问应用源站；secret 不进入浏览器、日志或截图。多级 CDN/代理要明确定义哪一级提供真实 IP，不能原样转发访客自带头。先验证伪造头无效、不同真实来源不同桶，再扩流。

### 工作区 Firecrawl 与 AI 预算

| 服务端变量 | 默认值 | 生效方式 |
|---|---|---|
| `FIRECRAWL_TENANT_DAILY_REQUEST_LIMIT` | 20 | 每工作区 UTC 日请求上限，与工作区预算取较小值；失败/未结算请求也计次 |
| `AI_PLATFORM_MONTHLY_REQUEST_LIMIT` | 10000 | 与有效套餐及工作区月预算取最小值；0 或非法值阻断 AI |
| `AI_PLATFORM_MONTHLY_TOKEN_LIMIT` | 10000000 | 同上；0 或非法值阻断 AI |

Firecrawl Key 在「AI 获客 → 获客服务配置」保存，固定 Cloud 端点，不借用环境/实例共享 Key。文本 Key 在「AI 用量」保存，租户只用官方预设地址；失效订阅降为 free，停用/paused/closed/AI 关闭有效限额为 0。平台管理员的实例文本调用仍走 API 配置中心，不能将它描述为受租户 AI 预算保护。Token 预留是保守技术上限，不是人民币/美元账单；缺少供应商 usage 时按预留结算，失败/超时不自动释放额度。

### SMTP / IMAP 与订阅确认

- 保存与每次连接都重新校验全部 DNS 地址；选定数值 IP 连接并保留原 hostname 的 TLS 验证/SNI。SMTP 只允许 465 TLS 或 587 强制 STARTTLS，IMAP 只允许 993 TLS 或 143 强制 STARTTLS，证书验证不能关闭。
- 默认拒绝本机、私网、云元数据及保留地址。确需连接平台自有内网邮件服务器时，部署层设置 `TRADEPILOT_MAIL_PRIVATE_ALLOWLIST` 为精确主机名到 RFC1918 IPv4 列表的 JSON，例如 `{"mail.corp.example":["10.0.0.5"]}`。不允许通配符、loopback、metadata；需要可验证原主机名的证书。普通租户不能增加例外；仍应加出站防火墙。
- 通用发送端一律按营销处理；`marketing:false` 不取消同意、抑制或退订保护。旧记录未有可验证确认时间时不得发送。唯一非营销例外为服务器固定的订阅确认模板，调用方不能注入任意内容。
- 邮件中心可「复制订阅申请链接」，或授权读取 `GET /api/email/consent` 的 `subscribeUrl`。收件人打开公开页面、自行填写邮箱，系统发确认邮件；收件人在 30 分钟内打开链接并 **POST 确认**才建立同意。明文确认令牌只经确认邮件交给收件人，不返回工作区 API 调用方。申请/确认后可以用抑制/同意事件核验。
- 退订 GET 只展示确认表单；POST（包括邮箱 one-click 请求）才写抑制。退订撤销确认并使旧挑战失效；重新订阅必须重新邮件确认，管理员不能直接解除。`MARKETING_POLICY_VERSION` 应对应正式告知条款版本。
- 本页“保存草稿”不发送。真实发送/同步仍需接口集成及实际 SMTP/IMAP 验收。不能保证撤回已进入供应商投递链路的在途邮件；营销许可、保留期和法域合规仍需独立评审。

### 媒体与对象存储

新上传同时校验字节内容、后缀和 MIME，拒绝 HTML/SVG/脚本；已验证图片/视频允许 inline，PDF 强制 attachment。旧记录没有 `verified_mime_type` 时统一 `application/octet-stream` + attachment + sandbox/nosniff；S3 签名下载覆盖旧对象的主动 MIME/disposition。若对象存储存在公开 URL，须先关闭匿名访问，不能以应用下载保护代替桶权限。

`TRADEPILOT_MEDIA_MAX_BYTES` 默认 100 MiB，整个 multipart 在实际流读取时限制为文件上限 + 2 MiB，再解析。**仍有界缓冲在内存中，不是直接流式上传到 S3**；按压测结果降低上限并在代理设置 body/concurrency 限制。多副本需 S3 或共享媒体卷，不能把本机文件当持久共享媒体。

### Stripe 权威状态对账

`STRIPE_SECRET_KEY` 需有读取 subscription、创建 Checkout/Portal 所需权限；`STRIPE_WEBHOOK_SECRET` 校验 webhook 签名。Secret 只从服务端注入。套餐价格必须在服务器 `billing_plans` catalog 中匹配唯一 Price ID，不能用事件 `metadata.plan_id` 授权升级。

事件 ID 幂等、同 ID 不同 payload 拒绝；subscription/customer/company 锁串行处理。相关回调每次取 Stripe 当前订阅，而不根据到达顺序猜状态；读取失败会回滚事件收据，返回非成功以便供应商重试。终止订阅不复活，订阅不能跨工作区转移。`reconciled_at` 记录最近权威对账时间；同秒和旧 invoice 事件均需复测。**本轮仅用合成事件和可控替身验证，未以真实 Stripe sandbox 证明续费、退款、税务或发票闭环。**

Compose 已透传上述限额、代理/mail 策略及可选 Stripe/指标/S3 变量；只是模板，不会读取 Secret Manager，也不会自动部署代理、证书、监控或告警。应把生产值通过受控部署配置注入，并复验运行容器中的实际策略（不要打印秘密）。
