# LiveKit Agents：AI 语音客服与营销意向采集

> 推荐入口：**系统 → API 配置中心 → 连接语音与视频**。本页环境变量仅作为首次未保存配置时的兼容方式；保存后以中心为准。Worker 会读取同一数据卷的加密配置，相关配置变化会重启会话进程。参见 `docs/api-configuration.md`。

## 本次接入范围

入口：登录后侧栏 **AI 语音客服**，路径 `/app/voice-agent`。

- 客服模式：依据操作员提供的业务资料答疑、澄清问题、提交人工跟进草稿。
- 营销模式：了解需求、数量、时间等；经客户明确同意后采集最少必要的联系信息。
- 浏览器实时语音、静音/恢复、打断、双方字幕；中文/英文首选语言。
- Agent 通过可靠数据消息向当前操作员发送意向线索卡片，操作员核实许可与字段后点击创建客户，复用 `POST /api/contacts`。
- 人工跟进请求显示在当前页面；**不等于已转接，不会通知坐席、建立工单或拨打电话**。
- 结束会话后仍可查看/下载文字记录（页面最多保留最近 300 条字幕）。刷新、离开页面或开始新会话会清空当前记录；不自动归档对话。

这是一个**登录后的内部试用工作台**。没有公开访客 token 接口、网站嵌入组件、SIP 外呼或 WhatsApp/微信音频接入。不要把现有登录保护去掉后直接对公网提供 token。

## 架构

```text
登录用户 → POST /api/livekit/session → 5 分钟有效期、单房间、仅麦克风发布的 JWT
浏览器 → LiveKit 房间 → 按 agent_name 自动调度指定 Worker
                        ↓
              独立 Python LiveKit Agents 进程
                        ↓
                  OpenAI Realtime
                        ↓
           字幕 / lead、handoff 数据事件 → 浏览器
                        ↓（操作员核实并确认）
               现有 POST /api/contacts
```

API 令牌里附带 `RoomConfiguration.agents`，只在用户真正连接新房间时调度，不另行创建第二次 dispatch。
房间名、参与者身份由服务器生成；客户端不能自选任意房间或 agent 名称。业务模式、语言、资料作为签名的 dispatch metadata 传递，Worker 不信任可变的参与者 metadata。

新增 Web 依赖的具体版本由根目录 `package-lock.json` 锁定。Worker 使用 Python 3.11–3.13，LiveKit Agents `~=1.8.2`，完整依赖由 `agents/customer-service/uv.lock` 锁定。Web 与 Worker 必须使用同一 LiveKit 项目的 URL/key/secret 和同一 agent name。

## 本地运行

### 1. 准备凭据

创建 LiveKit Cloud 项目（也可使用自行维护的 LiveKit 服务），取得 URL、API key、API secret。
另外准备有 Realtime 模型访问能力的 OpenAI API key。两种服务可能产生费用；TradePilot 现有浏览器 BYOK 设置不会自动传入这个 Worker。

### 2. 配置 Web

在项目根目录 `.env.local` 中加入以下值；已有登录/数据库配置请保留，不要覆盖：

```dotenv
AUTH_SECRET=replace-with-output-of-openssl-rand-hex-32
AUTH_URL=http://localhost:3458
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret
LIVEKIT_AGENT_NAME=tradepilot-customer-service
```

```bash
npm ci
npm run dev
```

本地开发默认演示登录为 `demo@tradepilot.dev` / `12345678`；生产必须配置自己的管理员账号。

### 3. 配置并启动 Worker

另开终端：

```bash
cd agents/customer-service
cp .env.example .env.local
# 编辑 .env.local：填入与 Web 一致的 LiveKit 凭据，以及 OPENAI_API_KEY。
uv sync --locked
uv run python agent.py dev
```

