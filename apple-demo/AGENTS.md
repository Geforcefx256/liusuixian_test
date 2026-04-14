# AGENTS.md

本文件定义代码代理在此仓库中的工作方式、工程约束和项目基线。除非用户明确说明，否则默认将本文件视为代理执行规范。

## 工程基线

当前顶层目录结构属于工程基线：

```text
apps/
packages/
scripts/
docs/
openspec/
```

执行规则：

- 不得删除、重命名或移动上述任何现有顶层目录。
- 不得修改现有顶层目录的层级关系。
- 如确需调整现有顶层目录，必须先询问并获得确认。
- 可以新增目录，但不得破坏现有根层结构和职责边界。

## 依赖治理

引入新的第三方依赖，或升级现有第三方依赖版本前，必须先确认目标版本是否可用，再修改以下任一内容：

- `package.json`
- workspace 级 overrides
- `pnpm-lock.yaml`

不得在未确认版本可用的情况下直接变更依赖声明或 lockfile。

## 工作约定

- 将 `README.md` 视为项目公开基线文档。
- 将本文件视为代理工作约束文档。
- 如果用户请求与本文件或 `README.md` 中的治理规则冲突，应先停止并询问。
- 修改配置或代码时，优先保持现有目录职责边界和服务拆分方式不变。

## 项目概览

该仓库是一个统一的 pnpm workspace，目前包含 3 个应用和 1 个共享包：

| 路径 | 说明 | 默认端口 |
|------|------|----------|
| `apps/web` | Vue 3 前端 | `5175` |
| `apps/web-backend` | 认证与 MML schema 后端 | `3200` |
| `apps/agent-backend` | 智能体运行时后端 | `3100` |
| `packages/shared` | 跨端共享类型与协议定义 | - |

## 服务关系

- `apps/web` 通过 Vite 代理访问后端。
- `/web/api/*` 默认转发到 `http://127.0.0.1:3200`
- `/agent/api/*` 默认转发到 `http://127.0.0.1:3100`
- `apps/agent-backend` 的 `auth.baseUrl` 默认指向 `http://localhost:3200`
- MML schema 由 `apps/web-backend` 统一提供，路由为 `/web/api/mml/schema`

## 构建产物

- 各应用继续在自身目录下输出原始 `dist/`
- 根目录 `dist/` 是统一归档目录，构建后会自动汇总三个应用的产物
- 归档目录结构如下：

```text
dist/
  web/
  web-backend/
  agent-backend/
  manifest.json
```

- `dist/web/` 仅包含静态前端资源，不可用 `node index.js` 直接启动
- `dist/web-backend/` 与 `dist/agent-backend/` 为 Node 22+ 可直接运行产物，可在目录内执行 `node index.js`

## 常用命令

以下命令均在仓库根目录执行：

```bash
pnpm install
pnpm dev:web-backend
pnpm dev:agent-backend
pnpm dev:web
pnpm dev:all
pnpm type-check
pnpm test
pnpm build
pnpm build:all
pnpm clean
pnpm clean:all
pnpm reinstall
```

## 关键配置

- `apps/agent-backend/config.json`：模型配置、运行时参数、工具禁用列表
- `apps/web-backend/config.json`：认证模式、数据库路径、MML 规则配置

## 运行时注意事项

- 修改 `apps/agent-backend/config.json` 后需要重启 `apps/agent-backend`
- `apps/agent-backend/config.json` 中模型流式超时仅接受 `streamFirstByteTimeoutMs` 和 `streamIdleTimeoutMs`
- `apps/agent-backend` 默认禁用 `local:bash`
- `apps/agent-backend/workspace` 与各服务 `data/` 目录属于运行时生成目录，不应提交本地状态
- `pnpm clean` 仅清理构建产物和 `tsconfig.tsbuildinfo`，不删除依赖目录
- `pnpm clean:all` 会额外删除根目录及各工作区包下的 `node_modules`
- `pnpm reinstall` 用于彻底清理后重新安装依赖

## 默认本地账号

- 用户名：`admin`
- 密码：`Admin@123456`

## 故障排查

如果前端出现 `/web/api/*` 或 `/agent/api/*` 的 `ECONNREFUSED`：

1. 先确认 `apps/web-backend` 是否已启动。
2. 再确认 `apps/agent-backend` 是否已启动。
3. 最后检查前端代理配置和本地端口占用。

可使用以下方式做快速验证：

```bash
curl http://127.0.0.1:3200/web/api/auth/mode
curl http://127.0.0.1:5175/web/api/auth/mode
```
