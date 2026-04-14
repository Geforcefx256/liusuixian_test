## Context

本次变更仅涉及 `PendingQuestionCard.vue` 单文件的 CSS 数值调整和文案修改，无架构决策、无新依赖、无跨模块影响。

## Goals / Non-Goals

**Goals:**
- 修复 Select 占位提示不可见问题
- 将"拒绝"改为语气更轻的"跳过"
- 输入框和按钮满足 44px 触控目标规范
- 卡片视觉与消息流保持一致

**Non-Goals:**
- 不改变组件的数据接口（props/emits）
- 不引入新的 CSS 变量或设计 token
- 不影响后端

## Decisions

### Select placeholder 方案：CSS 灰色禁用项

移除 `hidden` 属性，保留 `disabled`，通过 CSS 将禁用项颜色设为灰色（`#9ca3af`）。
放弃在 label 旁加提示文字的方案，保持现有布局不变。

## Risks / Trade-offs

- **[风险] Select placeholder 跨浏览器颜色差异**：Safari 对 `option` 颜色支持有限。→ 缓解：select 未选中时通过 `:invalid` 伪类统一控制 select 本身的文字颜色，兼容主流浏览器。
