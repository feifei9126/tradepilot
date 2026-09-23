# 统一 API 配置中心

入口：侧栏 **系统 → API 配置中心**（`/app/api-config`）。配置入口已从设置页移出；首页在文本模型未配置时显示引导。

## 四步接入

1. **接入文本模型**：选择一个 OpenAI 兼容提供商，填写地址、API Key、模型及请求路径。Ollama 可不填 Key；Docker 访问 Mac 本机 Ollama 使用 `http://host.docker.internal:11434/v1`，不是容器自己的 localhost。保存后可读取已安装的 Ollama 模型列表。
2. **分配 AI 功能**：全部任务共用上述提供商和密钥。可单独覆盖模型名称，但不能把不同厂商的模型名称直接用于同一个不支持它们的 API。
3. **连接语音与视频**：集中填写 LiveKit、OpenAI Realtime、Firecrawl、视频适配器和 MoneyPrinterTurbo 的连接参数。
4. **验证并开始使用**：先保存，再执行各服务连接测试。文本测试会发送一条短请求，可能产生费用。可从此步骤跳转到业务页面。

**统一入口不等于一个 Key 能访问所有厂商。** 语音需要 LiveKit 和支持 Realtime 的官方 OpenAI 凭据。仅选择官方 OpenAI 文本端点时支持复用文本 Key。其他官方平台或聚合网关的 Key 不会被自动发给 OpenAI。

## 功能与配置对应

| 功能 | 使用的集中配置 | 边界 |
| --- | --- | --- |
| 询盘回复、邮件撰写、文字客服 | 文本默认模型，可按任务覆盖 | 生成草稿不等于自动发送 |
| 客户资料识别、产品资料补全、智能报价、跟单建议 | 同一文本 API | 报价和业务建议仍需人工核对 |
| 客户分析 | 预留统一任务映射 | 映射本身不新增业务界面 |
| AI 获客 | 文本 API 的获客任务 | 生成营销文案，不自动搜集客户、投放广告或群发 |
| 产品视频脚本 | 文本 API 的视频脚本任务 | 创建视频时勾选“使用统一 AI 模型生成视频脚本”；失败不提交渲染 |
| 产品网页、图片及视频素材抓取 | Firecrawl 地址和 Key | 需自行部署或订阅服务 |
| 本地 FFmpeg 视频 | 视频适配器地址 | 无需模型 Key；本地渲染不新增语音配音 |
| OpenMontage 视频 | 视频适配器地址 | OpenMontage CLI/运行环境仍须在适配器主机安装 |
| MoneyPrinterTurbo 成片、配音、字幕 | MPT 地址和 Key，及可选统一 AI 脚本 | MPT 服务本身的部署/素材源/配音引擎仍属于其运行环境配置，不由 CRM 安装 |
| AI 语音客服 | LiveKit + OpenAI Realtime + Agent 名称 | 需启动语音 Worker，真实通话才可验证完整链路 |
| 产品设计中的商品图、规格书等未实现功能 | 页面链接已指向配置中心 | 未实现功能不会因配置 Key 自动实现 |

配置测试区分：文本实际请求、LiveKit 控制面鉴权、OpenAI Key 基础鉴权、Firecrawl 根路径可达性、视频服务健康。**Key 测试通过不证明拥有特定实时模型权限；健康检查通过不证明抓取或视频制作成功。**

## Docker 语音服务

```bash
docker compose --profile voice up -d --build livekit-agent
```

可以先启动再填配置。缺少凭据时 Worker 保持等待，不创建外部会话。保存后，已启动的 Worker 每约 10 秒读取共享加密配置；连接或语音配置变化会重启其子进程，可能中断正在进行的通话。仅改普通文本任务映射不会重启语音。

Web 容器读写 `tradepilot_data`，语音容器只读挂载同一卷。两者必须使用相同加密密钥和能读取配置文件的 UID（当前均为 1000）。

## 保存、迁移与安全

- 仅部署管理员可管理配置；其他工作区不能使用本实例共享服务凭据。当前是**单实例部署配置**，不是多租户密钥保险库。
- 密钥在服务端 AES-256-GCM 加密保存为 `TRADEPILOT_DATA_DIR/ai-config.enc.json`（Docker `/app/data/ai-config.enc.json`），文件权限 0600。浏览器读取时仅获得“已配置”标志，不回传密钥。
- 加密密钥优先使用 `TRADEPILOT_CONFIG_KEY`，未设置则使用 `AUTH_SECRET`；至少 32 字符。**同时备份配置文件和原加密密钥**。直接更改密钥不会自动迁移旧文件；解密失败时系统拒绝覆盖，不回退到旧凭据。
- 同一服务地址下，表单密钥留空保留原值，点击“清除”才删除。更换提供商、服务地址或文本请求路径时，必须重新输入相应密钥；不会把旧密钥自动发送到新地址。切换提供商会清除旧文本 Key/Headers，避免误发到新厂商。
- 保存有版本冲突保护，适用于当前单 Node 进程；不支持多个 Web 副本并发写同一配置。
- 首次未保存时兼容服务环境变量。保存后以中心配置为准，环境变量变更不再覆盖它。旧的 Firecrawl 托管部署 URL 若仍要用，请填入中心后保存；保存后清空 URL 会禁用该连接，不再回退旧托管文件。
- 检测到旧浏览器 `tradepilot_ai_config` 时，由管理员明确选择一个提供商载入，再保存和验证。旧密钥不会自动上传或删除；确认迁移后可以手动清除浏览器旧配置。
- API 访问地址只能由部署管理员保存，业务请求不接受客户端 API URL/Key 覆盖。允许局域网自托管地址；只填写可信服务器。
- API 配置和视频任务可持久化，**不代表原项目内存中的客户、询盘等 CRM 业务数据已数据库化**。重启试用实例前请勿保留重要客户数据。

