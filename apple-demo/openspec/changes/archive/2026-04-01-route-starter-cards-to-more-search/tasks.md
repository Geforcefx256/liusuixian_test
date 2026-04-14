## 1. 搜索状态建模

- [x] 1.1 在 `workbenchStore` 中拆分“starter 分组聚焦”和“文本搜索关键词”状态，避免点击 starter 时继续通过搜索框内容表达分组上下文。
- [x] 1.2 调整 governed skill 搜索派生逻辑，使“更多搜索”在搜索框为空时也能按当前 starter intent group 展示结果，并保留代表 starter skill 的优先级。

## 2. 空会话交互调整

- [x] 2.1 修改 `ConversationPane.vue` 的 starter 卡片点击行为，统一改为展开“更多搜索”并切换到对应分组 discovery context，不再预填 composer。
- [x] 2.2 在“更多搜索”区域增加 starter 来源提示和代表 skill 强调态，同时保留同类 skill 的比较列表与现有展开/收起行为。

## 3. 验证

- [x] 3.1 更新 `ConversationPane` 与 `workbenchStore` 相关测试，覆盖 starter 点击后展开搜索、保持输入框为空、分组聚焦结果和代表 skill 强调态。
- [x] 3.2 运行前端相关测试与类型检查，确认 starter 与搜索联动改动未破坏现有 governed skill 发现链路。
