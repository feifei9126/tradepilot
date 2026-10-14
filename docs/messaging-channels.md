# 微信服务号与 WhatsApp 消息接入

手机和电脑使用同一个 TradePilot 消息收件箱，不需要单独的手机 App。工作区所有者和管理员在「消息渠道」(`/app/bind`) 中配置，工作区成员通过「消息」(`/app/messages`) 查看、回复自己有权限访问的客户会话。

## 当前支持

- 微信服务号：服务器 URL 验证、安全模式 AES 消息验证解密、文本接收、关注/取消关注事件、客服接口文字回复。
- WhatsApp Business Cloud API：回调验证、HMAC 原始请求校验、消息接收、文字发送、平台接受/送达/已读/失败回执。
- 文本之外的图片、语音、视频等消息显示类型及平台提供的说明；当前不会下载或播放媒体附件。
- 自动建立来源客户，按渠道账号和外部用户区分会话；Webhook 重试去重。
- AI 回复草稿复用工作区的 AI Key、预算和用量统计，草稿由用户确认后发送。
- 发送使用幂等键。网络中断、超时等不能证明失败的情况显示「结果待核实」，不会自动再次投递。微信客服接口只返回接受结果，没有 WhatsApp 式的送达/已读回执。

当前不包含个人微信聊天同步、微信菜单编辑、平台模板群发和客户端扫码登录。旧版设备绑定生成/确认 API 继续关闭，第三方 HMAC 事件入口与官方渠道回调是各自独立的接口。

## 接入前准备

正式站点需要平台服务器可访问的 HTTPS 域名。部署环境设置 `AUTH_URL=https://你的站点域名`，重启 Web 服务，然后复制渠道页面生成的回调 URL。`localhost`、Docker 私有地址和仅局域网地址不能用于官方平台回调；页面在本地环境会提示这一点。

配置稳定的 `TRADEPILOT_CONFIG_KEY`（至少 32 字符）；已有环境也可使用 `AUTH_SECRET`。不要直接更换正在用于加密的根密钥，否则旧凭据无法解密。备份数据库和部署 Secret 时分别保护，两个部分都需要恢复。

### 微信服务号

1. 确认服务号登录、认证与接口权限正常，尤其是客服接口权限。
2. 公众号后台「设置与开发 / 基本配置」取 AppID、AppSecret；原始 ID 位于基本信息中。
3. TradePilot 添加微信服务号。Token 和 EncodingAESKey 可留空自动生成；AppSecret 必须填写，更新时可留空保留。
4. 保存后「查看接入参数」，复制回调 URL、Token 和 EncodingAESKey 至公众号服务器配置。消息格式选择 **XML**，消息加解密方式选择 **安全模式**。服务器配置 GET 验证按官方三参数签名实现，后续 POST 消息只接受已签名的加密内容。
5. 先记录原来的菜单与自动回复。启用开发模式会改变公众号后台自动回复及菜单的管理方式；本次功能不负责迁移或重建旧菜单。
6. 将 Web 服务的出口公网 IP 加入公众号 IP 白名单，测试 API 凭据。该测试获取访问令牌，不向客户发送消息。
7. 用微信关注服务号，发送一句话，在 TradePilot 收件箱确认收取，回复并检查微信端。

服务号只能收到用户给公众号发送的消息。文字客服回复限用户互动后的 48 小时，平台还有额外权限和频率限制，以官方 API 返回为准。取消关注后系统阻止回复。

### WhatsApp

1. Meta 开发者平台准备已启用 WhatsApp 的应用、Business Account 和 Cloud API 号码。测试号码使用测试接收号码白名单。
2. 在 API Setup 获取 Phone Number ID、Business Account ID 和 Access Token，在应用基本设置获取 App Secret。
3. 在 TradePilot 添加 WhatsApp 渠道。Graph API 版本与应用当前选择的受支持版本一致，界面示例为 `v24.0`，不是对“最新版本”的声明。
4. 复制回调 URL 和 Verify Token，在 Meta Webhooks 配置 `WhatsApp Business Account` 并验证。订阅 `messages` 字段，同时确认应用已经订阅目标 Business Account。
5. 生产环境配置获授 `whatsapp_business_messaging` 等所需权限的访问令牌，令牌过期或轮换时更新。当前不会自动授权或刷新 Meta 令牌。
6. 测试 API 凭据，再从另外的号码发送消息，检查 TradePilot 收件箱、回复及回执。

普通文字回复限最近一条用户消息之后 24 小时；超过窗口需要获批模板。本次不实现模板发送，不会通过伪装客户消息扩大时间窗口。

## 租户、存储和故障

`0010_messaging_channels.sql` 创建 `messaging_accounts`、`messaging_events`、`messaging_outbound`。账号密钥使用带租户和账号 AAD 的 AES-GCM 加密；AppSecret、Access Token 不返回浏览器。仅管理员可以按需查看接入 Token/EncodingAESKey，该操作写入审计。

入站消息、客户和关联权限使用 `crm_records`/`crm_record_links`。渠道地址包含独立账号 ID，签名之后仍会核对 AppID、原始 ID（若配置）、WhatsApp 电话号码和 Business Account（若配置）。账号配置及事件均绑定 `company_id`；停用工作区或渠道后不再接受新消息或发送。

重复事件由 `(account_id,event_id)` 唯一键和规范化内容摘要验证，批量入库使用同一事务。过期微信签名、错误签名、事件内容冲突和跨账号消息会拒绝。

消息中「已读」标记是内部处理标记；只有 WhatsApp 平台发来的 `read` 回执显示「对方已读」。平台仅接受发送时显示「平台已接受」，不承诺已送达。发送请求中断超过两分钟但无回执的记录显示「结果待核实」；管理员需要到平台核实，系统不自动重发。

## 官方资料

- 微信开发入门：https://developers.weixin.qq.com/doc/service/guide/dev/start.html
- 微信服务器推送配置：https://developers.weixin.qq.com/doc/service/guide/dev/push/
- 微信消息加解密：https://developers.weixin.qq.com/doc/service/guide/dev/push/encryption.html
- WhatsApp Cloud API：https://developers.facebook.com/docs/whatsapp/cloud-api/
- WhatsApp Webhooks：https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/

真实平台联调需要账号凭据、公众号/Meta 后台权限和正式 HTTPS 地址。本地测试、模拟回调和 API 单元测试不能替代真实消息验收。
