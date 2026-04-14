## 1. Backend delete contract

- [x] 1.1 在 `apps/agent-backend/src/files/fileStore.ts` 增加按当前 `user + agent` scope 删除 workspace entry 的公开方法，并同步删除磁盘文件、内存索引和 `file-map.json`
- [x] 1.2 在 `apps/agent-backend/src/routes/files.ts` 增加工作区文件 `DELETE /files/:fileKey` 路由，并复用现有鉴权与 scope 解析逻辑
- [x] 1.3 为后端删除流补充测试，覆盖 upload/output 删除成功、跨 scope 拒绝、删除后 metadata/open 失败和显式失败返回

## 2. Frontend API and workspace state

- [x] 2.1 在 `apps/web/src/api/agentApi.ts` 增加工作区文件删除 API，并保持错误 payload 透传
- [x] 2.2 在 `apps/web/src/stores/workbenchStore.ts` 增加 `deleteWorkspaceFile` 动作，生成高风险确认文案并在确认后刷新 workspace metadata
- [x] 2.3 复用并补强工作区状态收敛逻辑，确保删除当前文件、已打开文件和脏文件时的选中态、标签态和编辑区状态正确更新
- [x] 2.4 为 store 删除流补充单元测试，覆盖确认取消、删除成功、删除失败、删除活动文件和未保存文件提示

## 3. Sidebar interaction and UI verification

- [x] 3.1 重构 `apps/web/src/components/workbench/WorkspaceSidebar.vue` 文件行结构为“主点击区 + 删除图标”，保持单击选中与双击打开语义不变
- [x] 3.2 为 Sidebar 删除图标增加危险态样式、可访问标签和事件阻断，确保点击删除不会触发行打开或选中
- [x] 3.3 在 `apps/web/src/components/workbench/WorkbenchShell.vue` 接入 Sidebar 删除事件到 workbench store
- [x] 3.4 为 Sidebar 和相关壳层补充组件测试，覆盖删除入口显示、删除事件触发边界和现有文件行交互不回归

## 4. Validation

- [x] 4.1 运行受影响的前后端单元测试并修复失败用例
- [x] 4.2 运行工作区相关静态检查，确认删除能力未破坏现有 workspace open/save 流
