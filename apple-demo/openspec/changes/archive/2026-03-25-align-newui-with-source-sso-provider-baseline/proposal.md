## Why

当前 `newui` 分支已经形成了自己的 Web workbench、认证后端和 agent runtime，但它与 `/Users/derrick92/Documents/code/codex/apple-demo` 在三条关键基线上已经出现语义分叉：SSO 仍未完整追平、`huaweiHisApi` LLM provider 只完成了部分迁移、共享三方件版本也不再一致。继续在这个分叉状态上迭代，会让认证行为、模型选择和运行时依赖长期处于“看起来能跑、实际不对齐”的状态。

## What Changes

- 以 `/Users/derrick92/Documents/code/codex/apple-demo` 为真值基线，对 `newui` 分支的 SSO 能力做完整对齐，而不是只选择性迁移 `SameSite`、wildcard allowlist 等局部补丁。
- 将源仓库中的 SSO 新特性完整纳入当前主线，包括 OAuth mode 语义、state 持久化与消费、identity binding、session cookie 行为、same-origin/wildcard allowlist、最小 userinfo 兼容、OAuth refresh 与 upstream logout 等。
- 完整参考源仓库中的 `huaweiHisApi` provider 能力，除了保留现有 transport/header/body 支持外，还要求对齐配置命名、活动模型解析语义、默认配置基线和对应测试语义。
- 对 `newui` 与源仓库使用到的同名三方件执行版本统一，以源仓库版本为准，避免 `vue`、`zod`、`typescript`、`vitest` 等基础依赖继续分叉。
- 保持当前 `newui` 的 UI 基线和现有目录结构，不做整仓结构回退；本次变更是按能力和契约对齐源仓库，而不是直接回退到源仓库实现。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-auth`: 将当前 `newui` 的认证要求升级为必须追平源仓库中的完整 SSO 特性集，而不是仅保持最小登录闭环。
- `web-auth-session-governance`: 扩展 session 与 OAuth 生命周期要求，覆盖 wildcard origin allowlist、跨端口 cookie same-site 行为、OAuth refresh、upstream logout 与相关配置语义。
- `web-auth-identity-binding`: 扩展 OAuth 回调与用户绑定规则，要求与源仓库中的最小 userinfo 兼容、身份落库和冲突处理语义保持一致。
- `agent-backend-runtime`: 扩展 runtime 模型与依赖基线要求，规定 `huaweiHisApi` provider、active model 解析语义和共享三方件版本需要与源仓库对齐。

## Impact

- Affected code:
  - `apps/web-backend/**`
  - `apps/web/**`
  - `apps/agent-backend/**`
  - root/app package manifests and lockfiles used by shared dependencies
- Affected APIs:
  - `/web/api/auth/mode`
  - `/web/api/auth/login-url`
  - `/web/api/auth/callback`
  - `/web/api/auth/me`
  - `/web/api/auth/logout`
  - `/agent/api/runtime/bootstrap`
  - `/agent/api/agent/*`
- Affected systems:
  - Web SSO and session governance
  - OAuth identity binding
  - Agent model registry and provider execution
  - Shared dependency baseline across web/web-backend/agent-backend
