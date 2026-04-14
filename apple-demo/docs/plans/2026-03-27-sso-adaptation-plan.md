# 以 origin/agent-V2-base 为准的 SSO 适配修改计划

日期：2026-03-27
基线分支：`origin/agent-V2-base`
当前分支：`newui`

## 目标
将当前分支的 SSO 能力恢复到与 `origin/agent-V2-base` 一致或等价的行为，重点关注：
- `apps/web-backend/config.json` 的 SSO 配置完整性
- OAuth / SSO 登录、回调、刷新、登出链路
- 以 `mml_session` 为核心的 cookie 会话策略
- 前端 `apps/web` 对 SSO 模式与 cookie 会话的配合

本计划只产出适配方案，不执行代码修改。

---

## 结论摘要
当前分支并非没有 SSO，而是处于“实现还在、配置收缩、部分行为退化”的状态。与远端基线相比，当前分支存在以下关键差异：

1. `config.json` 未补齐远端依赖的 OAuth 字段，导致 SSO 很难被真正启用。
2. `requireAuth` 中缺少“会话刷新后重新下发 cookie”的逻辑，OAuth refresh 后 cookie 过期时间可能不同步。
3. `oauthClient.fetchUserinfo()` 的请求格式和字段兼容性比远端更窄，可能与原 SSO 提供方不兼容。
4. 前端仍基于 cookie + `credentials: 'include'` 工作，但后端配置和行为没有与之完全对齐。

因此应按“先恢复配置契约，再恢复 cookie 行为，再恢复 provider 兼容性”的顺序处理。

---

## 一、基线行为定义（以远端分支为准）

### 1. 配置层
远端 `apps/web-backend/config.json` 中，SSO 相关配置至少包括：
- `auth.mode`
- `auth.oauth.providerCode`
- `auth.oauth.authorizeUrl`
- `auth.oauth.tokenUrl`
- `auth.oauth.refreshUrl`
- `auth.oauth.userinfoUrl`
- `auth.oauth.logoutUrl`
- `auth.oauth.logoutRedirectUrl`
- `auth.oauth.clientId`
- `auth.oauth.clientSecret`
- `auth.oauth.redirectUri`
- `auth.oauth.scope`
- `auth.oauth.tokenEncryptionKey`
- `auth.oauth.enableLogs`
- `auth.refreshWindowMs`
- `auth.sameOriginProtection.allowedOrigins`

远端的设计是：
- SSO 能否启用由完整配置驱动
- 刷新 token、登出跳转、token 加密都依赖显式配置
- 缺配置时要尽早失败，而不是静默降级

### 2. Cookie / Session 层
远端 `mml_session` cookie 的关键行为：
- `httpOnly: true`
- 同站默认 `sameSite=lax`
- 跨站时自动切为 `sameSite=none` 且 `secure=true`
- OAuth session 被刷新时，`requireAuth` 会重新写入 cookie，使浏览器端 cookie 生命周期与后端 session 过期时间一致

### 3. 前端层
远端前端对 SSO 的前提：
- 所有 auth API 使用 `credentials: 'include'`
- 登录成功后依赖浏览器 cookie 保持会话
- OAuth callback 成功后，前端不自行持久化 token，而是继续用 cookie 调 `/me`

---

## 二、已确认的当前差异

### A. 配置差异
当前 [apps/web-backend/config.json](D:/AI%20MML/apple-demo/apps/web-backend/config.json) 只保留了部分 OAuth 字段，缺失：
- `auth.oauth.refreshUrl`
- `auth.oauth.logoutUrl`
- `auth.oauth.logoutRedirectUrl`
- `auth.oauth.tokenEncryptionKey`
- `auth.oauth.enableLogs`
- `auth.refreshWindowMs`
- `auth.bootstrapLocalAdmin`

而当前代码仍在使用这些字段：
- [index.ts](D:/AI%20MML/apple-demo/apps/web-backend/src/config/index.ts)
- [auth.config.ts](D:/AI%20MML/apple-demo/apps/web-backend/src/config/auth.config.ts)
- [oauthTokenCipher.ts](D:/AI%20MML/apple-demo/apps/web-backend/src/services/auth/oauthTokenCipher.ts)
- [oauthClient.ts](D:/AI%20MML/apple-demo/apps/web-backend/src/services/auth/oauthClient.ts)

直接结果：
- OAuth refresh 逻辑有实现但缺配置
- OAuth logout 逻辑有实现但缺配置
- refresh token 加密有实现但缺 key
- `auth.mode=local_only` 使当前默认仍走本地登录

