## 1. Backend Download Contract

- [x] 1.1 在 `apps/agent-backend/src/routes/files.ts` 增加工作区文件下载路由，复用现有鉴权、scope 解析和 `fileKey` 校验逻辑。
- [x] 1.2 让下载路由对当前 scope 内的 upload/output 文件返回明确附件响应，并附带权威下载文件名。
- [x] 1.3 为下载路由补充测试，覆盖成功下载、跨 scope 拒绝、已删除或缺失文件显式失败。

## 2. Frontend Row Action Menu

- [x] 2.1 将 `apps/web/src/components/workbench/WorkspaceSidebar.vue` 的文件行常驻删除图标替换为行级 `更多` 菜单。
- [x] 2.2 让首版菜单只提供 `下载` 和 `删除` 两个动作，并保证 trigger / 菜单项不会触发文件行选中或打开。
- [x] 2.3 在 `apps/web/src/api/agentApi.ts` 与 `apps/web/src/stores/workbenchStore.ts` 增加工作区文件下载动作。
- [x] 2.4 保留现有删除确认与删除后状态收敛逻辑，仅切换到新的菜单入口。

## 3. Verification

- [x] 3.1 更新 `WorkspaceSidebar` 和 `WorkbenchShell` 相关组件测试，覆盖菜单展开、下载事件、删除事件和主文件行交互不回归。
- [x] 3.2 更新 store / API 测试，覆盖下载失败显式反馈与删除链路持续可用。
- [x] 3.3 运行受影响的前后端单元测试，确认工作区打开、下载、删除和主文件行行为没有回归。
