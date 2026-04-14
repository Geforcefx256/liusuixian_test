# web-backend

认证后端和 MML schema 服务。`apps/web` 与 `apps/agent-backend` 都依赖它。

## 推荐用法

在仓库根目录执行：

```bash
pnpm dev:web-backend
pnpm --filter @apple-demo/web-backend build
pnpm --filter @apple-demo/web-backend test
pnpm --filter @apple-demo/web-backend type-check
```

默认监听：

```text
http://127.0.0.1:3200
```

## 主要职责

- 提供 `/web/api/auth/*`
- 提供 `/web/api/users`、`/web/api/roles`
- 提供 `/web/api/mml/schema`
- 管理本地认证与 OAuth 登录配置
- 作为 MML rules 的唯一 owner

## 认证模式

配置文件为 [config.json](/D:/AI%20MML/apple-demo/apps/web-backend/config.json)。

`auth.mode` 支持：

- `local`
- `oauth`

当 `auth.mode=oauth` 时，至少需要完整配置以下字段：

- `auth.oauth.authorizeUrl`
- `auth.oauth.tokenUrl`
- `auth.oauth.refreshUrl`
- `auth.oauth.userinfoUrl`
- `auth.oauth.logoutUrl`
- `auth.oauth.logoutRedirectUrl`
- `auth.oauth.clientId`
- `auth.oauth.clientSecret`
- `auth.oauth.redirectUri`
- `auth.oauth.tokenEncryptionKey`

## 默认本地账号

- 用户名：`admin`
- 密码：`Admin@123456`

本地模式使用固定默认密码，当前产品不提供自助修改密码功能。

## MML rules

MML rule 配置也在 [config.json](/D:/AI%20MML/apple-demo/apps/web-backend/config.json) 中：

- `sourceDir`: `./data/mml-rules`
- `dbPath`: `./data/mml-rules.db`

浏览器侧和其他服务都应直接使用 `/web/api/mml/schema`，不再依赖 `agent-backend` 的兼容代理。

## 快速自检

```bash
curl http://127.0.0.1:3200/web/api/auth/mode
```

登录后也可以验证 schema 路由：

```bash
curl -b "mml_session=<session-cookie>" "http://127.0.0.1:3200/web/api/mml/schema?networkType=UNC&networkVersion=20.11.2"
```
