## Context

当前仓库的主线已经有：

- `apps/web`：新的 Vue 智能体工作台，默认把 `/web/api` 代理到 `http://localhost:3200`
- `apps/agent-backend`：新的智能体后端，默认也把认证基地址指向 `http://localhost:3200`

缺失的是：

- 主线内部没有认证后端服务
- 本地开发时只启动前端和 agent-backend，会让 `/web/api/auth/*` 直接失败

## Goals / Non-Goals

**Goals**
- 提供主线内的最小认证后端，恢复前端登录联调能力
- 保持现有认证接口和端口约定兼容
- 提供默认本地管理员账号，保证服务启动后可立即验证

**Non-Goals**
- 不迁移模板库、上传解析、配置管理或用户管理后台 API
- 不在本次变更中重新设计认证模型或切换到 token-only 方案
- 不在本次变更中要求完整 OAuth 联调

## Decisions

### 1. 单独新增 `apps/web-backend`

不把认证逻辑塞进 `apps/agent-backend`，避免混淆职责。认证仍保持独立服务，复用 `3200` 端口约定。

### 2. 只迁认证最小闭环

迁移用户/角色/身份/会话相关 SQLite 表、密码哈希、session cookie、同源防护和 auth 路由。其余能力全部延后。

### 3. 保持接口兼容

继续使用 `/web/api/auth/*` 和 `mml_session` cookie；`apps/web` 与 `apps/agent-backend` 不做契约级调整。

### 4. 默认使用本地账号模式

配置默认 `auth.mode=local`，自动初始化 `admin` 种子用户，优先恢复可用性。OAuth 相关接口保留兼容实现，但不作为首期联调主路径。

## Risks / Trade-offs

- 认证服务单独维护一份 SQLite 逻辑，会有一定重复代码，但能最小化改动面。
- 默认管理员账号适合开发环境，不适合直接作为生产初始化策略。
- OAuth 仅保留兼容壳，后续如果要正式启用还需要补充外部配置验证。
