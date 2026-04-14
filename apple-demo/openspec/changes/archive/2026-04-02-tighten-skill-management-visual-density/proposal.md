## Why

当前 `Skill 管理` 页面虽然已经把字体层级向工作台基线收敛，但整体容器密度仍然停留在更松的“大卡片后台”尺度：左栏列表项过高、右栏 section 过厚、控件壳体偏大，导致“字变小但框更大”的失衡观感。现在需要把页面整体收口为更高密度的治理工作台，而不是继续单独调整字体。

## What Changes

- 以 **A2 列表态** 重做 `Skill 管理` 左栏列表项：选中项使用左侧强调条与轻量高亮，替代当前更厚的卡片/阴影选中态。
- 收紧左栏列表项的摘要行数、状态 pill 尺度、圆角、padding 和内部间距，使其从“内容卡片”收口为“扫描型治理列表项”。
- 同步收紧顶部 hero、左右主卡片、右栏 section、metadata strip、表单控件和 starter 预览卡的视觉密度，保证整页风格统一。
- 保持现有业务语义、治理流程、保存逻辑和运行时行为不变，本次仅调整信息呈现密度与状态表达。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-management`: `Skill 管理` 页面需要在不改变现有治理能力的前提下，提供更高密度的治理列表、轻量状态表达和更紧凑的详情面板布局。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/AdminSkillManagement.vue`
  - `apps/web/src/components/workbench/AdminSkillManagement.test.ts`
  - shared workbench surface styles consumed by the page if local density tokens are extracted
- APIs:
  - 无 API 或数据模型变更
- Dependencies:
  - 无新增第三方依赖
- Systems:
  - Skill 管理页面的工作台视觉密度、选中态表达、局部控件尺寸与响应式表现
