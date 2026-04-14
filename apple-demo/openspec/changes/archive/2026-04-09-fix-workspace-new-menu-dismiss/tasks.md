## 1. Sidebar NEW 菜单关闭行为实现

- [x] 1.1 在 `WorkspaceSidebar.vue` 为 `NEW` 触发按钮与下拉菜单增加 `ref`，并补充统一 `closeNewMenu()`
- [x] 1.2 增加 `document.pointerdown` 外部点击关闭逻辑，排除 trigger/dropdown 内部点击
- [x] 1.3 增加 `document.keydown` 的 `Escape` 关闭逻辑，并在组件卸载时清理监听
- [x] 1.4 保持现有 `toggleNewMenu` 与选择创建项后的关闭行为，避免破坏既有交互

## 2. 测试补充

- [x] 2.1 在 `WorkspaceSidebar.test.ts` 增加“打开 NEW 后点击外部关闭”的测试用例
- [x] 2.2 在 `WorkspaceSidebar.test.ts` 增加“打开 NEW 后按 Escape 关闭”的测试用例
- [x] 2.3 确认既有“再次点击 NEW 关闭”和“侧栏折叠时关闭”测试继续通过

## 3. 验证

- [x] 3.1 运行与侧栏相关测试集，验证新增行为与现有行为均通过
- [x] 3.2 通过自动化交互测试核对 `NEW` 菜单四条关闭路径：再次点击、点击外部、Esc、选择菜单项
