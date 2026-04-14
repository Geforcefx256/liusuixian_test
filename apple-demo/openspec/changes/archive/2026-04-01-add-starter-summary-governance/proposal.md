## Why

当前首页 starter 卡片直接复用治理描述，中文长文案会挤压 CTA 并削弱信息层级；同时 skill 管理页缺少专门的首页卡片治理心智，管理员无法为 starter 场景维护短摘要并预览最终呈现效果。现在需要把“完整说明”和“首页卡片摘要”分离，避免工作台快速开始区域继续受长文案约束。

## What Changes

- 为纳管 skill 增加独立的 starter 卡片摘要治理字段，用于首页快速开始卡片展示，不替代完整展示描述。
- 调整 skill 管理页信息架构，将首页 starter 治理从通用表单中独立成分组区域，并增加 starter 卡片预览。
- 调整 workbench 空会话 starter 卡片展示，优先使用治理后的短摘要，并保证 CTA 不再与摘要共用易裁剪的容器规则。
- 定义 starter 摘要的回退策略和校验规则，确保治理未补齐时页面仍有稳定展示。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `skill-management`: managed skill governance needs a dedicated starter summary field, starter-card preview, and admin editing rules for starter surfaces.
- `agent-web-workbench`: empty conversation starter cards need to display governed starter summaries and preserve a stable action area for long Chinese content.

## Impact

- Affected code: `apps/agent-backend` managed skill types/routes/service, `apps/web` skill management UI, workbench starter card rendering, related tests.
- APIs: managed skill list/update payloads need to carry the governed starter summary field.
- Dependencies: none expected.
