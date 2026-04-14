## Context

技能搜索面板实际位于 `ConversationPane.vue`，搜索词由父组件 `workbenchStore.skillSearchQuery` 持有，过滤逻辑在 `filterSkillsBySearchQuery` 中执行。搜索索引由 `buildSkillSearchIndex` 构建，已将三个 intentGroup 映射为中文关键词（带空格分隔）：

- `planning` → `"方案 制作 planning"`
- `configuration-authoring` → `"配置 生成 authoring"`
- `verification` → `"配置 核查 verification"`

`normalizeSearchQuery` 按空格拆分为 token 数组，过滤为 AND 逻辑（所有 token 均需命中）。

## Goals / Non-Goals

**Goals:**
- 空结果状态下仅提供“当前存在 skill 的分类”对应的可点击 Tag，点击后填入搜索词触发过滤
- 当某个分类没有任何 skill 时，不展示该分类 Tag，避免用户进入无效空结果
- 当三个分类均无 skill 时，不展示 Tag 容器，仅保留空结果提示文案
- 零改动父组件过滤逻辑与 store

**Non-Goals:**
- 不支持多分类叠加选择
- 不改动搜索框 placeholder 或 summary 文案
- 不改动 emit 事件签名

## Decisions

**Tag 点击时 emit 的值使用带空格的中文词（`'方案 制作'` / `'配置 生成'` / `'配置 核查'`）**

- 搜索索引中词语以空格分隔，normalizeSearchQuery 拆出两个 token，AND 匹配可精准命中单一分组
- 直接复用现有 `update:search-query` 事件链路，无需新增 prop 或 emit
- 搜索框展示值与 emit 值一致（用户已确认可接受）
- 备选方案：使用英文 key（`planning` 等）→ 搜索框显示英文，用户体验不佳，排除

**空结果 Tag 基于当前 `starterGroups` 的可用分类动态推导，而非固定写死三个分类**

- 只有当某个 intentGroup 当前至少存在一个 skill 时，才展示对应 Tag
- 避免展示点击后必然仍为空结果的无效入口
- 继续复用现有 `starterGroups` 数据，不新增 store 字段或后端接口
- 三个分类都没有 skill 时，不渲染 Tag 容器，空状态维持为纯提示文案

## Risks / Trade-offs

- [风险] 若未来 `buildSkillSearchIndex` 修改了关键词映射，Tag 点击效果可能失效 → 关注点耦合，但属于可接受的内部约定，修改时同步更新 Tag 值即可
- [取舍] 搜索框显示 `方案 制作`（带空格）而非 `方案制作` → 用户已确认可接受，换取零额外逻辑
- [取舍] 空结果 Tag 数量随可用 skill 变化，视觉上不再固定为三个 → 但能避免无效点击，交互收益更高