Worker 只读取自己目录里的 `.env.local` 和进程环境变量，不需要 Web 的管理员密码、AUTH_SECRET 或数据库凭据。
默认 `gpt-realtime` + `marin`，输入字幕使用 `gpt-4o-mini-transcribe`。可通过 `OPENAI_REALTIME_MODEL`、`OPENAI_REALTIME_VOICE`、`OPENAI_TRANSCRIPTION_MODEL` 覆盖；必须使用供应商支持的模型/声音。语音模型 key 不要放在 `NEXT_PUBLIC_*` 中。

无需下载 VAD 模型；本实现使用 Realtime 服务提供的语音活动检测。

### 4. 试用

1. 打开 `http://localhost:3458/app/voice-agent` 并登录。
2. 选择业务场景、语言，填写**可向客户公开的已核实业务资料**。
3. 阅读并确认音频与转写处理说明，点击「开始语音会话」，允许麦克风。
4. 说「请介绍你自己」验证回复与字幕。营销模式可模拟提供需求和明确的联系许可。
5. 在待确认线索卡片里核对客户名称/邮箱/电话，再点击「确认许可并创建客户」。
6. 说「我需要人工帮助」验证仅出现跟进请求，不声称已转接。
7. 点击结束后，浏览器应释放麦克风。需要留档时下载文字记录。

浏览器需要 HTTPS 或 localhost；通过局域网纯 HTTP 地址通常不能使用麦克风。
「已配置」只检查环境变量格式，不代表 LiveKit/模型凭据已验证、Worker 在线或网络连通。

## Docker Compose

根目录 `.env` 中配置现有部署变量及 LiveKit/OpenAI 变量（参照 `.env.example`）。新增 Worker 在可选的 `voice` profile 中；不开启 profile 不影响原有部署。

```bash
# 启动已有应用及可选语音 Worker
# 原项目中的视频等服务也会按原有 compose 配置启动。
mkdir -p plugins
docker compose --profile voice up -d --build

docker compose --profile voice logs -f livekit-agent
```

已运行的部署可单独启动 Worker：

```bash
docker compose --profile voice up -d --build livekit-agent
# Web 环境变量改变后，需要重新创建 Web 容器。
docker compose up -d --build tradepilot
```

Worker 无需暴露公网端口，通过出站连接接入 LiveKit 和 OpenAI。生产站点使用 HTTPS + `wss://`；本地自托管开发可用 `ws://localhost:7880`，但生产配置会拒绝明文 WebSocket。
Docker 中 `localhost` 指容器本身，应使用浏览器与 Worker 均可达的 LiveKit 地址。
Worker 要部署为常驻进程，不能放在 Next.js 路由或 Cloudflare Worker 中。
本次新增功能以 Node.js Web + 独立 Python Worker 为验证目标，未验证 OpenNext/Cloudflare 构建。

## 安全与数据边界

- GET/POST 会话接口同时受现有中间件及路由内登录检查保护；POST 验证 Origin（存在时）、JSON 类型、输入大小及明确确认。
- 每用户每分钟最多创建 5 个令牌（**单进程内存限流**）。多副本生产部署需补共享限流、并发/费用配额与网关保护；不能把这当作完整防滥用系统。
- 单令牌仅允许加入一个随机房间、发布麦克风音轨和订阅媒体，不允许摄像头、数据发布、房间管理或修改自己的 metadata。
- 加入令牌有效期 5 分钟**不等于**通话 5 分钟；Worker 独立执行最多 15 分钟的房间关闭，参与者离开也会关闭会话。房间重连行为仍应按部署版本做验收。
- 不读取 CRM 订单、内部成本、客户目录或其他租户数据。不要把秘密/敏感信息放入业务资料：资料会进入令牌和 AI 上下文。
- 模型不能直接创建客户、发送消息、改订单或报价。工具只产生有边界的草稿事件；前端验证发送方确为本房间 Agent，再验证事件结构。
- AI 关于联系许可的识别不能替代人工核实。模型仍可能幻觉或受到提示注入影响；本实现不把提示词当成可靠权限边界。
- Worker 显式 `record=False`，不启用 LiveKit 会话音频/字幕/trace 录制；应用不主动持久化音频或全文转写。模型提供商及基础设施的数据处理/留存仍需单独审核。
- **现有客户模块使用 `src/lib/store.ts` 的内存 MVP 存储**。这里创建的客户沿用这一行为，重启可能丢失，不是持久化、多租户 CRM 的完整实现。上线真实线索前应改用有租户权限的数据库仓储。
- 工具事件只在当前连接中传送，不是可靠持久化任务队列；断线时可能丢失。人工跟进必须由操作员自行落实。

