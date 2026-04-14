# CLAUDE.md

本文件定义了代码代理在此仓库工作时的约束条件。

## 工程基线

当前顶层项目结构为工程基线：

```text
apps/
packages/
scripts/
docs/
openspec/
```

规则：

- 不得删除、重命名或移动上述任何现有顶层目录。
- 不得修改现有顶层目录的层级关系。
- 如确需调整现有顶层目录，必须先询问并获得确认。
- 可以新增目录，但不得破坏现有根层结构和职责边界。

## 依赖版本治理

引入新的第三方依赖，或升级现有第三方依赖到新版本时：

- 必须先确认目标版本是否可用。
- 不得自行选择未确认的依赖版本。
- 此规则适用于依赖声明、workspace 级别覆盖和 lockfile 变更。

## 工作约定

- 将 `README.md` 视为项目公开基线文档。
- 将本文件视为代理执行约束文档。
- 如请求的实现与上述两条治理规则冲突，请先停止并询问。

## 常用命令

在仓库根目录执行：

```bash
pnpm install                    # 安装依赖
pnpm dev:web-backend            # 启动认证后端 (端口 3200)
pnpm dev:agent-backend          # 启动智能体后端 (端口 3100)
pnpm dev:web                    # 启动前端 (端口 5175)
pnpm dev:all                    # 并行启动全部服务
pnpm type-check                 # 类型检查
pnpm test                       # 运行测试
pnpm build                      # 构建所有应用
pnpm build:all                  # 构建所有应用
pnpm clean                      # 清理构建产物
pnpm clean:all                  # 清理构建产物并删除 node_modules
pnpm reinstall                  # 彻底清理后重新安装依赖
```

## 项目架构

pnpm workspace 工程，由 3 个应用和 1 个共享包组成：

| 应用 | 描述 | 默认端口 |
|------|------|----------|
| `apps/web` | Vue 3 前端 (Vite + Pinia + Monaco Editor) | 5175 |
| `apps/web-backend` | 认证与 MML schema 后端 (Express) | 3200 |
| `apps/agent-backend` | 智能体运行时后端 (Express) | 3100 |
| `packages/shared` | 跨端共享类型与协议定义 | - |

### 服务关系

- `apps/web` 通过 Vite 代理访问后端：
  - `/web/api/*` → `http://127.0.0.1:3200`
  - `/agent/api/*` → `http://127.0.0.1:3100`
- `apps/agent-backend` 的 `auth.baseUrl` 默认指向 `http://localhost:3200`
- MML schema 路由由 `apps/web-backend` 提供：`/web/api/mml/schema`

### 构建产物

- 各应用保留各自的 `dist/` 目录作为原始构建输出
- 根目录 `dist/` 为统一归档目录，构建后会自动汇总：
  - `dist/web/`
  - `dist/web-backend/`
  - `dist/agent-backend/`
  - `dist/manifest.json`
- `dist/web/` 为静态资源目录，不是 Node 服务入口
- `dist/web-backend/` 与 `dist/agent-backend/` 为可直接运行的 Node 22+ 运行包，可在目录内执行 `node index.js`

### 关键配置文件

- `apps/agent-backend/config.json`：模型配置、运行时参数、工具禁用列表
- `apps/web-backend/config.json`：认证模式、数据库路径、MML 规则配置

## 运行时注意事项

- 修改 `apps/agent-backend/config.json` 后需重启服务
- `apps/agent-backend/workspace` 和各服务的 `data/` 目录为运行时生成，不应提交
- 默认本地账号：用户名 `admin`，密码 `Admin@123456`
- `pnpm clean` 仅用于构建前清理，不删除依赖目录
- 如需彻底清理依赖残留，使用 `pnpm clean:all` 或 `pnpm reinstall`
