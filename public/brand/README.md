# TradePilot Logo：领航帆

双帆与向前的船首组成项目专用几何标志，表达跨境贸易、智能协作和领航增长。图形由本项目设计，使用 SVG 实心路径，网页不依赖图标库或外部图片服务。

## 文件

| 文件 | 用途 |
| --- | --- |
| `tradepilot-logo.svg` / `.png` | 浅色背景的图形与英文标准组合；PNG 为 1600px 宽透明底 |
| `tradepilot-logo-light.svg` / `.png` | 深色背景的浅色文字组合 |
| `tradepilot-mark.svg` / `.png` | 无底色的双色标志；PNG 为 1024px 透明底 |
| `tradepilot-wordmark.svg` | 转为路径的英文名称与副标字稿 |
| `tradepilot-mark-mono.svg` | 单色标志，修改填充色可用于反白、印刷、刻印 |
| `../icon.svg` | 深绿色圆角底的网页导航图标 |
| `../icon-192x192.png` / `../icon-512x512.png` | 标准主屏幕图标 |
| `../icon-maskable-512x512.png` | 满底色、前景位于中央安全区的可裁切图标 |
| `../apple-touch-icon.png` | 180px iPhone/iPad 主屏幕图标 |
| `../../src/app/favicon.ico` | 16/32/48/64px 多尺寸浏览器图标 |

颜色：深绿 `#28624B`、米白 `#F4F1E6`、黄铜 `#C3AA77`；标准文字 `#1E2E24`。

字标采用项目已有的 Inter 650 字重，并转换为路径，导出的 SVG 无需安装字体。Inter 字体作者为 Rasmus Andersson / The Inter Project Authors，字体按 SIL Open Font License 1.1 授权；此处的 SVG 是文字轮廓图形，不分发修改后的字体文件。

## 使用

- 标准组合不拉伸、不拆散、不为标志额外添加描边和渐变。
- 四周至少预留图形宽度的 1/4，浅底用标准组合，深底用浅色组合。
- 16px 标签页使用图形图标；带文字的组合建议宽度至少 140px。
- 将 `tradepilot-mark.svg` 作为标志图形的唯一编辑源，文字轮廓源为 `tradepilot-wordmark.svg`。修改后执行 `npm run brand:generate`，重新生成 PNG、ICO 和主屏幕图标。该脚本读取现有 SVG 源文件，无需网络或服务账号。
- 网页使用共享组件 `TradePilotBrand`，保持官网、登录、侧栏及移动导航一致。
