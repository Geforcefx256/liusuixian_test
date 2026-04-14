## 1. Header Structure

- [x] 1.1 调整 `WorkspaceEditorPane.vue` 顶部模板，移除重复的 `selected-file` 文件名区块
- [x] 1.2 将活动文件的文件级操作入口迁移到标签行右侧，并保持现有文件动作能力可用

## 2. Layout And Styling

- [x] 2.1 清理 `selected-file` 相关样式并重整标签行与工具栏的间距、对齐和层次
- [x] 2.2 调整窄屏下顶部响应式布局，确保只保留“标签导航层 + 工具栏层”两层职责

## 3. Verification

- [x] 3.1 更新 `WorkspaceEditorPane.test.ts`，验证当前文件名不再重复渲染
- [x] 3.2 更新或补充测试，验证文件级操作入口仍可访问且工具栏动作保持可用
