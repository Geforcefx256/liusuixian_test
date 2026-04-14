## 1. Skill 管理治理语义

- [x] 1.1 更新 `AdminSkillManagement.vue` 中与 surface 相关的标题、说明、字段名、筛选项和状态文案，统一为“展示 / 生产 / 测试”。
- [x] 1.2 梳理与 managed skill surface 相关的前端断言和展示映射，确保“测试”作为用户可见标签不会影响现有治理语义。
- [x] 1.3 在 Skill 管理页保存治理信息后补上当前 workbench active agent 元数据刷新入口，避免治理后的名称继续停留在旧缓存。

## 2. Workbench starter 与搜索数据链路

- [x] 2.1 调整 `workbenchStore` 的 starter 分组派生逻辑，在保留代表 starter skill 的同时，为每个分组提供治理后技能名称预览列表。
- [x] 2.2 统一聊天页、首页和热门技能所消费的 governed skill name，消除正常展示回退为 skill id 的链路缺陷。
- [x] 2.3 保持 experimental surface 过滤、starterPriority 排序和整卡单一点击行为不变，避免这次变更影响现有授权与入口语义。

## 3. 空会话 UI 与验证

- [x] 3.1 更新 `ConversationPane.vue` 的“常用起点”卡片，移除“立即开始”类冗余动作文案，并展示治理后技能名称预览。
- [x] 3.2 按响应式规则限制 starter 卡片中的技能名称预览数量，并对过长名称使用稳定截断而不是按字数动态计算。
- [x] 3.3 如有必要同步调整 `HomeStage.vue` 的 starter 呈现，使首页与空会话工作台对治理名称的展示保持一致。
- [x] 3.4 补充或更新前端 store / 组件测试，覆盖术语统一、治理名称刷新、热门技能显示 governed name，以及常用起点卡片的新展示语义。
