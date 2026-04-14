## Why

当前仓库中的 `ref_code/apps/agent-backend` 已经演化为一个完整的 agent runtime，但它仍依附于旧的 `ref_code` 目录结构、发布脚本路径和前端静态资源布局。为了后续在 `apps/` 下建立新的产品目录并继续扩展前端，需要先把这套 runtime 作为独立运行单元迁移到 `apps/agent-backend`，同时保留现有行为、发布方式和联调方式。

## What Changes

- 将 `ref_code/apps/agent-backend` 整体迁移到 `apps/agent-backend`，保留其作为独立 npm 项目的结构。
- 迁移并保留 agent runtime 的核心能力，包括 session store、planner/build 双阶段、tool provider registry、dev logs、memory、gateway 和 MCP 集成。
- 迁移运行所需的 assets、extensions、tests、配置文件和 dist 发布脚本，确保源码态与发布态都可用。
- 在 `apps/web/public/templates/` 下补齐前端模板静态资源，满足现有 skill 对模板文件的引用约定。
- 调整路径与配置，使迁移后的 runtime 仍保持原有设计语义：本地工具面向 `apps/` 工作区、浏览器通过同源代理访问后端、服务端通过配置地址反查认证中心。

## Capabilities

### New Capabilities
- `agent-backend-runtime`: 定义迁移后的 `apps/agent-backend` 目录、配置、发布和运行约束，确保 agent runtime 在新产品结构下保持等价行为。

### Modified Capabilities
- None.

## Impact

- Affected code: `apps/agent-backend/src/**`, `apps/agent-backend/assets/**`, `apps/agent-backend/scripts/**`, `apps/agent-backend/extensions/**`.
- Affected runtime assets: skill scripts, agent definitions, workspace/data directories, template file `apps/web/public/templates/ne-sampleV1.csv`.
- Affected APIs and integration: `/agent/api/*`, auth callback to `/web/api/auth/me`, gateway/MCP tool integration, dist packaging flow.
- Affected dependencies: Node 22+, sqlite-vec extension, model provider credentials, gateway/MCP external services, same-origin proxy setup.
