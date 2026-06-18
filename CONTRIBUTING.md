# 贡献指南

感谢你考虑为 TradePilot 做出贡献！

## 行为准则

请保持友善和专业的沟通。我们欢迎来自不同背景的贡献者。

## 如何贡献

### 报告 Bug

1. 检查 Issue 列表中是否已有相同问题
2. 创建新 Issue，包含：
   - 描述问题的步骤
   - 期望行为 vs 实际行为
   - 截图（如适用）
   - 浏览器版本/Node.js 版本

### 提交功能建议

1. 创建 Feature Request Issue
2. 清晰描述你期望的功能
3. 说明该功能的适用场景

### 提交代码

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/amazing-feature`
3. 提交改动：`git commit -m 'feat: add amazing feature'`
4. 推送到分支：`git push origin feat/amazing-feature`
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循现有代码风格
- 添加必要的注释
- 确保所有页面返回 HTTP 200

### 开发流程

```bash
# 克隆并安装
git clone https://github.com/tradepilot/tradepilot.git
cd tradepilot
npm install

# 启动开发服务器
npx next dev -p 3456

# 构建生产版本
npx next build
```

## 插件开发

参考 [plugins/product-design/](plugins/product-design/) 了解插件开发规范。

## 提问

如有疑问，请通过 GitHub Issues 或 Discussions 联系我们。
