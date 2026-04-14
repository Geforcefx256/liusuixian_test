## Why

PendingQuestionCard 已挪入消息流，但卡片本身存在若干交互和视觉细节问题：Select 下拉框无占位提示导致用户不知如何操作、"拒绝"按钮语气偏重、输入框触控目标略小、按钮间距过窄、卡片与消息流视觉归属感弱。

## What Changes

- Select 字段第一项由 `disabled hidden` 改为 `disabled`（灰色），作为可见的占位提示
- "拒绝"按钮文案改为"跳过"
- 输入框 `min-height` 从 42px 提升至 44px（满足触控最小目标）
- 操作按钮区 `gap` 从 10px 增至 12px
- 卡片左侧新增蓝色竖线，强化消息流视觉归属感

## Capabilities

### New Capabilities

（无新功能，均为现有组件的视觉/交互调整）

### Modified Capabilities

（无 spec 层级行为变更）

## Impact

- 仅涉及 `apps/web/src/components/workbench/PendingQuestionCard.vue`
- 不涉及后端 API、数据结构、第三方依赖变更