## 测试与验收

不需要真实凭据的测试：

```bash
npm run test:livekit
npx tsc --noEmit
npm test

cd agents/customer-service
uv run pytest -q
uv run ruff check .
```

自动测试覆盖配置、匿名/跨站拒绝、输入限制、令牌签名/权限/dispatch、限流、工具许可/长度检查、失败/去重/数量上限。
真实语音还需要有凭据的人工联调：双向音频、两侧字幕、打断、拒绝麦克风、Worker 离线、断网重连、15 分钟超时、结束后释放设备、卡片及 CRM 保存。
没有配置 LiveKit 与模型凭据时，不应把离线单元测试通过描述为真实语音端到端通过。

## 排障

| 现象 | 检查 |
| --- | --- |
| 「尚未配置」/503 | Web 的三个 LIVEKIT 变量是否齐全；是否使用 ws/wss；修改后是否重启 |
| 401 / 跳登录 | 现有 NextAuth 会话、AUTH_SECRET、AUTH_URL 和 cookie 配置 |
| 403 | AUTH_URL 的公网 origin 是否与浏览器访问一致，尤其是反向代理 |
| 429 | 一分钟后重试；生产检查共享限流/配额 |
| 连上房间但无 Agent | Worker 是否运行、agent name 是否相同、两侧是否为同一个 LiveKit 项目 |
| Agent 进入后无回复 | 模型凭据/额度/模型权限、Worker 网络、Worker 日志（注意脱敏） |
| 有字幕但没有声音 | 点击「开启声音播放」、检查浏览器自动播放限制及输出设备 |
| 无法打开麦克风 | HTTPS/localhost、浏览器许可、系统麦克风许可及硬件 |
| 线索没有保存 | 模型只生成草稿，必须人工点击；已有客户存储不是持久化数据库 |

## 官方参考

- [LiveKit 语音 Agent 快速开始](https://docs.livekit.io/agents/start/voice-ai/)
- [Named agent dispatch / token room configuration](https://docs.livekit.io/agents/server/agent-dispatch/)
- [OpenAI Realtime 插件](https://docs.livekit.io/agents/models/realtime/plugins/openai/)
- [Function tools](https://docs.livekit.io/agents/logic/tools/definition/)


## 本次离线验证结果

- Web 测试：66 项通过（其中 LiveKit 新增 6 项）。
- Agent 测试：12 项通过，包含工具校验、并发去重、指定参与者、禁用录制与时长关闭逻辑。
- TypeScript 类型检查和生产构建通过；全仓 ESLint 无错误，仍有 8 条原有警告。
- 本地浏览器：登录保护、缺失配置、许可勾选、模拟连接失败后重试，以及 375/768/1440 像素宽度无横向溢出检查通过。没有既有截图基线，因此不把该检查称为完整视觉回归通过。
- Docker Compose 配置解析通过；未构建/启动 Docker 镜像。
- 未提供 LiveKit/OpenAI 凭据，**未验证真实双向语音与云端调度**。
- `npm audit` 报告原有依赖存在 20 项告警（含 1 项 critical，涉及 Next.js）。已对照原始 lockfile 确认受影响包的版本未被本次接入改变；没有执行可能破坏原项目的大范围自动升级。生产上线前必须单独处理安全升级与回归验证。
