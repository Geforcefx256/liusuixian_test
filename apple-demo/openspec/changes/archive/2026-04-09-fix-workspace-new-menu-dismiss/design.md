## Context

当前 `WorkspaceSidebar` 的 `NEW` 菜单仅支持按钮二次点击收起，不支持点击外部区域或键盘 `Escape` 关闭。该行为与同界面的 `WorkspaceFileActionMenu` 不一致，导致用户需要额外操作才能退出菜单。

此改动仅涉及 `apps/web` 前端侧栏交互，不涉及后端协议、数据结构或依赖变更。

## Goals / Non-Goals

**Goals:**
- 统一 `NEW` 菜单的关闭语义，支持 outside click 与 `Escape`。
- 保留现有再次点击 `NEW` 可关闭行为，确保兼容当前使用习惯。
- 通过组件测试覆盖主要关闭路径，避免回归。

**Non-Goals:**
- 不调整工作空间树的创建流程与命名校验规则。
- 不改动文件操作菜单（重命名/下载/删除）的交互实现。
- 不引入新依赖，不调整 monorepo 目录结构。

## Decisions

1. 采用 `document.pointerdown` 作为外部点击关闭事件源。
- Rationale: 可在 `click` 之前判定交互目标，避免先触发内部开关再被外部逻辑误判。
- Alternative considered: 使用 `click` 监听外部关闭；缺点是时序更脆弱，容易与按钮切换冲突。

2. 采用 `document.keydown` 监听 `Escape` 关闭菜单。
- Rationale: 满足键盘可用性并符合通用菜单交互预期。
- Alternative considered: 仅依赖 blur 关闭；缺点是在复杂层级和事件传播下不稳定。

3. 引入统一 `closeNewMenu()` 收口所有关闭路径。
- Rationale: 降低分散状态写入导致的不一致风险，提升后续维护性。
- Alternative considered: 各路径直接改 `newMenuOpen`；缺点是容易遗漏并产生状态分叉。

## Risks / Trade-offs

- [Risk] 全局事件监听可能误伤同页其它交互 → Mitigation: 仅在 `newMenuOpen` 为真时执行关闭逻辑，并通过 trigger/dropdown 节点包含关系过滤。
- [Risk] 事件未及时清理导致重复监听 → Mitigation: 在组件挂载/卸载生命周期对称注册与移除监听。
- [Trade-off] 增加少量事件处理代码换取一致交互与更低用户操作成本。

## Migration Plan

- 该改动为前端本地交互增强，无数据迁移。
- 发布策略为常规前端发布；若出现问题可回滚到前一前端构建版本。

## Open Questions

- 无阻塞性开放问题。
