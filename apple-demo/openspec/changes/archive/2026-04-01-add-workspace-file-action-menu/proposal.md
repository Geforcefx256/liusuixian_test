## Why

当前工作区文件列表把删除入口直接做成了行内垃圾桶图标。这个方案虽然可用，但对于高风险动作来说过于外露：文件行本身还承担单击选中、双击打开的主操作，删除图标长期常驻会增加视觉噪音，也让误触风险和操作压力偏高。

与此同时，工作区文件列表还缺少一个最基础的次级文件动作：下载。用户现在可以打开、编辑和删除工作区文件，但不能直接从侧栏把上传文件或运行产物下载回本地，导致文件行缺少一个完整的“次级操作”承载位。

文件行展示层也需要保持稳定约束：当文件名过长时，当前交互目标仍然应该清晰，文件名必须在单行内自动省略，不能换行撑高列表，也不能把右侧行级动作入口挤出可见区域。

## What Changes

- 将工作区文件行的次级动作从常驻垃圾桶图标调整为行级 `更多` 菜单，首版菜单只包含 `下载` 和 `删除`。
- 保持文件行主点击区的既有语义不变：单击仍然选中，双击仍然打开；打开菜单或执行菜单项不得串扰主文件行行为。
- 明确工作区文件名在侧栏内保持单行展示；当文件名超过可用宽度时，必须自动显示省略号，且不得挤压或遮挡右侧 `更多` 菜单。
- 为 `apps/agent-backend` 新增工作区文件下载 contract，允许在当前 `user + agent` scope 内按 `fileKey` 下载 upload/output 文件。
- 在 `apps/web` 增加工作区文件下载调用与浏览器下载触发逻辑，并保留现有删除确认、删除后状态收敛与显式失败反馈。
- 明确首版不包含重命名、复制路径、批量操作或通用文件管理器模式，只解决“危险动作层级不合理”和“缺少下载入口”两个核心问题。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 工作区文件行需要通过行级 `更多` 菜单承载 `下载` 与 `删除`，而不是暴露常驻删除图标。
- `agent-web-workbench`: 工作区文件行需要对超长文件名维持稳定展示，采用单行省略并持续保留右侧行动入口可见。
- `agent-backend-runtime`: 工作区文件 contract 需要补充显式下载能力，允许前端下载当前 scope 内的上传文件与输出文件。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/WorkspaceSidebar.vue`
  - `apps/web/src/components/workbench/WorkbenchShell.vue`
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/api/agentApi.ts`
  - `apps/web/src/components/workbench/*.test.ts`
  - `apps/agent-backend/src/routes/files.ts`
  - `apps/agent-backend/tests/files.routes.test.ts`
- APIs:
  - add workspace file download endpoint under `/agent/api/files/:fileKey/download`
  - extend frontend workspace file API usage for browser downloads
- Dependencies:
  - no new third-party dependencies are required
- Systems:
  - workspace sidebar row-action interaction model
  - workspace sidebar filename overflow presentation
  - scoped workspace file download handling in agent-backend
