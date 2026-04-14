## ADDED Requirements

### Requirement: Select 字段显示占位提示
问题卡片的 Select 字段在未选中时 SHALL 显示灰色占位文字（"请选择"或字段配置的 placeholder），提示用户操作。

#### Scenario: Select 未选中时显示提示
- **WHEN** 问题卡片含 Select 字段且用户尚未选择
- **THEN** 下拉框内显示灰色提示文字，不显示空白

#### Scenario: 占位文字不可选择
- **WHEN** 用户展开 Select 下拉列表
- **THEN** 占位选项（"请选择"）不可被选中

### Requirement: 操作按钮文案语气友好
问题卡片的取消操作按钮 SHALL 显示"跳过"而非"拒绝"。

#### Scenario: 取消按钮显示跳过
- **WHEN** 问题卡片渲染
- **THEN** 操作区右下角次要按钮显示"跳过"

### Requirement: 输入控件满足触控目标规范
问题卡片的输入框和按钮高度 SHALL 不低于 44px。

#### Scenario: 输入框触控目标
- **WHEN** 问题卡片在移动端渲染
- **THEN** 所有输入控件可点击区域高度 ≥ 44px

### Requirement: 卡片左侧视觉标识
问题卡片 SHALL 在左侧显示蓝色竖线，与消息流中的助手消息视觉风格保持一致。

#### Scenario: 左侧竖线可见
- **WHEN** 问题卡片出现在消息流中
- **THEN** 卡片左侧有蓝色竖线标识
