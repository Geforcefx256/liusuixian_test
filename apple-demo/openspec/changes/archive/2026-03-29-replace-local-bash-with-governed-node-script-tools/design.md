## Context

当前 `apps/agent-backend` 已经具备 governed skill surface、managed skill registry、approved skill 执行收口，以及 repo 内置 skill 资产目录。与此同时，repo 自带自动化脚本主要仍以 skill 包内的 Node/TS 脚本形态存在，但运行时真正对模型暴露的通用执行能力仍是 `local:bash`。一旦该工具被显式启用，模型就可以生成自由 shell 字符串，运行时只能依赖 deny list、tool policy 和 macOS seatbelt 沙箱去兜底。

这次变更的目标不是继续把 bash 模板藏进 `SKILL.md`，而是把 repo 内置技能自动化升级成运行时一等公民：受治理 skill 通过机器可读 `SCRIPTS.yaml` 声明固定脚本，运行时把这些脚本注册为单一 `skill:exec` 工具内的可调用模板，模型只负责选择模板并传递结构化参数。这样可以把执行边界从"shell 解释后再限制"前移到"注册前校验 + 调用前校验 + 固定入口执行"。

约束条件：

- 只覆盖 repo 自带 skill 包，不覆盖用户安装或上传的 skill。
- 只支持 Node 可直接执行的脚本入口；TypeScript 仅可作为源码形态，运行时入口必须是 Node 可执行产物。
- 必须保持 source/dist 两种运行模式下 canonical skill 资产仍可解析。
- 必须保持 governed skill approval 仍是技能与脚本暴露的授权来源。

## Goals / Non-Goals

**Goals:**

- 为 repo 自带 skill 引入独立于 `SKILL.md` 的机器可读脚本 manifest（`SCRIPTS.yaml`）。
- 让 runtime 将 approved skill 的脚本清单通过单一 `skill:exec` 工具暴露给模型，而不是注册 N 个独立工具。
- 将脚本执行收敛到固定 Node 入口、结构化参数校验、非 shell 模式启动。
- 将路径解析、输出注册和结构化结果识别收敛回 runtime，而不是交给脚本自行拼接用户输入。
- 保持 governed skill、approved skill 和 dist/source 资产解析的一致性。
- 彻底移除 `local:bash` 工具、sandbox 代码和所有相关配置。

**Non-Goals:**

- 不在本次支持用户安装/上传 skill 包的脚本执行。
- 不在本次保留"skill 文本里内嵌 shell 模板"的执行模型。
- 不在本次引入 Python、bash、Ruby 等多语言脚本运行器。
- 不在本次替换 gateway/MCP 工具体系，也不把外部服务调用迁移进 skill script provider。
- 不保留 legacy `local:bash` 代码路径或 sandbox 代码。

## Decisions

### 1. 每个 canonical skill package 使用独立 `SCRIPTS.yaml`，`SKILL.md` 只保留说明角色

每个 repo 自带 skill 包新增一个机器可读 `SCRIPTS.yaml` 文件，用于声明脚本列表、脚本标识、描述、Node 可执行入口、输入 schema、结果契约和超时配置。`SKILL.md` 继续只承载人类/模型阅读说明，不再作为命令模板或执行真相源。

选择这个方案，是因为现有 `SKILL.md` 已经承担 frontmatter + 指导文本双重角色，继续把可执行 shell 模板放进去，会让 canonical 文档与 runtime contract 混在一起，既难校验也难审计。

备选方案：

- 继续把执行模板放在 `SKILL.md` frontmatter 或正文中：被拒绝。人类说明和运行时契约耦合过深，且无法稳定表达结构化参数与结果。
- 每个脚本单独一个 manifest 文件：被拒绝。对少量 repo 自带 skills 来说过于分散，维护成本高于收益。

### 2. 使用单一 `skill:exec` 工具入口，而非每个脚本独立工具

所有受治理脚本模板通过一个 `skill:exec` 工具暴露。工具接受 `{ skillName, templateId, args }` 参数。工具描述只保留稳定调用契约，不再嵌入动态模板清单。模型需要先通过 `skill` 工具读取对应技能的 `SKILL.md` 了解业务约束、模板 ID 与调用顺序；运行时继续以 `SCRIPTS.yaml` 作为执行真相源。

选择单一入口，是因为：

- 工具数量不随 skill/script 增长而膨胀。LLM 在工具超过 15-20 个时选择准确率明显下降，当前已有 7 local + 4 skill + gateway + MCP 工具。
- 添加新 skill/script 不改变工具面。
- 与现有 `skill` 工具的分工更清晰——`skill` 承担说明与发现，`skill:exec` 只承载稳定执行契约。

备选方案：

- 每个 approved script 注册成独立工具：被拒绝。工具数膨胀影响 LLM 选择准确率，且每加一个脚本都需要改工具面。
- 统一一个 generic `run_script` 工具（既无 skill 上下文，也无 `SKILL.md` 发现链路）：被拒绝。模型需要先学会拼 `skillId/scriptId`，discoverability 太差。
- 在 `skill:exec.description` 中动态列出所有模板：被拒绝。description 字段应该表达稳定工具契约，不应承载随 approved skill surface 变化的动态数据；模板清单增长后也会造成 prompt 膨胀和上下文噪音。

### 3. 固定使用 Node 非 shell 启动脚本，模型不得控制 command/cwd/env

script tool 的执行器固定使用 Node 进程启动 canonical script entry，并关闭 shell 拼接能力。模型只能提供通过 schema 校验后的 JSON 输入，不得控制 `command`、`cwd`、`env` 或任意命令字符串。

