## 1. Vendored Ripgrep Assets

- [x] 1.1 新增 `apps/agent-backend/scripts/download-ripgrep.*`，下载并解压 `ripgrep 15.1.0` 的 Linux、Windows 和 macOS 目标二进制到 `apps/agent-backend/assets/vendor/ripgrep/`
- [x] 1.2 确认 `apps/agent-backend` 的源码模式与 dist 模式都能解析 vendored `ripgrep` 资产路径，并补充对应测试

## 2. Local Grep Runtime

- [x] 2.1 将本地内容搜索工具从 `local:search_in_files` 重构为 `local:grep`，更新 provider manifest、输入 schema、配置映射和工具暴露策略
- [x] 2.2 实现 vendored `rg` 的运行时 target 解析与执行逻辑，覆盖 Linux `platform + arch + libc` 以及 Windows/macOS `platform + arch`
- [x] 2.3 移除 `search_in_files` 的兼容入口与 Node fallback，保证 `rg` 缺失或执行失败时显式报错
- [x] 2.4 保持 `local:grep` 只允许在当前工作区内搜索，并对越界路径返回明确错误

## 3. Logging And Diagnostics

- [x] 3.1 在 `localProvider` 保留统一工具调用日志的同时，为 `local:grep` 增加 `rg` 选择、版本校验、执行结果和失败细节日志
- [x] 3.2 确保日志与工具错误严格区分“无匹配结果”和“执行失败”，并在失败时输出 target、`rg` 路径、exit code 或 signal、stderr 等诊断字段

## 4. Validation

- [x] 4.1 更新受影响的单元测试与默认工具配置测试，覆盖 `local:grep` 替换、planner/executor 可见性和 workspace 限制
- [x] 4.2 验证构建产物包含 vendored `ripgrep`，并通过类型检查、相关测试和必要的 dist 验证确认行为符合 spec
