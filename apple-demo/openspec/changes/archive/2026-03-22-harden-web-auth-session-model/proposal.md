## Why

`build-vue-agent-workbench-lite` 已经完成了 Vue 工作台和最小认证闭环，但当前认证能力仍停留在 phase-1 水位。现在需要把 auth mode、OAuth 登录事务、session 生命周期和身份绑定边界收敛成稳定模型，避免后续管理员后台、角色治理和多实例部署建立在脆弱假设上。

## What Changes

- 明确定义 Web 认证模式的产品语义与后端行为，区分本地登录可用、OAuth 优先和 OAuth 独占等模式边界。
- 收敛 OAuth 登录启动与回调校验模型，定义 `state` 的生成、持久化、过期与单次消费规则。
- 定义 session 生命周期治理规则，覆盖登录创建、过期、主动登出、密码修改后的失效、用户禁用后的失效以及并发 session 管理。
- 明确首次 OAuth 登录的身份绑定策略，约束自动建号、已有账号冲突和默认角色赋予的处理行为。
- 调整前端 auth 状态契约，使登录入口、错误态和模式切换行为与后端语义保持一致。

## Capabilities

### New Capabilities
- `web-auth-session-governance`: 定义认证模式、OAuth 登录事务和 session 生命周期治理规则。
- `web-auth-identity-binding`: 定义 OAuth 身份与本地用户之间的绑定、建号与冲突处理规则。

### Modified Capabilities
- None.

## Impact

- Affected code: `apps/web-backend/**` 中的 auth config、OAuth 登录流、session 存储与校验、用户身份绑定逻辑。
- Affected frontend: `apps/web/**` 中的 auth store、登录入口、模式展示、错误态和登出后的重新初始化逻辑。
- Affected APIs: `/web/api/auth/mode`, `/web/api/auth/login`, `/web/api/auth/login-url`, `/web/api/auth/callback`, `/web/api/auth/me`, `/web/api/auth/logout`。
- Affected systems: 开发环境默认管理员策略、部署拓扑对重启与多实例的假设、后续管理员后台的用户治理基础。