### B. Cookie 差异
当前 [sessionCookie.ts](D:/AI%20MML/apple-demo/apps/web-backend/src/services/auth/sessionCookie.ts) 与远端接近，但 [auth.ts](D:/AI%20MML/apple-demo/apps/web-backend/src/middlewares/auth.ts) 少了远端这段关键行为：
- 当 `authService.wasSessionRefreshed(req.auth)` 为真时，重新调用 `setSessionCookie()` 更新 cookie

这意味着：
- 后端 OAuth session 已刷新
- 但浏览器 cookie 仍可能保留旧 maxAge
- 用户在接近 session 边界时可能出现前后端状态不一致

### C. Provider 兼容差异
当前 [oauthClient.ts](D:/AI%20MML/apple-demo/apps/web-backend/src/services/auth/oauthClient.ts) 中：
- `fetchUserinfo()` 使用 Bearer GET
- 字段提取较窄，只偏向 `uuid / login_name / display_name`

远端基线则：
- `fetchUserinfo()` 使用表单 POST
- 传 `client_id / access_token / scope`
- 字段兼容 `sub / id / user_id / username / account / nickname / picture / phone_number` 等多种返回格式

这会造成：
- 旧 SSO provider 若依赖远端约定，当前分支可能无法正确取回 userinfo

### D. Auth mode 语义差异
远端基线的 auth mode 是二值：
- `local`
- `oauth`

当前分支扩展成：
- `local_only`
- `oauth_preferred`
- `oauth_only`

这不一定是坏事，但会影响“以远端为准”的适配策略：
- 如果目标是完全回归远端行为，应收敛语义
- 如果保留当前三态，就必须保证它们在配置校验、前端跳转、cookie 会话上完全闭环

---

## 三、适配策略

建议采用“兼容远端能力，但不强制回退所有当前扩展”的方案。

### 决策 1：以远端配置契约为最低基线
即使保留当前三态 auth mode，也必须让以下配置成为完整有效的 OAuth 配置：
- `authorizeUrl`
- `tokenUrl`
- `refreshUrl`
- `userinfoUrl`
- `logoutUrl`
- `logoutRedirectUrl`
- `clientId`
- `clientSecret`
- `redirectUri`
- `tokenEncryptionKey`

### 决策 2：cookie 行为直接对齐远端
`mml_session` 的 cookie 策略应直接与远端对齐：
- 保留现有 `sameSite` 自适应逻辑
- 在 `requireAuth` 里补回 session refresh 后的 `setSessionCookie()`

### 决策 3：userinfo provider 兼容逻辑回归远端
`oauthClient.fetchUserinfo()` 应恢复远端兼容实现，至少支持：
- 表单 POST 模式
- 多字段名回退解析

### 决策 4：前端继续使用 cookie，不引入本地 token 存储
保持当前前端模式：
- 全部认证请求 `credentials: 'include'`
- 不在 `localStorage/sessionStorage` 存 access token
- 只用 callback + `/me` 驱动登录态

---

## 四、具体修改计划

### 工作流 A：补齐 SSO 配置契约
目标：让当前配置文件具备远端 SSO 的全部驱动字段。

涉及文件：
- `apps/web-backend/config.json`
- `apps/web-backend/src/config/index.ts`
- `apps/web-backend/src/config/auth.config.ts`
- `apps/web-backend/README.md`

动作：
1. 在 `config.json` 中补齐缺失字段：
   - `auth.refreshWindowMs`
   - `auth.bootstrapLocalAdmin`
   - `auth.oauth.refreshUrl`
   - `auth.oauth.logoutUrl`
   - `auth.oauth.logoutRedirectUrl`
   - `auth.oauth.tokenEncryptionKey`
   - `auth.oauth.enableLogs`
2. 明确 `redirectUri` 的推荐值应指向后端 callback，例如：
   - `http://localhost:3200/web/api/auth/callback`
   而不是前端首页。
3. 文档中给出本地开发和 Nginx 反代两套配置示例。
4. 配置加载逻辑增加“缺关键 OAuth 字段时的显式报错或显式禁用说明”。

验收：
- 启用 OAuth 时不会因缺 `refreshUrl`、`tokenEncryptionKey` 等字段而在运行时晚失败。
- 配置项和代码使用项一一对齐。

### 工作流 B：恢复 cookie 续期闭环
目标：保证 session refresh 后浏览器 cookie 生命周期同步更新。

涉及文件：
- `apps/web-backend/src/middlewares/auth.ts`
- `apps/web-backend/src/services/authService.ts`
- `apps/web-backend/src/services/auth/sessionCookie.ts`