执行层默认策略：

- `shell: false`
- 固定 Node 可执行入口
- 由 runtime 传入最小必要环境变量
- 由 runtime 设置超时
- 不接受模型自定义 env

备选方案：

- 保留 `bash -lc`，但命令字符串来自 manifest：被拒绝。即使来源受控，仍然保留 shell 解析层和注入面。
- 用 `tsx`/`ts-node` 直接执行 skill 下的 `.ts`：不作为默认方案。会把运行时和构建依赖绑得更深，也会扩大执行环境复杂度。

### 4. 路径解析与工作区边界校验由 runtime 负责，脚本只接收已解析输入

manifest 中的路径参数需要携带路径角色语义（`pathBase`），例如 `workspaceRoot`、`uploadsDir`、`outputsDir`、`tempDir`。调用前由 runtime 先完成 schema 校验与路径解析，再把绝对路径或受控路径信息传给脚本。

这样做，是把"路径是否越界""输出是否还在 `outputs/` 下""artifact 是否需要注册"这些系统边界收回 runtime，而不是让每个脚本重复实现路径安全逻辑。

备选方案：

- 让脚本自己处理用户传入的相对路径：被拒绝。脚本质量会变成最后一道边界，且难以统一审计。

### 5. 脚本结果统一使用结构化 stdout 契约

脚本 stdout 必须返回结构化 JSON，至少支持现有 runtime 已能理解的 artifact/reference/result 类型；stderr 仅用于日志和错误文本；非零退出码视为失败。这样 runtime 可以继续沿用现有 structured output 与 artifact registration 能力，而不是重新解析自由文本。

优先支持两类结果：

- 结构化 domain result，例如 `rows_result`
- `artifact_ref`，且路径必须落在当前工作区 `outputs/` 下

备选方案：

- 继续允许脚本输出自由文本再让模型解释：被拒绝。丢失 determinism，也会破坏现有 rich result 流程。

### 6. 一刀切移除 `local:bash` 和 sandbox

本次变更彻底删除 `local:bash` 工具注册、sandbox 代码（`src/runtime/tools/local/sandbox/`）、`runCommand.ts`、ConfigLoader 中 sandbox 配置段、所有 bash 相关测试。不保留 legacy 路径或配置开关。

理由：安全模型已从"沙箱兜底任意命令"转变为"命令结构性不存在"。`skill:exec` 通过固定 Node 入口 + 结构化参数 + 非 shell 执行，从根源消除了命令注入。保留 legacy bash 代码只增加维护负担和误启用的风险。

回滚策略：由于 `skill:exec` 是新增能力，回滚只需要停止注册 `skill:exec` 工具并重新引入 `local:bash`。但正常路径下不需要回滚，因为 repo 自带 skill 自动化已经完全迁移到新模型。

## Risks / Trade-offs

- **[Risk] 模板不再出现在 `skill:exec` 描述后，模型 discoverability 下降** → Mitigation：要求模型先通过 `skill` 工具加载 `SKILL.md`；技能文档中明确列出模板 ID、调用顺序与示例；运行时 description 也明确提醒先读 skill 再执行。
- **[Risk] 现有 skill 下的 `.ts` 脚本不能直接被 Node 运行** → Mitigation：将 runtime contract 限制为 Node 可执行入口；构建阶段编译或迁移现有脚本作为 rollout 任务显式处理。
- **[Risk] 移除 shell 后，脚本 bug 的影响范围等于 service user 权限范围** → Mitigation：仅允许 repo 自带脚本；runtime 负责路径解析、输出边界、无 shell 启动、固定 env、超时限制；继续建议服务进程使用最小权限账号运行。
- **[Risk] 单一 `skill:exec` 入口可能让模型混淆不同模板** → Mitigation：`templateId` 在 skill 内唯一；技能文档明确列出模板 ID、用途和调用顺序；LLM 先通过 `skill` 工具读取 `SKILL.md` 获取上下文，再选择正确的模板。
- **[Risk] source/dist 两套路径解析可能不一致** → Mitigation：将 script entry resolution 设计成 canonical asset 解析的一部分，并要求 dist 构建验证所有 registered script entries 可被运行时解析。

## Migration Plan

1. 为 repo 自带 skill 引入 canonical `SCRIPTS.yaml` 解析与 load-time 校验。
2. 在 `SkillToolProvider` 中新增 `skill:exec` 工具，仅对 governed + approved skills 开放脚本调用能力。
3. 新增固定 Node 脚本执行器，支持结构化输入、路径校验、超时、结构化 stdout 结果和 artifact 注册。
4. 迁移当前 repo 自带可执行 skill 脚本到统一契约，更新 `SKILL.md` 中 `allowed-tools` 从 `local:bash` 改为 `skill:exec`。
5. 删除 `local:bash` 工具注册、sandbox 目录、`runCommand.ts`、ConfigLoader sandbox 配置、所有相关测试。
6. 更新所有测试 fixtures，移除 sandbox/bash 引用，新增 manifest/executor 测试。

回滚策略：

- 停止注册 `skill:exec`，并重新引入 `local:bash` 注册。
- 在 git 层面，整个变更可以 revert。

## Open Questions

- 运行时入口是否要求 manifest 只指向 `.js/.mjs`，还是允许构建产物映射自 `.ts` 源文件后再执行？
- 本次是否需要把 script metadata 暴露到 admin skill API 中，还是先只在 runtime 内部消费？
