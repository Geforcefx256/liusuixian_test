## 1. Dependency Baseline Alignment

- [x] 1.1 盘点 `apps/web`、`apps/web-backend`、`apps/agent-backend` 与源仓库重叠的三方件，并将版本统一到 `/Users/derrick92/Documents/code/codex/apple-demo` 基线
- [x] 1.2 更新当前仓库相关 package manifest 与 lockfile，确保共享依赖不再保留分叉版本
- [x] 1.3 运行依赖安装与基础构建检查，确认版本对齐后的工程仍可完成安装与编译

## 2. Web SSO Backend Parity

- [x] 2.1 对齐 `apps/web-backend` 的 OAuth 配置模型，补齐源仓库中的 refresh、logout、token cipher 与相关配置语义
- [x] 2.2 对齐 OAuth state、callback、identity binding、最小 userinfo 兼容和首次建号流程
- [x] 2.3 对齐 session cookie 策略，修复跨端口 same-site 登录行为并保持同源场景兼容
- [x] 2.4 对齐 same-origin 保护逻辑，补齐 wildcard allowlist 语义并覆盖 web-backend 路由
- [x] 2.5 对齐 OAuth-backed session 的 refresh、explicit failure 和 upstream logout 行为

## 3. Frontend Auth Flow Parity

- [x] 3.1 对齐 `apps/web` 的 auth mode、login-url、callback 和 workbench entry 行为，使其遵循 backend-governed SSO 契约
- [x] 3.2 对齐前端 logout 处理，使其兼容 backend 返回的 source-baseline logout completion 语义
- [x] 3.3 补齐或更新前端认证相关测试，覆盖 local-only、OAuth-preferred、OAuth-only 和 logout 行为

## 4. Agent Runtime And huaweiHisApi Parity

- [x] 4.1 对齐 `apps/agent-backend` 的 same-origin allowlist 语义，使其支持源仓库的 wildcard origin 匹配
- [x] 4.2 对齐 `apps/agent-backend` 的 model registry、`activeModel` 解析和 runtime metadata 语义，使其与源仓库一致
- [x] 4.3 将 `huaweiHisApi` 作为完整 provider 基线迁入当前配置与运行时，包括 registry 命名、headers/body、timeout 与默认模型行为
- [x] 4.4 补齐 `providerClient`、`ConfigLoader`、`modelRegistry` 相关测试，使其覆盖源仓库的 `huaweiHisApi` 行为和活动模型语义

## 5. Validation And Regression Checks

- [x] 5.1 运行 `apps/web-backend`、`apps/web`、`apps/agent-backend` 的类型检查与相关单元测试
- [x] 5.2 进行一次端到端联调验证，确认登录、回调、会话恢复、登出和 agent 认证链路符合源仓库语义
- [x] 5.3 复核 OpenSpec change 与实际实现结果，确保 SSO、`huaweiHisApi` 和共享依赖版本三条基线都已收敛
