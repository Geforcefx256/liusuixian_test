## Context

当前工作区已经支持 Markdown 文件的编辑/预览切换，但默认视图仍由 `WorkspaceEditorPane` 的本地 `viewMode` 初始值决定，并统一从 `text` 起步。`workbenchStore.openWorkspaceFile` 只负责把文件设为 active，不携带“默认展示模式”语义，因此无论文件从侧栏双击、结果卡 `打开文件`，还是已有 tab 再次激活，Markdown 当前都会先落到文本编辑视图。

这次变更只调整前端工作区的默认视图策略，不改变后端文件模式契约，也不引入新的工作区状态持久化。

## Goals / Non-Goals

**Goals:**
- 让 Markdown 工作区文件在成为当前激活文件时默认展示预览视图。
- 保证所有打开入口和重新激活路径遵循同一默认策略，而不是由某个入口单独决定。
- 保留现有“编辑 / 预览”切换能力，让用户仍能手动进入编辑视图。
- 保持非 Markdown 文件的当前默认行为不变。

**Non-Goals:**
- 不按文件记忆用户上一次手动选择的视图。
- 不调整 CSV、MML 或普通文本文件的默认视图行为。
- 不修改后端 API、workspace file descriptor 或文件模式识别规则。

## Decisions

### 1. Markdown 默认视图在编辑器面板内按 active file 统一解析

默认视图逻辑应放在 `WorkspaceEditorPane` 内，根据当前 `activeFile` 的 `mode` 在文件变为激活态时决定 `viewMode`。这样所有入口都会收敛到同一套行为：侧栏双击、结果卡 `打开文件`、创建新文件后自动打开、以及已打开 tab 的重新激活都不需要各自传递额外参数。

这样做也符合现有架构边界：store 负责“哪个文件被打开/激活”，编辑器面板负责“该文件当前如何展示”。

**Alternatives considered**
- 在 `workbenchStore.openWorkspaceFile` 中加入默认视图字段：会把展示策略泄漏到 store，并且仍需要处理已打开 tab 的重新激活分支。
- 让每个入口分别指定 Markdown 打开为预览：行为容易漂移，后续新增入口时也容易漏改。

### 2. Markdown 重新激活时始终回到预览，不记忆上次手动视图

本次按用户确认采用最简单策略：Markdown 文件每次成为当前激活文件时，都重新进入预览。用户手动切到“编辑”只影响当前激活周期，不跨文件切换保留。

这样可以避免引入按文件保存视图状态的额外结构，也能让“打开 Markdown 是为了先看效果”这个产品心智保持一致。

**Alternatives considered**
- 记忆每个文件上次的视图模式：体验更连续，但需要新增按文件的 UI state，超出本次需求。
- 只在第一次打开时默认预览，后续激活保留手动选择：规则更难解释，也需要额外区分“首次打开”和“再次激活”。

### 3. 非 Markdown 文件继续沿用现有默认策略

CSV 继续由用户主动进入表格视图，MML 继续遵循当前文本优先和解析门控，普通文本继续默认文本编辑。这样可以把改动范围严格限制在 Markdown，不改变其他工作区文件的使用习惯和测试基线。

**Alternatives considered**
- 顺带让 CSV/MML 也默认进入 secondary view：会把一个单点需求扩大成工作区整体默认视图重构，风险和回归面都更大。

## Risks / Trade-offs

- [Markdown 用户切回编辑后，再次激活文件会被重置回预览] → 这是本次明确接受的产品行为，用更简单的一致规则换取更小实现面。
- [默认视图逻辑如果分散在多个 watcher/handler 中，后续容易再次漂移] → 通过收敛成单一“根据 active file 解析默认 viewMode”的逻辑降低维护成本。
- [现有测试基线把 Markdown 初始态视为编辑视图] → 需要同步更新组件测试，覆盖首次打开和重新激活两个路径，避免行为回退。

## Migration Plan

1. 更新 `WorkspaceEditorPane` 的默认视图决策逻辑，使 Markdown active file 进入 `preview`。
2. 保持现有工具栏切换与非 Markdown 分支不变，避免扩大行为改动。
3. 更新组件测试，覆盖 Markdown 默认预览与重新激活重置预览的场景。

回滚策略：
- 若默认预览引发明显可用性问题，可仅回退前端默认视图逻辑，恢复 Markdown 默认进入编辑视图。
- 由于没有后端契约或数据迁移，本次回滚不涉及 workspace 数据修复。

## Open Questions

None.
