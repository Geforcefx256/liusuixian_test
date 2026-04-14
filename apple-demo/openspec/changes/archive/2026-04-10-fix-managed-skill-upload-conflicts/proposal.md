## Why

当前 skill ZIP 上传链路只对 canonical `id` 冲突做显式拦截，却允许不同 `id` 复用同一个 canonical `name`。这会让运行时按 “name or id” 解析 skill 时把同名 skill 压缩到单个别名上，导致上传成功但解析结果不确定。

同时，`/agent/api/admin/skills/upload` 的中间件异常没有稳定的结构化错误出口。管理员上传非 ZIP 或触发上传中间件错误时，前端无法稳定拿到产品约定的 `{ error, code }` 响应，也就无法给出一致的治理提示。

## What Changes

- 在 managed skill ZIP 上传前同时校验 canonical `id` 和 canonical `name` 冲突，拒绝会造成 canonical 身份歧义的上传。
- 扩展上传冲突响应，在现有 `409` 基础上返回冲突原因 `reason: 'id' | 'name'`，供前端区分展示。
- 将 `/agent/api/admin/skills/upload` 的局部上传中间件错误归一化为稳定 JSON 错误响应，而不是泄露原始中间件异常文本或默认错误页。
- 更新 Skill 管理页的冲突提示文案，统一呈现 “canonical skill 冲突（id 或 name）”，并显示本次冲突的具体类型。
- 为上述行为补充后端路由、catalog / upload 校验、以及前端管理页测试覆盖。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-management`: 调整 canonical skill 上传冲突规则与管理端冲突反馈契约，要求显式处理 `id` / `name` 冲突，并为 skill ZIP 上传提供稳定的结构化错误响应。

## Impact

- Affected code:
  - `apps/agent-backend/src/routes/adminSkills.ts`
  - `apps/agent-backend/src/skills/adminCatalogService.ts`
  - `apps/agent-backend/src/skills/catalog.ts`
  - `apps/web/src/api/agentApi.ts`
  - `apps/web/src/api/types.ts`
  - `apps/web/src/components/workbench/AdminSkillManagement.vue`
- Affected APIs:
  - `POST /agent/api/admin/skills/upload`
- Affected tests:
  - managed skill upload route tests
  - skill catalog tests
  - admin skill management UI tests
- Dependencies:
  - 无新增第三方依赖