动作：
1. 在 `requireAuth()` 中对齐远端逻辑：
   - 成功鉴权后，如果 `authService.wasSessionRefreshed(req.auth)` 为真
   - 立即重新设置 `mml_session` cookie
2. 保持现有 `sameSite=lax/none` + `secure` 自适应策略，不回退。
3. 补单测覆盖：
   - 同站请求刷新 session 后 cookie 被重写
   - 反向代理 HTTPS 场景下 cookie `secure=true`
   - 跨站登录场景下 `sameSite=none`

验收：
- session refresh 后响应包含新的 `Set-Cookie`
- 浏览器端 cookie 过期时间与后端 session 对齐

### 工作流 C：恢复 provider 兼容性
目标：让当前分支兼容远端原本对接过的 SSO provider。

涉及文件：
- `apps/web-backend/src/services/auth/oauthClient.ts`
- `apps/web-backend/src/services/authService.ts`
- `apps/web-backend/src/controllers/authController.ts`
- `apps/web-backend/src/types/user.ts`
- 相关测试文件

动作：
1. 将 `fetchUserinfo()` 恢复为远端兼容实现：
   - 优先采用远端的表单 POST 模式
   - 请求体含 `client_id / access_token / scope`
2. 恢复远端的多字段读取逻辑：
   - UUID 候选：`uuid/sub/id/user_id/userId/userid/uid`
   - 登录名候选：`login_name/preferred_username/username/account/user_name`
   - 显示名候选：`display_name/name/displayName/nickname/nick_name`
   - 头像候选：`avatar_url/avatar/picture`
   - 手机候选：`phone/mobile/phone_number`
3. 保留现有日志脱敏能力，但以远端请求协议为准。
4. 明确 `redirectUri` 必须按远端约定指向后端 callback：
   - `http://<web-backend-host>/web/api/auth/callback`
   - 不再使用前端页面地址作为 OAuth callback
5. 校验 `buildOAuthAuthorizeUrl()`、`exchangeCodeForTokens()`、`refreshTokens()`、`buildOAuthLogoutUrl()` 的参数名与远端一致：
   - authorize: `response_type/client_id/redirect_uri/scope/state`
   - token exchange: `grant_type/code/client_id/client_secret/redirect_uri`
   - refresh: `grant_type/refresh_token/client_id/client_secret`
   - logout: `clientId/redirect`
6. 若当前 `OAuthUserinfo` 类型约束不足，补齐类型注释与字段说明，明确哪些字段由 provider 原样回传、哪些字段为兼容映射结果。

验收：
- 远端已有 SSO provider mock 测试能在当前分支通过
- userinfo 返回字段稍有差异时仍能正确绑定 identity

#### 工作流 C 的明确改动清单
基于“上游 provider 的参数名和调用方式就是按远端约定”的前提，本次不做兼容路线评估，直接按远端契约修改：

1. `apps/web-backend/src/services/auth/oauthClient.ts`
   - 恢复 `readStringField()` 辅助函数
   - 将 `fetchUserinfo()` 改回表单 `POST`
   - 请求体固定为：`client_id`、`access_token`、`scope`
   - 恢复远端的多字段映射规则
   - 保留日志脱敏，但以远端的 request/response 记录格式为准

2. `apps/web-backend/config.json`
   - 将 `auth.oauth.redirectUri` 改为后端 callback 地址
   - 补齐 `refreshUrl`、`logoutUrl`、`logoutRedirectUrl`、`tokenEncryptionKey`、`enableLogs`

3. `apps/web-backend/src/config/index.ts`
   - 对齐远端对 OAuth 必填字段的约束
   - 至少在 OAuth 启用态下要求：`authorizeUrl/tokenUrl/refreshUrl/userinfoUrl/logoutUrl/logoutRedirectUrl/clientId/clientSecret/redirectUri/tokenEncryptionKey`

4. `apps/web-backend/src/services/authService.ts`
   - 确认 `completeOAuthLogin()` 继续依赖 `userinfo.uuid`
   - 若 `userinfo.uuid` 为空，保留显式失败，不做静默兜底
   - 确认 logout 仍按上游 logout URL 返回 `redirectUrl`

5. `apps/web-backend/tests/auth.routes.test.ts`
   - 补或恢复以下断言：
   - `GET /web/api/auth/login-url` 返回基于后端 callback 的 stateful URL
   - callback 后能根据远端格式的 userinfo 正确创建或绑定用户
   - logout 返回远端格式的 upstream logout redirect
   - refresh token 场景下，使用远端 refresh 参数名

