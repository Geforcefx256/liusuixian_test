## Why

`apps/agent-backend` 当前对受治理技能之外的自动化执行仍保留了通用 `local:bash` 模型：一旦显式启用，模型可以构造自由命令字符串，运行时只能再依赖 deny list、运行时策略和 macOS seatbelt 沙箱去兜底。这种模式把执行边界放在 shell 解释阶段，审计难、平台绑定强，而且与仓库已经内置的 canonical skill 资产和 Node/TS 脚本形态并不一致。

当前仓库已经具备 governed skill surface、approved skill 执行收口和 repo 自带脚本资产。现在需要把 repo 内置技能自动化统一收敛成"固定 Node 脚本 + 结构化参数"的运行时契约，让模型不再生成 shell，而只在已批准脚本清单内选择模板并传递 schema 校验后的参数。

## What Changes

- 新增 repo 内置受治理技能脚本执行能力：每个 skill 可声明机器可读脚本 manifest（`SCRIPTS.yaml`），由运行时将其注册为 `skill:exec` 工具的可调用模板。
- 规定 `SKILL.md` 仅作为给模型和人类阅读的说明文件，不再作为可执行命令模板或 shell 真相源。
- 规定运行时只允许执行 skill package 中预注册的 Node 脚本入口，且执行参数必须通过结构化 schema 校验。
- 规定运行时使用固定 `node` 入口和非 shell 模式执行脚本（`spawn(node, args, { shell: false })`），模型不得控制 `command`、`cwd`、`env` 或自由命令字符串。
- 新增单一 `skill:exec` 工具入口：模型通过 `skill:exec({ skillName, templateId, args })` 调用脚本模板，而非为每个脚本注册独立工具。工具描述仅保留稳定调用契约，不再内嵌动态模板清单。
- 统一 repo 内置脚本的输入输出契约，使结构化结果、artifact 注册和失败语义可由运行时稳定处理。
- **BREAKING** 彻底移除 `local:bash` 工具、`sandbox/` 目录及所有相关配置（sandbox config、deny list 条目、seatbelt profile）。不保留 legacy 路径。
- **BREAKING** `SKILL.md` 中的命令模板段落迁移至 `SCRIPTS.yaml`，`allowed-tools` 中 `local:bash` 替换为 `skill:exec`。

## Design Decisions

### 1. 独立 `SCRIPTS.yaml` 文件，与 `SKILL.md` 分离

`SKILL.md` 承载人类/模型阅读说明，`SCRIPTS.yaml` 承载机器可读执行契约。分离原因：两者校验语义不同、关注点不同，混合会导致文档膨胀和校验困难。

### 2. 单一 `skill:exec` 工具入口

所有受治理脚本模板通过一个 `skill:exec` 工具暴露，模型通过 `{ skillName, templateId, args }` 调用。工具描述只保留稳定契约，模板发现通过先加载对应 skill 的 `SKILL.md` 完成，运行时仍以 `SCRIPTS.yaml` 为执行真相源。

选择单一入口而非每个脚本独立工具，因为：
- 工具数量不会随 skill/script 增长而膨胀（LLM 在工具超过 15-20 个时选择准确率下降）
- 添加新 skill/script 不改变工具面
- 与现有 `skill` 工具分工清晰（`skill` 负责说明与发现，`skill:exec` 负责执行契约）

### 3. 一刀切移除 `local:bash` + sandbox

彻底删除 `local:bash` 工具注册、sandbox 代码、sandbox 配置，不保留 legacy 路径。

理由：安全模型已从"沙箱兜底任意命令"转变为"命令结构性不存在"。保留 legacy 代码增加维护负担和误启用的风险。

## Capabilities

### New Capabilities
- `governed-skill-script-execution`: 定义 canonical skill 脚本 manifest（`SCRIPTS.yaml`）、单一 `skill:exec` 运行时工具、结构化参数校验、固定 Node 脚本执行与结构化结果契约。

### Removed Capabilities
- `sandboxed-workspace-command-execution`: 完全移除。`local:bash`、sandbox 配置、macOS seatbelt 执行器不再存在。受治理脚本执行取而代之。

### Modified Capabilities
- `agent-backend-runtime`: 运行时 bootstrap、tool catalog、approved skill 执行路径和结构化输出契约从通用 `local:bash` 转向受治理脚本工具。彻底移除 sandbox 配置段和 `local:bash` 工具注册。
- `skill-management`: canonical skill package 新增 `SCRIPTS.yaml` 元数据，在受治理 surface 中保持 approved skill 与可执行脚本的一致性。

## Impact

- 影响 `apps/agent-backend` 的 runtime tool provider、skill catalog、managed skill governance、build phase 执行收口和结构化结果处理。
- 影响 `apps/agent-backend/assets/**/skills/**` 下 repo 自带技能包，需要补充 `SCRIPTS.yaml` 并更新 `SKILL.md`。
- 移除 `apps/agent-backend/src/runtime/tools/local/sandbox/` 整个目录、`runCommand.ts`、`bashInputSchema`、ConfigLoader 中 sandbox 配置段。
- 影响 `src/index.ts`、`src/runtime/bootstrap.ts`、`src/routes/gateway.ts` 中 `createDefaultToolProviderRegistry()` 调用。
- 影响现有测试，需要移除 sandbox/bash 相关 fixtures 和用例，新增 manifest/executor/exec-dispatch 测试。
