## Context

当前空会话 starter 卡片与“更多搜索”之间已经存在基础联动：没有代表 skill 的空分组会打开搜索面板并写入分组查询词，但有代表 skill 的分组仍会把 `starterPrompt` 直接写进输入框。这个实现把 skill 发现状态塞进了 composer 文本本身，导致用户既看不到稳定的“当前正在浏览哪个分组”，也无法在不清空输入框的前提下继续比较同类技能。

这次调整主要影响 `ConversationPane.vue` 的空态交互，以及 `workbenchStore.ts` 中搜索状态的表达方式。约束是保持现有 governed skill 数据链路、分组模型和单卡点击语义不变，不新增依赖，也不把空态改回独立首页流程。

## Goals / Non-Goals

**Goals:**
- 让 starter 卡片点击后的主反馈落在“更多搜索”区域，而不是 composer 正文。
- 为“更多搜索”增加明确的分组聚焦语义，使其能在搜索框为空时仍显示某个 intent group 的相关 skill。
- 保持代表 starter skill 的优先展示，同时保留同类技能比较空间。
- 确保点击 starter 不会再隐式生成“请帮我使用……”类正文模板。

**Non-Goals:**
- 不改变 managed skill governance、starter 分组数量或 intent group 定义。
- 不调整 skill 实际执行方式，不把 starter 点击改成自动发送。
- 不引入新的后端接口或第三方依赖。

## Decisions

### 1. 用显式“发现上下文”替代预填输入框

starter 卡片点击后，前端应进入一个显式 discovery context，例如当前 intent group、代表 starter skill id、来源为 starter 卡片。这些信息属于搜索状态，不属于 composer 文本，因此应由空态搜索面板消费，而不是通过 `draft` 间接承载。

备选方案：
- 继续沿用 `starterPrompt` 预填输入框。未采用，因为它把选择能力和描述任务混为一体，且无法稳定表示“当前正在浏览哪个分组”。
- 点击后直接发送代表 starter prompt。未采用，因为用户尚未确认具体任务，过于激进。

### 2. 搜索框保持空值，分组聚焦使用独立状态表达

“更多搜索”的分组聚焦不能再依赖把 `discoveryQuery` 写进 `skillSearchQuery`。搜索关键词和分组来源是两个不同维度：前者是自由文本过滤，后者是受控 starter 上下文。实现上应新增独立的 group focus 状态，以便在输入框为空时也能展示“当前从数据转换进入”的结果和提示。

备选方案：
- 继续把分组名称写进搜索框。未采用，因为这会误导用户以为自己正在做全文搜索，也会污染后续手动输入。

### 3. 代表 starter skill 置顶高亮，但不剥夺同类比较

当 starter 卡片进入“更多搜索”后，结果区应先呈现当前代表 skill 的强调态，再继续展示同组其他 governed skills。这样既保留“系统推荐”的方向，也不把 starter 卡片退化成单一跳转按钮。

备选方案：
- 只显示代表 starter skill。未采用，因为这削弱了“更多搜索”作为发现区的价值。
- 完全不区分代表 starter skill 与普通结果。未采用，因为用户刚从 starter 卡片进入，缺少连续反馈。

### 4. 空分组与非空分组共用同一联动骨架

无论分组是否存在代表 skill，点击 starter 卡片后都应进入“更多搜索”面板，只是非空分组会额外强调当前推荐 skill，空分组则仅展示分组上下文与结果列表。这样可以统一行为预期，减少分支交互。

备选方案：
- 空分组继续联动搜索，非空分组保留预填输入框。未采用，因为这会让同一组卡片出现两套心智模型。

## Risks / Trade-offs

- [Risk] 增加独立 discovery context 后，空态搜索状态重置路径会变复杂。 → Mitigation: 明确在关闭搜索面板、新建会话、切换 agent 时统一清空该状态。
- [Risk] 结果区新增“代表 skill 高亮”后，窄屏信息密度上升。 → Mitigation: 保持代表项为单条强调卡，其余结果仍沿用现有列表与折叠规则。
- [Risk] 用户可能不立即注意到 starter 点击后的状态变化。 → Mitigation: 在“更多搜索”头部增加来源提示，并自动展开对应区域。

## Migration Plan

1. 先在 spec 中定义 starter 卡片点击后的 discovery 语义，明确其不再修改 composer 正文。
2. 再调整前端 store / 组件状态，拆分“搜索关键词”和“starter 分组聚焦”。
3. 最后补充组件与 store 测试，覆盖展开搜索、分组聚焦、代表 skill 高亮和不预填输入框的行为。

## Open Questions

- None.