6. 如有需要，补充集成测试或 mock：
   - provider userinfo 返回 `sub`
   - provider userinfo 返回 `username`
   - provider userinfo 返回 `nickname/picture`
   目标是确保当前分支重新兼容远端原先接入过的 provider 返回格式。

### 工作流 D：梳理 auth mode 与前端行为
目标：确保三态 auth mode 不破坏远端基线行为。

涉及文件：
- `apps/web-backend/src/config/index.ts`
- `apps/web-backend/src/config/auth.config.ts`
- `apps/web-backend/src/services/authService.ts`
- `apps/web/src/stores/authStore.ts`
- `apps/web/src/api/types.ts`

动作：
1. 明确三态定义：
   - `local_only`: 仅本地
   - `oauth_only`: 仅 SSO
   - `oauth_preferred`: 默认跳 SSO，但允许本地兜底
2. 保证 `oauth_only` 下：
   - local login 被严格禁止
   - logout 若存在上游登出配置则返回 `redirectUrl`
3. 保证 `oauth_preferred` 下：
   - 当前前端自动跳 SSO 的逻辑保留
   - 但其可用性以完整 OAuth 配置为前提
4. 如果产品不需要三态，评估是否直接收敛到远端的 `local/oauth` 双态。

验收：
- 前端页面在三种模式下的显示和跳转与后端能力一致
- 不出现“前端显示可 SSO，后端因缺配置实际禁用”的错位状态

### 工作流 E：补文档与示例配置
目标：让后续部署人员能直接按文档配通 SSO。

涉及文件：
- `apps/web-backend/README.md`
- `README.md`
- 可选：`doc/工程化迁移计划.md` 后续引用

动作：
1. 明确 cookie 会话机制：使用 `mml_session`，依赖 `credentials: include`
2. 明确 callback 入口必须是后端 `/web/api/auth/callback`
3. 给出开发态与反向代理态的 `auth.oauth` 配置模板
4. 明确 `allowedOrigins`、`logoutRedirectUrl`、`tokenEncryptionKey` 的配置要求

---

## 五、验证计划

### 核心回归用例
1. `local_only` 模式：
   - 本地登录成功
   - cookie 正常下发
   - `/me` 可读当前用户

2. `oauth_only` 模式：
   - `/auth/login-url` 返回成功
   - callback 成功后下发 `mml_session`
   - `/auth/logout` 返回上游登出地址
   - cookie 被清除

3. `oauth_preferred` 模式：
   - 前端初始化自动跳 SSO
   - callback 后前端直接进入已登录态

4. OAuth refresh：
   - 当 access token 临近过期时触发 refresh
   - 响应重新下发 cookie
   - 刷新后 `/me` 仍可访问

5. Cross-origin / proxy 场景：
   - `sameSite=none` + `secure=true` 行为正确
   - `sameOriginProtection.allowedOrigins` 命中时不拦截

### 建议执行的测试文件
- `apps/web-backend/tests/auth.routes.test.ts`
- `apps/web-backend/tests/user.role.routes.test.ts`
- 新增或补强：cookie refresh / sameSite / secure 场景测试
- `apps/web/src/stores/authStore.test.ts`

---

## 六、实施顺序

### 第一阶段：配置对齐
先补 `config.json`、配置类型和 README，避免运行时暗坑。
其中 `redirectUri` 直接改为后端 callback，不再保留前端首页回调写法。

### 第二阶段：cookie 续期修复
补回 `requireAuth` 的 cookie 重写逻辑，保证 session refresh 闭环。

### 第三阶段：provider 兼容修复
将 `fetchUserinfo()`、userinfo 字段映射、token/refresh/logout 参数名全部恢复为远端兼容版本，并补测试。

### 第四阶段：前端与模式回归
验证 `oauth_only / oauth_preferred / local_only` 与 cookie 行为一致。

---

## 七、最小必做项
若本次只做最小恢复，必须至少完成：
1. 补齐 `config.json` 缺失的 OAuth 字段
2. 修复 `requireAuth` 中 session refresh 后不重写 cookie 的问题
3. 将 `fetchUserinfo()` 恢复为远端兼容模式

如果这三项不做全，当前分支的 SSO 很难达到远端可用水平。

---

## 最终建议
本次适配不要只盯 `config.json`。正确顺序应是：
- 先补配置
- 再补 cookie 续期
- 再恢复 provider 兼容
- 最后做前端模式回归

其中“cookie 续期补回”是最容易被忽略、但实际影响登录稳定性的关键点。
