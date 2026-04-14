## Why

当前 `Skill 管理` 视图中的治理详情页被放在受限于视口高度的 workbench shell 内，但详情区域没有承担自己的滚动职责，导致长内容在浏览器中被裁切，管理员无法通过滚轮查看完整的首页卡片治理表单与预览信息。这个问题已经直接影响治理操作的可达性，必须先修复界面布局约束，避免管理功能在真实屏幕尺寸下不可用。

## What Changes

- 修复 `Skill 管理 -> 治理详情` 页面在视口受限场景下的滚动行为，让长表单内容可以在壳层内完整访问，而不是被外层容器裁切。
- 收敛治理详情页左右分栏的高度与溢出职责，明确列表区与详情区各自的滚动容器，避免“只能展示一半且滚轮无效”的状态。
- 调整首页卡片治理区在常见桌面宽度与窄屏宽度下的布局，使 `Starter 摘要与预览` 区域不会因为栅格压缩而超出可视范围。
- 增补前端样式/组件测试，覆盖管理页最小高度链路、明细区滚动出口和窄屏栅格回落行为。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-management`: 技能治理详情界面需要补充可滚动的详情区和稳定的响应式布局，确保首页卡片治理内容在受限视口内仍然完整可见且可操作。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/AdminSkillManagement.vue`
  - `apps/web/src/components/workbench/WorkbenchShell.vue`
  - related frontend unit tests
- APIs:
  - 不修改现有 managed-skill 读写接口或请求负载
- Dependencies:
  - 无新增第三方依赖
- Systems:
  - 前端 `Skill 管理` 视图的布局、滚动链路与响应式展示
