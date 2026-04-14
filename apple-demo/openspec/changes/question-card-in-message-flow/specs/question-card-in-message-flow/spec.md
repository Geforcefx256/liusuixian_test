## ADDED Requirements

### Requirement: 问题卡片在消息流中渲染
当 LLM 调用 `local:question` 工具产生 pending interaction 时，系统 SHALL 将问题卡片作为消息列表的最后一条 item 渲染，而非渲染在 composer 区域。

#### Scenario: 问题卡片出现在消息流末尾
- **WHEN** LLM 调用 `local:question` 工具，前端收到 pending interaction
- **THEN** 问题卡片作为消息列表最后一条 item 显示，composer 区域不显示卡片

#### Scenario: 问题卡片出现时自动滚动到底部
- **WHEN** pending interaction 注入 messages[]，卡片出现在消息流末尾
- **THEN** 页面自动滚动到消息流底部，用户可见问题卡片

#### Scenario: 大端卡片滚轮正常工作
- **WHEN** 问题卡片字段较多、内容较长
- **THEN** 消息区滚轮始终可用，卡片内容可通过滚动完整浏览

### Requirement: 历史加载后 pending 卡片正确还原
系统 SHALL 在加载历史会话时，将 pending interaction 还原为消息流末尾的问题卡片。

#### Scenario: 切换回含 pending interaction 的会话
- **WHEN** 用户切换到一个含未回答问题的历史会话
- **THEN** 问题卡片出现在消息流末尾，可正常提交或拒绝

### Requirement: 回答后卡片从消息流移除
用户提交或拒绝问题后，系统 SHALL 将问题卡片从消息流中移除，并显示现有的摘要文本（"已提交回答：..."）。

#### Scenario: 用户提交回答
- **WHEN** 用户填写问题卡片并点击提交
- **THEN** 卡片从消息流中消失，对应位置显示"已提交回答：字段名: 值"摘要文本

#### Scenario: 用户拒绝问题
- **WHEN** 用户点击拒绝按钮
- **THEN** 卡片从消息流中消失，对应位置显示拒绝摘要文本
