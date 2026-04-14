## Why

当前工作台把“新建会话”和“历史会话管理”都压在最左侧 hover 展开的窄侧栏里，导致高频入口依赖额外悬停动作，历史预览也因为空间过窄而退化成低价值的一字摘要。与此同时，顶部项目品牌与会话区“小曼智能体”身份分离，用户需要在两个位置理解同一个主体，增加了认知负担。

这次调整要把会话入口、历史入口和“小曼”身份收敛到同一条主操作带上，在不改变后端会话契约的前提下，提升工作台可见性、降低交互层级，并删除已经没有有效信息密度的历史预览噪音。

## What Changes

- 删除工作台左侧 `SessionRail` 式悬浮历史侧栏，不再把新建会话和历史会话入口放在独立窄轨道中。
- 融合项目 logo 与“小曼智能体（MML 配置助手）”身份表达，形成统一的主身份区，避免品牌区和智能体区割裂。
- 将“新建会话”和“历史会话”动作迁移到融合后的主身份区后方，改为显式可点击入口，而不是依赖 hover 展开。
- 将原历史会话展开面板重构为由“历史会话”入口显式打开的历史管理视图，只保留搜索框、历史任务列表和删除能力。
- 移除历史列表中低价值的预览文案展示，不再为每条会话保留仅能显示单字或无意义摘要的 preview 区域。
- 保持现有会话创建、会话切换、会话删除和批量清空历史的后端 API 与 store 语义不变；本次只调整前端工作台壳层与历史入口交互。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 调整工作台会话入口、历史管理入口和智能体身份展示要求，将历史 rail 改为主身份区显式入口，并将历史管理视图收敛为搜索加列表加删除的简化页面。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/WorkbenchShell.vue`
  - `apps/web/src/components/workbench/ConversationPane.vue`
  - `apps/web/src/components/workbench/SessionRail.vue` or its replacement surface
  - related workbench tests
  - shared workbench styles in `apps/web/src/styles.css`
- APIs:
  - 不修改现有 `/agent/api/agent/sessions/*` 会话相关接口
- Dependencies:
  - 无新增第三方依赖
- Systems:
  - 仅影响 `apps/web` 的工作台壳层布局、历史会话入口交互和前端测试基线