## 官方模型与聚合平台

“接入文本模型”按三组展示，所有预设共用同一个服务器配置和安全校验。

| 分组 | 提供商 | 默认 Base URL | 模型填写方式 |
| --- | --- | --- | --- |
| 官方 | OpenAI（ChatGPT） | `https://api.openai.com/v1` | 默认 `gpt-4o-mini`；可改成账号支持的 Chat Completions 模型 |
| 官方 | Kimi / Moonshot | `https://api.moonshot.cn/v1` | Moonshot 控制台的模型 ID |
| 官方 | 豆包 / 火山方舟 | `https://ark.cn-beijing.volces.com/api/v3` | 已开通的模型 ID 或 `ep-…` 推理接入点 |
| 官方 | Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | AI Studio 支持的模型 ID |
| 官方 | 智谱 GLM / BigModel | `https://open.bigmodel.cn/api/paas/v4` | 智谱通用 API 授权的 GLM 模型 ID |
| 官方 | DeepSeek | `https://api.deepseek.com` | 保留原预设 `deepseek-chat`，可按平台修改 |
| 官方 | 通义千问 / 百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 默认 `qwen-plus`，可修改 |
| 聚合 | OpenRouter | `https://openrouter.ai/api/v1` | 平台完整模型标识，保留厂商前缀和后缀 |
| 聚合 | 硅基流动 / SiliconFlow | `https://api.siliconflow.cn/v1` | 平台完整 ID，保留组织名及可能的 `Pro/` 前缀 |
| 聚合 | New API / One API | 手动填写可信网关地址，通常以 `/v1` 结尾 | 网关允许的模型名或映射别名 |
| 本地 | Ollama | `http://host.docker.internal:11434/v1` | 已安装模型及 `:标签` |
| 自定义 | 其他聚合 / OpenAI 兼容 API | 手动填写 | 服务实际支持的模型 ID |

### 接入步骤与限制

1. 选择平台后自动填入 Base URL 和标准 `/chat/completions` 请求路径。**不要把完整的聊天请求 URL 再填入 Base URL**，否则路径会重复。服务的地域或网关前缀不同时可修改地址。
2. 填写 API Key 与模型 ID。新加入的平台不硬编码一个随时可能下线或无权限的默认模型，必须从自己的控制台复制实际可用 ID；每个平台卡片提供接入文档入口。聊天网页账号/密码不作为 API 凭据使用。
3. 聚合平台填写**聚合平台自身签发的令牌**；在“分配 AI 功能”中可以给询盘、获客、文字客服、视频脚本等填写不同模型，仍使用同一聚合平台地址与 Key。不要把不同官方平台的密钥混填。
4. 先保存，再到最后一步测试。测试默认模型，不使用询盘任务覆盖；最多允许 1024 输出 token，可能产生费用。推理模型若先耗尽额度而没有正文，会明确提示，不能把该结果直接判断为 Key 无效。
5. 切换提供商会清空文本 Key、Headers、旧请求路径与任务模型覆盖。已有任务覆盖时先确认，取消则完整保留表单。切换后仍须点击保存，未保存不影响服务端现有配置。

接入层发送 **OpenAI Chat Completions 格式的文本消息和 Bearer 鉴权**。新增平台不强制发送温度参数，避免部分模型拒绝通用温度取值；使用其服务默认值。并非平台内的所有模型都接受这一协议：仅支持 Responses 的模型、原生 Anthropic Messages、原生 Gemini generateContent、独立图像/视频 API 不在此文本接口范围内。New API / One API 的网关需要提供对应的兼容转换。

新平台密钥不会复用到 OpenAI Realtime。语音、抓取、视频渲染仍在同一中心的第三步分别配置，**新增文本平台不代表这些服务自动获得同平台的语音、图像或视频生成能力**。

自动化测试覆盖全部 12 个提供商的 schema、加密保存、密钥隔离与 10 类任务路由；HTTP 使用本地 mock。没有真实厂商密钥时不能证明账号额度、区域权限和真实模型调用成功。
