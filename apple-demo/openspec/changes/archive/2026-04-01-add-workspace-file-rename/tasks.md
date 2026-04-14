## 1. Backend rename contract

- [x] 1.1 在 `apps/agent-backend/src/files/fileStore.ts` 增加按当前 `user + agent` scope 重命名 workspace entry 的公开方法，保持 `fileKey` / `fileId` / `createdAt` 稳定，并同步更新磁盘文件、内存索引与 `file-map.json`
- [x] 1.2 为 rename 流补充 v1 约束校验，显式拒绝目录变更、扩展名变更、仅大小写变化、同 scope 同类目标冲突以及 legacy output 重命名
- [x] 1.3 在 `apps/agent-backend/src/routes/files.ts` 增加工作区文件 `PATCH /files/:fileKey/rename` 路由，并复用现有鉴权与 scope 解析逻辑
- [x] 1.4 为后端 rename 流补充测试，覆盖 upload/output 重命名成功、跨 scope 拒绝、v1 边界拒绝、metadata 持久化失败回滚和 rename 后 open/metadata 更新

## 2. Frontend API and workspace state

- [x] 2.1 在 `apps/web/src/api/agentApi.ts` 增加工作区文件重命名 API，并保持错误 payload 透传
- [x] 2.2 在 `apps/web/src/stores/workbenchStore.ts` 增加 `renameWorkspaceFile` 动作，收集新的 basename、调用后端 rename，并在成功后刷新 workspace metadata
- [x] 2.3 收紧 store 层 destructive-action 约束：当前会话运行中时禁止工作区文件删除与重命名，目标文件存在未保存修改时禁止删除与重命名
- [x] 2.4 补强工作区状态收敛逻辑，确保 rename 成功后已打开标签与编辑器缓存保留原有 file identity，仅更新文件名与路径
- [x] 2.5 为 store 重命名与 destructive-action 拦截补充单元测试，覆盖运行中拦截、dirty 文件拦截、rename 成功、rename 失败与打开中文件 metadata 同步

## 3. Sidebar interaction and UI verification

- [x] 3.1 在 `apps/web/src/components/workbench/WorkspaceFileActionMenu.vue` 增加 `重命名` 行级动作，并保留现有下载/删除入口与事件阻断语义
- [x] 3.2 在 `apps/web/src/components/workbench/WorkspaceSidebar.vue` 与相关壳层接入 rename 事件，采用简单输入框或对话框收集新的 basename
- [x] 3.3 为 destructive actions 增加禁用态或显式阻断反馈，确保运行中或 dirty 文件不会继续进入删除/重命名流
- [x] 3.4 为 Sidebar/菜单相关组件补充测试，覆盖 rename 入口显示、阻断打开/选中、运行中禁用和 dirty 文件禁用边界

## 4. Validation

- [x] 4.1 运行受影响的前后端单元测试并修复失败用例
- [x] 4.2 运行工作区相关静态检查，确认 rename 与 destructive-action 拦截未破坏现有 workspace open/save/download/delete 流
