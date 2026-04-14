## Context

当前 managed skill 只区分 canonical 元数据和治理后的展示名称/描述，首页 starter 卡片直接复用治理描述。对中文场景而言，这会让说明文承担两个互相冲突的职责：既要作为完整说明，又要作为高密度卡片摘要，最终导致快速开始区域在长文案下出现 CTA 被挤压、层级不清和管理端无法预览的体验问题。

这次变更会同时触达 `apps/agent-backend`、`apps/web` 的 skill 管理页和 workbench 空会话 starter 区域，属于跨模块的数据模型与展示协同变更，但不需要调整顶层目录结构，也不计划引入新依赖。

## Goals / Non-Goals

**Goals:**
- 为 managed skill 引入独立的 starter 卡片摘要治理字段，与完整展示描述分离。
- 让 skill 管理页能够明确治理“首页 starter 卡片”，并提供与 workbench 一致的低保真预览。
- 让 workbench starter 展示优先使用治理后的短摘要，并保证动作区不再受长文本裁剪影响。
- 定义稳定的字段回退与校验规则，使未补齐治理的 skill 仍可展示。

**Non-Goals:**
- 不重构 canonical `SKILL.md` 包格式，也不把 starter 摘要写回 canonical skill 包。
- 不引入按 Agent 维度单独维护 starter 摘要的能力，本次摘要字段保持 managed skill 级别。
- 不重做整个 workbench 搜索体验或 starter 分组模型。
- 不引入新的第三方依赖或字体体系。

## Decisions

### Decision: `starterSummary` 作为 managed skill 的独立治理字段

在 managed skill record、管理接口、目录接口中新增可选字段 `starterSummary`，其职责仅限首页快速开始卡片摘要。它与 `displayDescription` 并存，不互相覆盖。

Rationale:
- `displayDescription` 仍然承担完整说明职责，继续服务详情、搜索和治理列表。
- 主页 starter 卡片需要更短、更稳定的摘要语义，不能再依赖完整说明自然退化。
- 将字段放在 managed skill 层，能够复用已有治理链路而不污染 canonical skill 包。

Alternatives considered:
- 复用 `displayDescription`: 会继续混淆摘要和说明的职责。
- 从 `inputExample` 自动派生: 示例提问不稳定，也不适合作为卡片摘要。
- 按 Agent 绑定维护摘要: 能力更强，但显著增加治理复杂度，本次不需要。

### Decision: 管理端把 starter 治理提升为独立表单分组并提供预览

`AdminSkillManagement` 保留现有左右两栏布局，但右侧详情按治理目标重组为“基础展示”“首页卡片治理”“Agent 绑定治理”“保存操作”四段，其中首页卡片治理包含 `starterEnabled`、`intentGroup`、`starterPriority`、`starterSummary` 以及预览面板。

Rationale:
- 现有表单把 starter 字段和其他通用字段混在一起，管理员无法建立“这是首页卡片治理”的清晰心智。
- 预览可以把字段治理和最终呈现直接对齐，降低来回切回 workbench 验证的成本。
- 保留当前两栏框架可以控制改动范围，避免把 proposal 扩成全面重做。

Alternatives considered:
- 维持当前平铺表单: 改动最小，但无法解决治理目标不清的问题。
- 重做为多标签页或抽屉: 结构更重，超出本次问题范围。

### Decision: workbench starter 详情使用“摘要区 + 独立动作区”结构

workbench 空会话 starter 区域在技能被选中后，优先展示 `starterSummary`；若该字段为空，再回退到治理描述。摘要文本与启动动作必须分离到不同容器，动作区始终独立可见，不能共享单行裁剪规则。

Rationale:
- 这直接解决当前长中文文案挤压 CTA 的问题。
- 保持现有两步确认模型仍然可行，只需要把选中态的内容结构从“被裁剪的胶囊详情”改成“稳定的内容块 + 动作行”。
- 该结构也能为后续补充状态标签或说明入口留下空间。

Alternatives considered:
- 仅给按钮加宽: 只能缓解特定文案，不能从结构上保证稳定。
- 完全改成每个 skill 独立大卡片: 视觉更完整，但会显著扩大 workbench 空状态的重构范围。

### Decision: 使用固定回退链路和轻量校验，而不是阻断式强校验

starter 卡片摘要展示采用 `starterSummary -> displayDescription -> description -> inputExample` 的回退顺序。管理端允许 `starterSummary` 为空，但在启用 starter 且摘要缺失时给出提示；过长时给出长度警告，前端展示统一限制为两行。

Rationale:
- 这样能保证旧数据和未补齐治理的 skill 不会出现空卡片。
- 启用提示比强制阻断更适合渐进治理。
- 两行展示限制由 UI 兜底，避免单条摘要把布局再次撑坏。

## Risks / Trade-offs

- [新增字段贯穿前后端类型与接口] → 通过复用现有 managed skill 数据流和测试夹具，减少遗漏字段的风险。
- [摘要与完整说明可能出现内容不一致] → 在管理端预览中同时显示卡片结果，帮助管理员发现偏差。
- [starter 与搜索详情可能出现展示不一致] → 本次明确将 `starterSummary` 仅用于 starter 卡片，搜索和治理列表继续使用完整说明。
- [未填摘要的旧数据体验仍不理想] → 使用回退链路保证可用，并在 starter 治理区给出补齐提示。
