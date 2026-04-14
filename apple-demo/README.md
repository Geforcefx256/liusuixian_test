# apple-demo

统一的 pnpm workspace 工程，当前由 3 个应用和 1 个共享包组成：

- `apps/web`：Vue 前端，默认 `http://localhost:5175`
- `apps/web-backend`：认证与 MML schema 后端，默认 `http://localhost:3200`
- `apps/agent-backend`：智能体运行时后端，默认 `http://localhost:3100`
- `packages/shared`：跨端共享类型与协议定义

## 目录结构

```text
apps/
  web/
  web-backend/
  agent-backend/
packages/
  shared/
scripts/
docs/
openspec/
```

## 快速开始

先在仓库根目录安装依赖：

```bash
pnpm install
```

分别启动推荐顺序如下：

```bash
pnpm dev:web-backend
pnpm dev:agent-backend
pnpm dev:web
```

也可以直接从根目录并行启动：

```bash
pnpm dev:all
```

## 常用命令

全部在仓库根目录执行：

```bash
pnpm type-check
pnpm test
pnpm build
pnpm build:all
pnpm clean
pnpm clean:all
pnpm reinstall
```

按应用执行：

```bash
pnpm dev:web
pnpm dev:web-backend
pnpm dev:agent-backend

pnpm build:web
pnpm build:web-backend
pnpm build:agent-backend
pnpm build:all
```

## 服务关系

- `apps/web` 通过 Vite 代理访问：
  - `/web/api/* -> http://127.0.0.1:3200`
  - `/agent/api/* -> http://127.0.0.1:3100`
- `apps/agent-backend` 的 `auth.baseUrl` 默认指向 `http://localhost:3200`
- MML schema 路由由 `apps/web-backend` 统一提供：`/web/api/mml/schema`

## 构建产物

- 各应用原始构建产物仍位于各自目录下的 `dist/`
- 根目录 `dist/` 作为统一归档目录，由 `pnpm build` 或 `pnpm build:all` 自动生成
- 根目录归档结构如下：

```text
dist/
  web/
  web-backend/
  agent-backend/
  manifest.json
```

- `dist/web/` 为静态前端资源，需要由 Nginx、Caddy 或其他静态文件服务托管
- `dist/web-backend/` 为可直接运行的后端产物，Node 22+ 环境下可在该目录执行 `node index.js`
- `dist/agent-backend/` 为可直接运行的后端产物，Node 22+ 环境下可在该目录执行 `node index.js`

## 默认本地账号

- 用户名：`admin`
- 密码：`Admin@123456`

## 运行说明

- `apps/agent-backend/config.json` 的模型流式超时只接受 `streamFirstByteTimeoutMs` 和 `streamIdleTimeoutMs`
- 修改 `apps/agent-backend/config.json` 后需要重启 `apps/agent-backend`
- `apps/agent-backend` 默认禁用 `local:bash`
- `apps/agent-backend/workspace` 和各服务的 `data/` 都属于运行时目录，不应提交本地生成状态
- 部署到服务器时，建议将 `apps/agent-backend/config.json` 外置，并通过 `memory.dbPath`、`runtime.fileLogging.directory`、`runtime.workspaceDir`、`runtime.managedSkills.registryPath`、`runtime.managedSkills.packagesDir` 显式指定运行时可写目录
- `apps/agent-backend` 上传的 managed skill 不再写入程序包内的 `assets/skills`，而是持久化到 `runtime.managedSkills.packagesDir`
- `apps/agent-backend` 已移除旧的 `input/working/output(s)` 工作区命名兼容；升级前若历史数据里仍有 `uploads/`、`outputs/` 或旧 `workspaceFiles` 元数据，服务会拒绝启动
- 升级到当前版本前，需显式执行 `pnpm --filter @apple-demo/agent-backend run cleanup:legacy-workspace-naming`
- 上述清理会删除受影响 scope 的旧工作区目录、`file-map.json` 和旧 session 工作区元数据；这是一次破坏性升级，历史工作区数据不会保留
- `pnpm clean` 只清理构建产物和 `tsconfig.tsbuildinfo`，不会删除已安装依赖
- `pnpm clean:all` 会额外删除根目录及各子包的 `node_modules`，用于彻底重置本地依赖环境
- `pnpm reinstall` 等价于先执行 `pnpm clean:all`，再执行 `pnpm install`

## 故障排查

如果前端看到 `/web/api/*` 或 `/agent/api/*` 的 `ECONNREFUSED`：

1. 先确认 `apps/web-backend` 是否已启动
2. 再确认 `apps/agent-backend` 是否已启动
3. 最后再检查前端代理配置和本地端口占用

可以先验证认证后端：

```bash
curl http://127.0.0.1:3200/web/api/auth/mode
```

再验证前端代理链路：

```bash
curl http://127.0.0.1:5175/web/api/auth/mode
```

## 工程基线约束

以下约束为当前工程化基线，后续开发和 agent 修改都需要遵守：

1. 根层目录结构已确定，当前基线包括：`apps/`、`packages/`、`scripts/`、`docs/`、`openspec/`。
2. 不得擅自删除、重命名、移动这些既有根层目录，也不得修改它们的层级关系；如确需调整，必须先询问并获得确认。
3. 可以新增目录，但新增目录不能破坏现有根层结构和职责边界。
4. 引入新的第三方依赖，或升级现有第三方依赖到新版本前，必须先确认目标版本是否可用，再修改 `package.json`、`pnpm-lock.yaml` 或相关 overrides。
