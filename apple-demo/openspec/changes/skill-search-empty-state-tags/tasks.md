## 1. 模板改动

- [x] 1.1 在 `ConversationPane.vue` 空结果状态中，将固定建议词改为基于当前可用分类动态渲染的 `<button>` 列表
- [x] 1.2 当某个 intentGroup 当前没有任何 skill 时，不展示该分类 Tag；当三个分类都没有 skill 时，不渲染 Tag 容器

## 2. 样式

- [x] 2.1 复用或调整 `ConversationPane.vue` 空状态建议词区域样式，确保动态数量的 Tag 仍保持横排和间距一致
- [x] 2.2 保持 Tag 按钮边框、圆角、hover 状态，并兼容仅 1 个或 2 个 Tag 的展示
