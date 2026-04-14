## Context

`local:question` 目前在后端以严格的 `fields | options` 契约创建待处理交互，并在前端工作台中渲染为问题卡片。该设计保证了结构化回答的可校验性，但有两个现实问题：

- `select` 问题没有统一的补充说明通道，用户只能提交主选项，无法稳定附带备注。
- 当模型把 `options` 生成为错误字符串时，运行时会暴露明确错误，但恢复链耗尽后当前行为是退化为普通 assistant 文本，导致交互模式切换、上下文丢失、用户不知道该填什么。

这次变更同时涉及 `apps/agent-backend` 的问题契约和失败恢复逻辑，以及 `apps/web` 的问题卡片渲染和交互提交，因此需要先明确交互协议与降级语义。

## Goals / Non-Goals

**Goals:**

- 为所有包含 `select` 的问题交互提供一个统一、独立、可选的 `notes` 补充字段。
- 保持主答案和补充说明语义分离：`select` / `answer` 是主答案，`notes` 只是补充说明。
- 在 `local:question` 结构化参数无效时，将当前 plain-text 降级改为显式问题交互卡片。
- 在降级卡片中保留原始 `prompt`、错误原因，以及可提取的参考选项文本，帮助用户继续输入。
- 仅对可证明无损的 `options` 字符串数组做显式规范化，并记录告警。

**Non-Goals:**

- 不引入“自定义主答案覆盖选项”的能力。
- 不对模糊或不完整的坏 `options` 字符串做静默猜测修复。
- 不改变现有 session、interaction、reply/reject 的整体生命周期。
- 不引入新的第三方依赖或新的顶层目录结构。

## Decisions

### Decision: 使用独立 `notes` 字段，而不是把自由文本并入主答案

`notes` 将作为问题交互中的稳定附加字段存在，并在所有包含 `select` 的问题中默认附带一个可选文本输入。这样可以让前后端都明确区分：

- 主答案：结构化选项或降级模式下的 `answer`
- 补充说明：`notes`

选择这个方案，而不是允许自由文本直接覆盖选项值，是为了避免语义冲突和后续 continuation 解析歧义。

备选方案：

- 永远附加普通匿名 text field：实现简单，但语义模糊，后续难以区分主答案与备注。
- 让 `notes` 作为 select 里的 “Other” 选项：会把补充说明和主答案耦合，不利于校验和恢复。

### Decision: 对 lossless 输入先显式规范化，再决定是否降级

后端在构建问题交互前增加一层窄范围规范化逻辑：

- 若 `options` 是合法 JSON 字符串数组，则解析后继续按正常结构化问题处理，并记录 warning。
- 若 `options` 不是合法数组字符串，只能提取出参考文本，则不做自动修复，直接进入降级问题交互。

选择这个方案，是为了兼顾可用性和 debug-first 原则。它只修复可证明无损的输入，不吞掉真正的模型输出缺陷。

备选方案：

- 永远严格失败：问题暴露清楚，但用户会被直接卡住。
- 对所有字符串启发式包裹 `[]` 再解析：能让更多坏输入“跑起来”，但会引入静默猜测，违背当前仓库约束。

### Decision: 将恢复耗尽后的退化形态改为“降级问题交互卡片”

当前行为是 plain assistant text。新行为改为创建一个显式 pending interaction，类型仍然是 question，但问题字段切换为：

- `answer`: 必填文本主答案
- `notes`: 可选补充说明

同时 payload 中保留：

- 原始 `prompt`
- 降级原因
- 从坏参数中尽量提取出的参考选项文本
- `degraded: true` 之类的稳定标记

这样可以保留现有 reply/reject/continuation 机制，也能让用户在统一的问题卡片中继续操作，而不是从交互式问题突然切回普通聊天。

备选方案：

- 维持 plain assistant text：实现最少，但丢失 structured interaction 的上下文和 UI 引导。
- 直接终止为 runtime failure：错误最显式，但用户体验最差，不符合本次目标。

### Decision: 前端将 `notes` 和降级上下文作为问题卡片的一部分渲染

前端不新增独立 modal 或额外交互流，而是在现有 `PendingQuestionCard` 中扩展渲染：

- 正常 `select` 问题显示主选择控件 + `notes`
- 降级问题显示说明文案、参考选项文本、文本 `answer` 字段 + `notes`

选择这个方案是为了复用当前待处理问题卡片、reply/reject 提交流程和会话恢复能力，避免把同一类阻塞交互拆成两套 UI。

## Risks / Trade-offs

- [Risk] `notes` 默认出现在所有 select 问题中，可能让部分简单问题显得更重。 -> Mitigation: 将 `notes` 设计为可选、简洁、单字段，并保持固定语义与轻量文案。
- [Risk] 降级问题若展示过多坏参数细节，可能让用户困惑。 -> Mitigation: 只展示用户可理解的参考选项文本和简洁原因，不暴露内部堆栈或控制元数据。
- [Risk] 规范化逻辑如果边界过宽，会重新引入静默 fallback。 -> Mitigation: 仅允许合法 JSON 字符串数组进入规范化，其他输入一律显式降级。
- [Risk] 现有 continuation 解析如果默认只理解旧问题字段，可能需要同步调整历史兼容路径。 -> Mitigation: 保持 question interaction 的整体外层协议不变，只扩展字段集合和 degraded 元数据。
