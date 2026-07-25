# Firecrawl 产品与媒体采集

## 它解决什么问题

Firecrawl 是 TradePilot 的网页采集服务。用户给出一个公开商品详情页后，它会读取静态和动态页面；TradePilot 再从返回内容中整理产品名称、型号、价格、描述、图片及视频链接。所有内容会先显示预览，只有用户确认后才写入产品目录。

已导入的图片和视频会出现在「产品视频」素材区。采集到的公开视频可以继续交给 MoneyPrinterTurbo 重新编排、配音和出片。Firecrawl 负责采集，不负责生成视频。

## 本机一键部署

1. 安装并启动 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。
2. 登录 TradePilot，打开「产品」并点击「Firecrawl 抓取」。
3. 确认 Git、Docker、Docker Compose 三项检查均为可用。
4. 点击「一键部署 Firecrawl」。页面可以关闭，构建会在后台继续。
5. 再次打开弹窗可查看阶段、进度和日志。部署完成后系统会真实抓取 `https://example.com`，通过后才显示“已连接”。

首次构建通常需要 5-15 分钟以上，具体取决于网络和电脑性能。建议至少预留 10 GB 磁盘和 8 GB 可用内存。安装器固定使用官方 `v2.11.0`，源码默认存放在 `~/.tradepilot/firecrawl`，完整服务栈包括 API、Playwright、PostgreSQL、Redis 和 RabbitMQ。

页面部署只在本地回环地址默认开启。远程服务器如确实需要由已登录用户启动部署，管理员必须显式配置：

```bash
TRADEPILOT_ALLOW_SERVICE_DEPLOY=true
```

这会允许网页启动宿主机进程，只应在受信任的管理环境中使用。

## 命令行兜底

页面无法调用宿主机 Docker 时，可在 TradePilot 项目根目录执行同一个受控安装器：

```bash
npm run firecrawl:deploy
```

查看或停止由 TradePilot 管理的服务：

```bash
cd ~/.tradepilot/firecrawl
docker compose --project-name tradepilot-firecrawl ps
docker compose --project-name tradepilot-firecrawl logs -f api
docker compose --project-name tradepilot-firecrawl down
```

一键部署成功后，连接信息写入 `data/firecrawl-managed.json`，TradePilot 会立即读取，不必修改 `.env` 或重启主站。部署状态和日志也保存在 `data/`，该目录不提交到 Git。

## 使用流程

1. 在「产品」页点击「Firecrawl 抓取」。
2. 粘贴无需登录、可公开访问的商品详情页 URL。
3. 点击「开始抓取」，等待产品资料和媒体预览。
4. 检查名称、型号、价格、描述以及图片/视频数量。
5. 点击「确认添加到产品目录」。
6. 需要制作视频时，点击产品上的「生成产品视频」，选择 MoneyPrinterTurbo 或其他可用引擎。

来源网页地址会保留在产品中。需要登录、DRM、短时签名或防盗链的视频即使被发现，也可能无法被下游视频引擎下载。

## 使用现有服务或 Firecrawl Cloud

如已有 Firecrawl 服务，可直接配置服务端环境变量；显式环境变量优先于一键部署生成的本机配置：

```bash
FIRECRAWL_API_URL=http://localhost:3002
FIRECRAWL_API_KEY=
```

`FIRECRAWL_API_KEY` 只在 TradePilot 服务端读取，不会下发给浏览器。自托管实例通常不要求 API Key，Firecrawl Cloud 则需要填写其密钥。

TradePilot 自身运行在 Docker 容器内时，容器中的 `127.0.0.1` 不是宿主机。此时应在宿主机执行部署命令，并将 `FIRECRAWL_API_URL` 配置为容器可访问的地址，例如 macOS/Windows 上的 `http://host.docker.internal:3002`。不要为了网页部署把 Docker Socket 暴露给公网容器。

## 安全边界

- 抓取入口和确认入口都只接受 HTTP/HTTPS URL，不允许 URL 凭据。
- TradePilot 会解析 DNS，拒绝 loopback、私网、链路本地、组播和文档地址，降低 SSRF 风险。
- 确认导入时会再次验证来源和媒体 URL，不能用浏览器返回值绕过校验。
- MoneyPrinterTurbo 下载素材时限制重定向、媒体类型和文件大小。
- 一键部署接口不接收命令、版本或安装路径参数，不能执行用户提交的 Shell 内容。

官方项目：[firecrawl/firecrawl](https://github.com/firecrawl/firecrawl)。
