## Why

当前 `apps/web` 已经切到新的 Vue 工作台，但认证流仍然依赖 `localhost:3200` 的 `/web/api/auth/*`。主工程下没有运行中的 `web-backend`，导致前端通过 Vite 代理访问认证接口时直接报 `500`，`apps/agent-backend` 的当前用户反查链路也缺少主线依赖。

## What Changes

- 在 `apps/` 下新增最小认证后端 `apps/web-backend`，默认监听 `localhost:3200`。
- 迁移本地账号认证闭环，包括用户/角色/会话 SQLite 初始化、登录、当前用户、登出和改密。
- 保持 `/web/api/auth/*`、Cookie 会话和 `3200` 端口约定兼容，确保 `apps/web` 与 `apps/agent-backend` 无需改动即可联调。
- 为 `apps/web` 增加显式 favicon 资源，消除浏览器 `404` 噪音。

## Capabilities

### New Capabilities
- `agent-web-backend-auth`: 定义主线认证后端的本地登录、会话查询和登出行为。

### Modified Capabilities
- `agent-web-auth`: 从“依赖外部参考后端”调整为“依赖主线内置认证后端”。

## Impact

- Affected code: `apps/web-backend/**`, `apps/web/index.html`, `apps/web/public/**`, `.gitignore`
- Affected APIs: `/web/api/auth/mode`, `/web/api/auth/login`, `/web/api/auth/me`, `/web/api/auth/logout`, `/web/api/auth/change-password`
- Affected integrations: `apps/web` 的 Vite 代理、`apps/agent-backend` 的 `/web/api/auth/me` 反查链路
