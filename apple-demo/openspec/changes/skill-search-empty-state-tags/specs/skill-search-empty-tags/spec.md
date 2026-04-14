## ADDED Requirements

### Requirement: 空结果状态展示分类快捷 Tag
当技能搜索面板处于搜索激活状态且过滤结果为空时，系统 SHALL 在提示文字下方仅展示当前存在 skill 的分类快捷 Tag 按钮。

#### Scenario: 搜索无结果时显示分类 Tag
- **WHEN** 用户在技能搜索框输入关键词，且过滤后技能列表为空
- **AND** 当前存在 `intentGroup = planning` 与 `intentGroup = verification` 的 skill，但不存在 `intentGroup = configuration-authoring` 的 skill
- **THEN** 提示文字下方仅展示两个可点击的分类 Tag：方案制作、配置核查

#### Scenario: 所有分类均无 skill 时不显示 Tag
- **WHEN** 用户在技能搜索框输入关键词，且过滤后技能列表为空
- **AND** 当前三个 intentGroup 均不存在任何 skill
- **THEN** 系统仅展示空结果提示文案
- **AND** 不展示任何分类 Tag

### Requirement: 点击分类 Tag 触发分类过滤
用户点击任意已展示的分类 Tag 后，系统 SHALL 将对应的分类搜索词填入搜索框，并展示该分类下的所有技能。

#### Scenario: 点击方案制作 Tag
- **WHEN** 用户点击「方案制作」Tag
- **THEN** 搜索框内容变为 `方案 制作`，技能列表展示所有 `intentGroup = planning` 的技能

#### Scenario: 点击配置生成 Tag
- **WHEN** 用户点击「配置生成」Tag
- **THEN** 搜索框内容变为 `配置 生成`，技能列表展示所有 `intentGroup = configuration-authoring` 的技能

#### Scenario: 点击配置核查 Tag
- **WHEN** 用户点击「配置核查」Tag
- **THEN** 搜索框内容变为 `配置 核查`，技能列表展示所有 `intentGroup = verification` 的技能

#### Scenario: 无 skill 的分类不会出现可点击 Tag
- **WHEN** 当前不存在 `intentGroup = configuration-authoring` 的 skill
- **THEN** 空结果状态下不展示「配置生成」Tag
