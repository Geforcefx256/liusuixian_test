## Context

当前 `ref_code/apps/agent-backend` 已经不仅是一个简单的 API 服务，而是一套完整的 agent runtime：它包含 agent catalog、session store、planner/build 双阶段、tool provider registry、gateway/MCP 集成、dev logs、memory、skill 资产与 dist 发布链路。现有实现默认依附于 `ref_code/` 目录布局，发布脚本和 `SKILL.md` 中的路径也建立在旧结构上。

本次迁移的目标不是重写 runtime，而是把它完整收敛到新的产品目录 `apps/` 下，其中 `apps/agent-backend` 作为独立 npm 项目存在，`apps/web` 作为后续前端目录存在。浏览器仍通过同源代理访问 `/agent/api/*` 与 `/web/api/*`，但 `agent-backend` 服务端仍通过显式配置地址反查认证中心。

该变更是一个跨模块迁移：会同时触及源码、agent/skill 资产、模板静态资源、运行目录、构建脚本、发布脚本和外部集成配置，因此需要在编码前明确迁移边界与路径语义。

## Goals / Non-Goals

**Goals:**
- 在 `apps/agent-backend` 下建立一个完整、可独立构建与发布的 agent runtime 单元。
- 保留现有核心行为：路由、session store、planner/build 双阶段、tool provider、dev logs、memory、gateway/MCP 集成与 skill 执行链。
- 保留现有 dist 发布模式，并让源码态与发布态都能正确解析 assets、skill 脚本、运行目录与模板文件。
- 为后续 `apps/web` 前端目录预留结构，并补齐现有 skill 依赖的模板静态资源。

**Non-Goals:**
- 不重构 agent runtime 的架构，不改变 planner/build、session store 或 tool bus 的产品语义。
- 不将 `agent-backend` 再拆分成多个服务。
- 不在本次变更中引入新的认证协议、前端框架或新的发布机制。
- 不修改业务行为来适应迁移，除非是为了修复路径或打包语义偏差。

## Decisions

### 1. 保持 `apps/agent-backend` 作为完整服务根

将 `src`、`assets`、`scripts`、`extensions`、`workspace`、`data`、`dist` 继续放在同一个服务根下，而不是在第一阶段做资源、配置和运行目录拆分。

原因：
- 当前 `ConfigLoader`、`runtimePaths`、发布脚本、skill 路径引用都假设服务根附近存在 `config.json`、`assets/`、`extensions/`、`workspace/`。
- 先保持服务根自洽，迁移风险最低，后续如需进一步分拆可以在独立阶段完成。

备选方案：
- 将 assets/config/runtime data 拆到 `apps/resources` 或 `var/` 下。
  - 放弃原因：会立即引入大量路径重写和发布适配，增加第一阶段失败概率。

### 2. 保持“原设计语义”，不照搬旧相对路径字符串

旧结构下 `runtime.workspaceDir` 的目标是旧产品工作区根。迁移到 `apps/` 后，仍保持“local tools 面向产品工作区根”这一语义，但配置值要调整为适配新目录结构的值，而不是机械保留旧字符串。

原因：
- 迁移要保持行为等价，而不是保留已经失效的相对路径字面量。
- `find_files`、`search_in_files`、`run_command` 都依赖工作区根是否正确。

备选方案：
- 原样保留旧配置值。
  - 放弃原因：迁移后会把工作区根指向错误目录，破坏 local tools 与 skill 脚本执行。

### 3. 保持 dist 发布模式，并一起迁移发布脚本

继续保留 `tsc -> dist -> runtime assets/node_modules 装配` 这套发布方式，同时把 `build-agent-dist.mjs`、`runtime-node-modules.mjs` 迁入 `apps/agent-backend/scripts/` 并按新结构调整。

原因：
- 这是现有运行链路的一部分，尤其涉及 skill 脚本路径重写与 runtime 依赖装配。
- 迁移阶段不引入新的发布机制，能降低行为回归风险。

备选方案：
- 改成新的容器发布或只保留源码态运行。
  - 放弃原因：会把“迁移”变成“迁移 + 发布体系重构”。

### 4. 显式迁移 skill 依赖的模板静态资源到 `apps/web`

将 `ne-sampleV1.csv` 迁移到 `apps/web/public/templates/`，并同步调整 `SKILL.md` 与发布脚本中的路径引用。

原因：
- `ne-csv-processor` skill 已把该模板视为用户上传前的静态模板资源。
- 未来前端会在 `apps/web` 下建立，同路径语义更清晰。

备选方案：
- 将模板继续留在 backend 目录。
  - 放弃原因：与未来前端静态资源归属不一致，也无法匹配现有 skill 对“前端模板资源”的语义。

### 5. 保持浏览器同源代理与服务端显式认证回查并存

浏览器侧继续通过同源代理访问 `/agent/api/*` 与 `/web/api/*`；`agent-backend` 服务端仍使用 `auth.baseUrl` 指向 `web-backend`，用于反查 `/web/api/auth/me`。

原因：
- 浏览器代理与服务端回查解决的是两类问题，不能混用。
- 迁移后 `agent-backend` 仍然需要服务端级别的认证真相来源。

备选方案：
- 让服务端也依赖相对路径或浏览器代理语义。
  - 放弃原因：服务端环境中没有浏览器代理上下文，易导致认证失败。

## Risks / Trade-offs

- [发布脚本路径重写遗漏] → 在迁移后优先验证 dist 态的 `skill:skill` 与 `local:run_command` 全链路。
- [工作区根配置错误] → 用 local tools 冒烟测试 `find_files`、`read_file`、`run_command`，确认它们面向 `apps/`。
- [模板资源引用漂移] → 把 `apps/web/public/templates/ne-sampleV1.csv` 纳入迁移清单，并同步修正 `SKILL.md` 与发布脚本替换规则。
- [独立 npm 项目下 runtime-node-modules 装配失效] → 在迁移完成后单独执行 dist 构建与启动验证。
- [sqlite-vec 平台差异] → 保留扩展下载脚本，按目标运行平台补齐 `vec0.*` 文件，并验证 vector fallback。
- [认证回查配置与同源代理混淆] → 明确区分浏览器请求配置与服务端 `auth.baseUrl` 配置，并在联调前单独验证 `/web/api/auth/me` 回查。

## Migration Plan

1. 在 `apps/` 下建立 `agent-backend` 与 `web` 目录骨架。
2. 原样迁移 `agent-backend` 源码、assets、extensions、tests、配置文件和下载脚本。
3. 迁移 dist 发布脚本，并将所有旧路径替换为新目录结构。
4. 迁移前端模板资源到 `apps/web/public/templates/`。
5. 调整 `tsconfig`、`config.json` 与发布脚本中的根路径和输出路径。
6. 安装独立 npm 依赖，完成源码态构建、启动与冒烟测试。
7. 验证认证回查、agent catalog、session/run、planner/build、tool bus、skill 脚本、dev logs、memory。
8. 验证 dist 发布与启动。

回滚策略：
- 保留 `ref_code` 原实现不动，迁移阶段只在 `apps/` 下新增结构。
- 如果新结构出现阻塞问题，停止切换到 `apps/agent-backend`，继续以 `ref_code/apps/agent-backend` 作为基线。

## Open Questions

- 新仓库中的 `web-backend` 最终会落在哪个目录，以及 `auth.baseUrl` 的默认开发值应指向哪里。
- 独立 npm 项目下是否仍需要完整保留 `runtime-node-modules.mjs`，还是只在短期兼容期使用。
