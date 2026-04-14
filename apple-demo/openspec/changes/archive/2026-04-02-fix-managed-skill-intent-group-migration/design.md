## Context

当前 managed skill 的 `intentGroup` 模型已经收敛为 `planning`、`configuration-authoring`、`verification` 三种合法值，但历史 registry 文件中仍然保留了早期分组 `data-transformation`。注册表加载逻辑会把该值原样带入运行时，管理页表单又会把它原样提交回 `PATCH /agent/api/admin/skills/:skillId`，最终被路由层校验拒绝并返回 `Invalid intentGroup`。

这个问题同时涉及三层边界：
- `apps/agent-backend/src/skills/managedRegistry.ts` 负责从持久化文件装载和回写治理元数据；
- `apps/agent-backend/src/routes/adminSkills.ts` 负责管理接口入参校验；
- `apps/web/src/components/workbench/AdminSkillManagement.vue` 负责把后端治理元数据映射为可编辑表单并发起保存。

如果只在路由层放宽校验，会继续让废弃分组在系统中流转；如果只在前端强行清空，又会把数据修复逻辑分散到 UI。设计目标是把合法 `intentGroup` 集合和历史值迁移统一到后端真值层，再让前端显式展示“该值已失效并被清空”。

## Goals / Non-Goals

**Goals:**
- 让现有历史 `managed-skills.json` 中的非法 `intentGroup` 在加载后被显式迁移，不再阻塞管理保存链路。
- 保持当前 3 组 `intentGroup` 模型不变，不恢复旧的 `data-transformation` 分组。
- 在后端收口同一套 `intentGroup` 合法值判断，避免 registry、route、frontend 各自维护一套规则。
- 让 `Skill 管理` 页面在遇到历史非法分组时给出明确提示，并避免把未知值再次 round-trip 回后端。
- 为迁移、回写、管理保存补充自动化测试。

**Non-Goals:**
- 不新增第 4 个 starter 分组，也不调整当前 workbench starter/search 分组模型。
- 不修改 canonical skill package、`SKILL.md` 或 `SCRIPTS.yaml` 结构。
- 不引入新的第三方依赖，不调整 monorepo 顶层目录结构。

## Decisions

### 1. 将 `intentGroup` 合法值与规范化逻辑下沉为后端共享真值

后端新增一处共享的 `intentGroup` 定义与解析函数，供 registry 装载、registry 更新、route 入参校验复用。这样可以避免 route 只认 3 个值、而 registry 继续容忍旧值的分裂状态。

备选方案：
- 仅保留 route 侧校验。未采用，因为旧值仍会留在 registry 和 API 输出里，问题只会在保存时暴露。
- 由前端维护一份合法值白名单并自行修复。未采用，因为前端不应成为治理数据真值源。

### 2. 历史非法值按“当前默认分组优先，否则清空”为迁移规则

迁移时先检查当前 `DEFAULT_POLICIES` 是否为该 `skillId` 定义了合法 `intentGroup`；若有，则迁移到该分组。若当前产品语义并未为该 skill 定义新的分组，则清空为未分组，而不是猜测映射到任意新分组。

这样可以让 `dpi-new-bwm-pcc` 回到 `planning`，同时让当前没有明确 starter 分组语义的 skill 保持未分组，避免 silent semantic drift。

备选方案：
- 将所有 `data-transformation` 统一映射为某个现有组。未采用，因为这会凭空改变部分 skill 的产品语义。
- 保留 `data-transformation` 作为兼容 alias。未采用，因为当前实现、UI 和 starter 分组模型都已收敛为 3 组，恢复 alias 会扩大系统复杂度。

### 3. Registry 在迁移后立即持久化回写

当加载阶段发现并修复历史非法值后，registry 应在初始化流程中回写 `managed-skills.json`，让脏数据一次性被清除，而不是反复依赖运行时内存修正。回写前后应保留明确日志，指出哪些 `skillId` 从什么旧值迁移到了什么新值或空值。

备选方案：
- 只在内存中修正，不回写文件。未采用，因为服务重启后问题会再次出现，且排障时会继续看到脏数据文件。
- 等管理员下一次手工保存时再修正。未采用，因为这正是当前故障点。

### 4. 前端对历史非法分组使用显式 remediation，而不是静默兜底

后端修复后，绝大多数场景不会再收到非法值；但为了防止未迁移数据或旧接口响应再次进入前端，管理页表单初始化仍应校验 `intentGroup`。若遇到未知值，前端应：
- 将选择器呈现为“未分组”；
- 显示明确提示该历史分组已失效，需要重新选择或按未分组保存；
- 保存时只提交合法值或 `null`，不再把未知字符串原样提交。

这符合 debug-first 原则，因为 remediation 是显式、可见的，而不是 silent fallback。

备选方案：
- 前端继续原样显示未知值。未采用，因为现有 `<select>` 并没有对应选项，用户既看不到真实状态，也无法稳定保存。
- 前端完全不处理，假设后端永远已清洗。未采用，因为 UI 边界仍需要对异常输入保持可恢复。

## Risks / Trade-offs

- [Risk] 启动时自动回写 registry 文件会改变本地运行数据。 → Mitigation: 仅在检测到非法历史值时回写，并记录明确迁移日志。
- [Risk] 将无默认映射的旧值清空为未分组，可能让少量 skill 暂时退出 starter 分组。 → Mitigation: 这比错误映射到新分组更安全，管理员仍可在管理页明确重新选择。
- [Risk] 前端提示与后端迁移状态不一致会造成理解偏差。 → Mitigation: 前端提示仅在仍收到非法值时显示，正常迁移后的主路径不依赖该提示。

## Migration Plan

1. 在后端抽取共享 `intentGroup` 校验/规范化函数，并接入 route 与 registry。
2. 扩展 registry load 流程：检测历史非法值、按规则迁移、记录日志、必要时回写 `managed-skills.json`。
3. 调整管理页表单初始化与保存 payload 生成，显式处理未知 `intentGroup`。
4. 补充 registry、route、frontend 测试，覆盖历史数据迁移和保存恢复路径。
5. 部署后重启 `apps/agent-backend` 触发一次迁移；如需回滚，只需恢复未迁移前的 registry 文件并回退代码。

## Open Questions

- None.
