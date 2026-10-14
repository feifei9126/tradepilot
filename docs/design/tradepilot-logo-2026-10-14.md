# TradePilot「领航帆」Logo

## 设计目标

面向 AI 获客、营销、客户沟通与外贸 CRM 的品牌标志。沿用网站已经采用的深绿、米白、黄铜色，替换通用 Compass 图标、蓝色房屋图标及框架默认 favicon。

## 最终方向

两片非对称几何帆与向前的船首：米白主帆表达业务方向，黄铜辅帆表达智能辅助。三块实心图形之间保留足够间距，让 16px 浏览器标签页仍能辨认。图形不依赖 AI 字标、机器人或复制现成图标。

标准图标在 64×64 网格上制作；图形保留在可裁切主屏幕图标中央的圆形安全区。字标沿用项目现有 Inter，使用 650 字重及收紧字距，组合导出为路径，无需额外字体。

## 应用与资产

- `TradePilotBrand`：官网导航、页脚、登录页、桌面侧栏和手机导航。
- `src/app/favicon.ico`：多尺寸浏览器图标，使用 Next.js 文件约定。
- `public/icon.svg`：高分辨率 SVG favicon 和网站图形。
- `public/manifest.json`：标准图标与独立 maskable 图标、品牌主题颜色。
- `public/apple-touch-icon.png`：iOS 主屏幕图标。
- `public/brand/`：透明 PNG、矢量组合、浅色文字及单色版；README 说明使用规范与字体来源。
- `scripts/generate-brand-assets.mjs`：从品牌 SVG 重建所有图标；不增加新的 npm 依赖。

本次仅更新品牌显示及图标，无数据库迁移或渠道配置变更。

## 验收要求

检查导出 SVG 的独立渲染、透明 PNG、ICO 多尺寸及 maskable 安全区域。检查官网/登录/后台在桌面和手机的可见品牌、图标响应、无图片缺失或横向溢出。通过 lint、TypeScript 及生产构建后更新本地 Docker Web 预览。

## 验证结果

- ESLint 与严格 TypeScript 通过，证据 `/tmp/tradepilot-logo-checks-20261014.log`。
- 独立渲染检查：SVG 字标为纯轮廓路径；透明 PNG 尺寸正确；favicon 含 16/32/48/64px；maskable 图标满底色，图形不超出中央 80% 圆形安全区。证据 `/tmp/tradepilot-logo-assets-20261014.json`。
- Docker Next.js 生产构建通过，镜像 `tradepilot-preview-tradepilot:logo-20261014`，日志 `/tmp/tradepilot-logo-docker-build-20261014.log`。
- 本地 3461 已替换 Web 容器；数据库/视频容器保持原实例，运行配置、管理员账号文件和业务记录计数保持一致。原 Web 镜像保留为 `logo-before-20261014`。日志 `/tmp/tradepilot-logo-deploy-20261014.log`。
- 1440/768/390/375px 的官网、登录、注册、后台导航共 16 个浏览器场景通过：有可见品牌、图像加载成功、无页面脚本错误、无失败请求或页面横向溢出；线上响应的 SVG/PNG/ICO SHA256 与源文件一致。页面声明 SVG favicon 和 Apple Touch Icon 正常。浏览器日志 `/tmp/tradepilot-logo-browser-20261014.log`。
- 可视化预览、页面截图、`qa-result.json` 与仅包含 Logo 图形的素材 ZIP 位于本地 `tradepilot-logo-20261014` 可视化目录。仅验证主屏幕素材尺寸/安全区及 metadata，未在真实 iOS/Android 设备执行添加主屏幕。
