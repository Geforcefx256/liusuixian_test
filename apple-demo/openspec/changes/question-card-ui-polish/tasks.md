## 1. PendingQuestionCard.vue 改动

- [x] 1.1 Select 第一个 option 移除 `hidden` 属性，保留 `disabled`，添加 `pending-question-card__placeholder-option` class
- [x] 1.2 新增 CSS：`.pending-question-card__placeholder-option { color: #9ca3af; }` 及 select 未选中时的灰色文字样式（`:invalid` 或通过 value="" 判断）
- [x] 1.3 "拒绝"按钮文案改为"跳过"
- [x] 1.4 `.pending-question-card__input` 的 `min-height` 从 42px 改为 44px
- [x] 1.5 `.pending-question-card__actions` 的 `gap` 从 10px 改为 12px
- [x] 1.6 `.pending-question-card` 新增 `border-left: 3px solid rgba(42, 88, 128, 0.5)`

## 2. 验证

- [x] 2.1 Select 未选中时框内显示灰色"请选择"提示，占位项不可被选中
- [x] 2.2 取消按钮显示"跳过"
- [x] 2.3 DevTools 确认输入框高度 ≥ 44px
- [x] 2.4 两个操作按钮间距视觉上不再拥挤
- [x] 2.5 卡片左侧蓝色竖线可见
- [x] 2.6 运行 `pnpm type-check` 无错误
