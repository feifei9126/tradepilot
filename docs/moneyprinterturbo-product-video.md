# MoneyPrinterTurbo 产品视频集成

TradePilot 将 MoneyPrinterTurbo 作为独立视频 Worker 使用，不把 Python、MoviePy、FFmpeg、TTS 或字幕模型合并进 Next.js 主进程。

## 一键部署

在项目根目录执行：

```bash
bash install.sh
```

该命令启动：

- TradePilot Web：`http://localhost:3456`
- 本地 FFmpeg Worker：仅 Docker 私有网络可访问
- MoneyPrinterTurbo API：仅 Docker 私有网络可访问
- Redis：保存 MoneyPrinterTurbo 任务状态

安装脚本先确认 TradePilot 与本地视频 Worker 可访问，再在后台拉取 AI 视频镜像。MoneyPrinterTurbo 因网络或资源不足启动失败时，主站仍保持可用；安装日志保存在 `~/.tradepilot/moneyprinterturbo-install.log`，稍后可执行 `docker compose up -d moneyprinterturbo` 单独重试。

首次启动需要下载约 0.7 GB 的 MoneyPrinterTurbo CPU 镜像。素材缓存、音频和成片保存在 `moneyprinterturbo_storage` 持久卷中。

检查服务：

```bash
docker compose ps
docker compose logs -f moneyprinterturbo
```

## 生产流程

1. TradePilot 验证产品、时长、画幅和最多 6 张素材 URL。
2. 服务端校验 URL 协议、DNS 结果、私有 IP、重定向、文件类型和 15 MB 大小上限。
3. JPEG/PNG 素材上传到 MoneyPrinterTurbo 的 `/api/v1/video_materials`。
4. TradePilot 提交带完整营销脚本的 `/api/v1/videos` 请求，因此默认不需要额外 LLM Key。
5. 页面轮询任务状态，并映射为排队、渲染、完成或失败。
6. 浏览器通过 TradePilot `/api/product-videos/:id/asset` 代理预览和下载，不接触 Worker 内部地址。
7. 删除任务时同步删除 MoneyPrinterTurbo 任务和成片目录。

## 配置

默认配置位于 `deploy/moneyprinterturbo/config.toml`：

- 本地产品素材模式
- Edge TTS 与字幕
- 随机本地背景音乐
- Redis 任务状态
- 2 个并发任务，最多 20 个排队任务

独立部署 MoneyPrinterTurbo 时，在 TradePilot 环境中设置：

```bash
MONEYPRINTERTURBO_URL=https://private-video.example.com
MONEYPRINTERTURBO_API_KEY=replace-when-upstream-auth-is-enabled
```

MoneyPrinterTurbo 上游当前默认未启用 API 鉴权。远程部署必须置于私有网络，或通过带 HTTPS、身份认证、请求体上限和 IP 白名单的反向代理接入。

## 数据与清理

TradePilot 视频任务写入：

```text
data/product-video-jobs.json
```

文件使用临时文件加原子重命名写入，避免并发请求造成半写状态。Docker 使用 `tradepilot_data` 持久卷。

MoneyPrinterTurbo 的上传素材没有独立删除 API。删除任务会清理任务成片，但共享素材目录应定期通过 MoneyPrinterTurbo 的缓存清理功能维护。

## 上游项目

- MoneyPrinterTurbo：https://github.com/harry0703/MoneyPrinterTurbo
- 固定版本：`v1.3.2`
- 许可证：MIT
