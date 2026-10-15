# TradePilot 的 braces 安全补丁

此目录基于 MIT 许可的 `braces@3.0.3`，不是上游发布版；使用独立包名 `@tradepilot/braces` 和本地补丁版本 `3.0.3-tradepilot.1`，且禁止发布。
原始 tarball、integrity 及每个源文件的 SHA-256 见 `UPSTREAM.json`；原作者与 MIT 许可保留。

## 补丁范围

针对 GHSA-vfj7-8cjw-p6xm：在解析阶段限制嵌套；进入递归的 compile、expand、stringify 前，使用非递归遍历校验 AST 深度、节点数及子节点环。安全边界固定为 AST 深度 64、131072 个节点，不允许通过 options 解除。
超限抛出带稳定 code 的 SyntaxError，不回显输入；正常 glob/范围/转义逻辑保留上游实现；仅将 stringify 源文件多余的 EOF 空行规范化，哈希回归会还原后比较。
这仍是抛出异常的 API，调用方应按常规捕获无效模式；不是吞错或对任意模式无限制提供服务。

该依赖只用于开发工具的 ESLint → fast-glob → micromatch 链，不能加入应用运行时。npm overrides 强制该链使用本补丁，生产 npm ci --omit=dev 不安装它。

## 验证和退出条件

- `npm test` 包含深嵌套、直接 AST、环、宽 AST、正常展开与真实 micromatch 链的回归。
- 对照原始上游包的正常模式语料必须保持一致；保留 package-lock 的官方 registry 校验，只允许这一固定本地包路径。
- CI 继续执行原有 npm audit --audit-level=high，没有 advisory allowlist 或关掉 dev 审计。
- 上游发布真正修复版本后：复用这些回归验证上游，删除本目录、直接 devDependency/overrides 和 Docker 的 vendor COPY，一起更新锁文件。
- 本地补丁不由 npm 漏洞库单独覆盖；必须维护回归、来源哈希和人工 diff，不能把审计通过等同于未知漏洞已消除。
