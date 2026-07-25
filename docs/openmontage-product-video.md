# OpenMontage 产品视频集成

TradePilot 不直接合并 OpenMontage 源码。OpenMontage 作为三种视频引擎中的高级制作选项：

1. TradePilot 管产品、客户、询盘、报价和视频任务。
2. OpenMontage 作为独立视频生产工作区运行。
3. `workers/openmontage-adapter` 在两者中间提供稳定 HTTP API。

这样做的好处是部署简单、职责清楚，也避免把视频生成依赖和主业务系统绑死。

## TradePilot 侧配置

`.env.local` 或部署环境中增加：

```bash
OPENMONTAGE_WORKER_URL=http://localhost:8787
```

直接运行 `npm start` 时会自动启动 Worker 并注入连接地址。只有单独启动 Web 且未配置该地址时，产品视频模块才会进入 Mock 模式；Mock 不会生成视频。

## 启动适配器

```bash
npm run video-worker
```

默认监听 `http://localhost:8787`。选择“本地快速”时使用内置 FFmpeg；选择“高级制作”时才调用配置的 OpenMontage 命令。工作区为：

```bash
workers/openmontage-adapter/openmontage-workspace
```

建议显式指定 OpenMontage 工作区：

```bash
OPENMONTAGE_WORKSPACE="$HOME/OpenMontage" npm run video-worker
```

跨服务器部署时，TradePilot 与 Worker 分别配置同一个外部地址：

```bash
# TradePilot 环境
OPENMONTAGE_WORKER_URL=https://video.example.com

# Worker 环境
OPENMONTAGE_PUBLIC_URL=https://video.example.com
```

Worker API 当前没有内置鉴权。生产环境请使用内网，或通过带 HTTPS、IP 白名单/访问控制的反向代理暴露服务，不要直接开放 8787 端口。

## API 合约

TradePilot 会调用以下接口：

```http
GET  /health
POST /jobs
GET  /jobs/:id
DELETE /jobs/:id
GET  /assets/:jobId/final.mp4
GET  /assets/:jobId/thumbnail.jpg
```

`POST /jobs` 会把产品视频 brief 写入：

```bash
$OPENMONTAGE_WORKSPACE/inbox/<jobId>.json
```

默认渲染器读取该 JSON，用首张素材图、产品名称和视频简报生成可播放的验证成片。OpenMontage 命令流水线也可以读取同一份 JSON，进一步生成多镜头、配音、音乐和精细剪辑。

## 命令模式

如果你后续把 OpenMontage 包装成了一个可执行脚本，可以让适配器自动调用它：

```bash
OPENMONTAGE_COMMAND=python3 \
OPENMONTAGE_COMMAND_ARGS_JSON='["scripts/tradepilot_job.py","--job-file","{jobFile}","--output-dir","{outputDir}"]' \
OPENMONTAGE_REPO="$HOME/OpenMontage" \
OPENMONTAGE_WORKSPACE="$HOME/OpenMontage" \
npm run video-worker
```

适配器使用 `spawn(..., { shell: false })`，不会把 Web 请求拼接成 shell 命令。

执行脚本完成后，把结果写入 `{outputDir}/result.json`：

```json
{
  "status": "completed",
  "progress": 100,
  "script": "Final script...",
  "videoUrl": "/assets/<jobId>/final.mp4",
  "thumbnailUrl": "/assets/<jobId>/thumbnail.jpg"
}
```

成片和缩略图文件应分别写入 `{outputDir}/final.mp4` 与 `{outputDir}/thumbnail.jpg`，避免返回浏览器无法访问的 `file://` 地址。

## 推荐使用流程

1. 在「产品」页维护产品资料。
2. 点击产品卡片上的「生成产品视频」。
3. 在「产品视频」页补充素材 URL、语言、画幅和视频简报。
4. TradePilot 创建任务并提交到适配器。
5. OpenMontage 工作区处理 inbox 中的 JSON。
6. 任务完成后，TradePilot 通过 `/jobs/:id` 刷新状态并展示视频链接。
7. 在任务管理区预览、下载、单个删除或批量删除；删除会同步清理 Worker 输出。

## OpenMontage 仓库

OpenMontage 项目地址：[https://github.com/calesthio/OpenMontage](https://github.com/calesthio/OpenMontage)
