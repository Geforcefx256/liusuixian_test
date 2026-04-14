## Context

当前 runtime 的文件模型分裂成两套边界：

- `fileStore` 已经把上传文件与输出文件隔离在 `user + agent` scoped workspace 下。
- `read_file`、`find_files`、`list_directory`、`run_command` 仍然面向产品仓库根目录。
- LLM 侧文件上下文仍暴露 `fileKey` 与 `@file:<fileKey>` 句柄协议。
- 工作区编辑器当前允许把上传原件直接保存回 `uploads/`。
- `run_command` 仍是普通宿主机 `spawn`，仅通过 `cwd` 与参数规则限制行为，不具备真实沙箱边界。

这导致三个问题同时存在：

1. 模型的文件心智与真实用户工作区边界不一致。
2. 上传原件和运行时输出没有清晰的可写/只读边界。
3. 命令执行不能在安全上保证“只看当前用户工作区和只读 runtime”。

用户已经明确以下目标：

- 模型只理解当前用户工作区中的相对路径。
- 未知路径时先 `find_files`，明确需要内容时再 `read_file`。
- 上传原件不可覆盖；upload 文件只读查看，不允许保存。
- 同名上传必须先确认再覆盖。
- `bash` 的代码可以来自 skill/runtime 目录，但执行产物必须位于用户工作区。
- `bash` 必须在执行沙箱中运行，而不是普通宿主机进程。

## Goals / Non-Goals

**Goals:**

- 将模型侧文件协议收敛为 path-first workspace model。
- 让 `read_file`、`find_files`、`list_directory`、`write`、`bash` 都严格基于当前 `user + agent` 工作区。
- 将 `uploads/` 定义为只读输入区，将 `outputs/` / `temp/` 定义为可写产物区。
- 引入真实命令执行沙箱，隔离宿主机文件系统与网络。
- 保留前后端内部稳定文件标识，避免破坏工作区打开、保存、artifact 引用等现有 UI 机制。
- 更新提示词、技能和脚本约束，使其放弃 `fileKey/@file` 心智并转向路径协议。

**Non-Goals:**

- 重新设计整个工作区布局或会话 UI。
- 保持 `@file:<fileKey>` 对模型和 skill 的兼容。
- 为上传文件提供隐式“另存为 outputs 后再编辑”的自动兜底。
- 提供任意宿主机 shell 能力或联网命令执行。
- 引入用户可见的文件版本管理系统。

## Decisions

### 1. 模型侧文件协议改为路径优先，`fileKey` 退回内部实现细节

模型不再接收 `fileKey`、`@file:<fileKey>`、或整组自动注入的工作区文件句柄列表。运行时只在必要时向模型提供当前活动文件的工作区相对路径提示，其余文件由模型通过 `find_files` 自主发现，并在明确需要内容时再使用 `read_file`。

保留 `fileKey`，但只用于：

- 前端打开/保存工作区文件
- artifact 引用
- 工作区侧栏内部选择与恢复

不再把它当作 LLM 协议的一部分。

备选方案：

- 保留 `fileKey` 但同时再提供路径提示：拒绝。这样会让两套协议长期并存，继续污染 prompt 与 skill。
- 继续自动注入整个工作区文件列表给模型：拒绝。会增加 token 噪音，也会削弱“先找路径、再按需读取”的新规则。

### 2. 工作区文件系统改为显式分区：`uploads/` 只读，`outputs/` / `temp/` 可写

每个 `user + agent` 工作区使用稳定目录结构：

- `uploads/`: 用户上传原件，只读
- `outputs/`: 最终产物，可写
- `temp/`: 中间产物，可写
- `plans/`: 计划文档等运行时文件

上传时保留原始文件名。若同一路径已存在，后端必须要求显式覆盖意图，前端必须在用户确认后重试上传。不会使用自动改名，也不会静默覆盖。

备选方案：

- 同名上传自动改名：拒绝。用户已明确偏好确认后覆盖，且目标路径应保持稳定。
- 上传文件仍以 UUID 命名，再给模型虚拟路径：拒绝。会让模型看到的路径与真实落盘路径割裂，增加调试成本。

### 3. 上传文件在编辑器中只读打开，保存路由硬拒绝

工作区编辑器仍允许打开 upload 文件进行查看、MML 识别和继续处理，但 upload 文件必须带有只读元数据。前端据此禁用保存；后端保存接口也必须二次拒绝，防止绕过前端直接写入 `uploads/`。

备选方案：

- 保存 upload 文件时自动复制到 `outputs/`：拒绝。属于隐式副作用，用户容易误以为修改了原件。
- 继续允许 upload 原地保存：拒绝。与“上传原件不可覆盖”冲突。

### 4. `bash` 采用新的沙箱执行器，而不是继续复用宿主机 `spawn`

引入 `SandboxExecutor` 抽象，命令工具不再直接执行宿主机进程。新的模型是：

- `/runtime`：只读，提供 governed skill 脚本、参考文件、运行时依赖
- `/workspace/uploads`：只读
- `/workspace/outputs`：可写
- `/workspace/temp`：可写
- 网络默认关闭
- 宿主机其他目录不可见
- 执行受 CPU / 内存 / 时间限制

一旦环境中没有可用的沙箱后端，runtime 必须显式失败；不允许静默退回普通 `spawn`。

备选方案：

- 继续使用当前 `run_command` 并仅修改 `cwd`：拒绝。`cwd` 不是安全边界。
- 仅靠提示词约束输出路径：拒绝。用户已要求执行沙箱，这必须由运行时权限保证。

### 5. `bash` 脚本来源与结果位置彻底解耦

skill 脚本可以来自只读 `/runtime/skills/...`，参考文件可以来自只读 `/runtime/ref/...`，输入文件可以来自 `/workspace/uploads/...` 或 `/workspace/outputs/...`。但输出必须显式写入 `/workspace/outputs/...` 或 `/workspace/temp/...`。

脚本 contract 不再从输入文件名推导 file id，也不再依赖 `@file:<fileKey>`。统一使用路径参数与显式输出参数/环境变量，例如：

- `WORKSPACE_ROOT`
- `WORKSPACE_OUTPUTS_DIR`
- `WORKSPACE_TEMP_DIR`
- `RUNTIME_ROOT`

备选方案：

- 继续靠 `MML_FILE_OUTPUT_DIR` 这种单一环境变量维持旧脚本：拒绝。只能覆盖输出目录，不能表达只读 runtime、只读 uploads 与 path-first 输入协议。
- 让脚本自由决定输出位置：拒绝。会破坏“结果必在用户工作区”的强约束。

### 6. 模型侧命令工具采用 `bash` 语义，移除旧 `run_command` 心智

设计上把模型可见的命令执行工具收敛为 `bash` 语义，而不是延续 `run_command` 这个宿主机时代的命名。新名字更贴近模型使用方式，也能明确它是“在沙箱中执行命令”，而不是“对宿主机运行任意项目命令”。

备选方案：

- 保留 `run_command` 名称：拒绝。会继续携带旧的宿主机命令心智和 `@file` 契约遗留。

## Risks / Trade-offs

- [沙箱后端在不同开发/部署环境中的可用性不一致] → 通过 `SandboxExecutor` 抽象隔离实现；运行时启动或首次调用时显式校验可用性；无可用后端时快速失败，不提供宿主机 fallback。
- [去掉自动注入工作区文件列表后，某些任务会多一次 `find_files`] → 在提示词中明确“未知路径先查找”，并允许继续处理当前活动文件时提供单一路径提示。
- [保留原始文件名并允许确认覆盖后，旧引用会指向新内容] → 把覆盖定义为显式用户动作，并在前端和日志中明确“替换已有上传文件”。
- [上传文件只读可能让用户觉得编辑路径变长] → 前端明确展示只读状态；如未来需要“复制到 outputs 后编辑”，再作为单独显式能力新增。
- [skill 重写范围较大] → 先建立统一脚本 contract 与 sandbox env，再逐个迁移 governed skills，避免每个 skill 自定义一套路径/输出协议。

## Migration Plan

1. 定义新的 spec 合同：路径优先、上传只读、确认覆盖、sandbox `bash`。
2. 重构 runtime 文件模型与路由：
   - 上传保留原始文件名
   - same-name upload 要求显式覆盖意图
   - open payload 增加路径/只读信息
   - save 路由拒绝 upload 写入
3. 重构本地文件工具：
   - `find_files` / `read_file` / `list_directory` 根切到 scoped workspace
   - 模型文件上下文改为 path-first
4. 引入 `SandboxExecutor` 与 `bash` 工具：
   - 实现只读 runtime、只读 uploads、可写 outputs/temp、禁网和资源限制
   - 删除普通宿主机 `spawn` 路径
5. 重写受影响 skills 与脚本：
   - 移除 `@file:<fileKey>`
   - 改成路径参数与显式输出目录 contract
6. 更新前端：
   - upload 冲突确认
   - upload 文件只读查看
   - follow-up 请求只提交活动文件路径提示，不再自动提交整个工作区文件列表
7. 补齐后端、前端、skill 与集成测试。

回滚策略：

- 该变更应作为前后端与 runtime 一体发布。
- 若沙箱后端或路径合同在上线后出现阻断问题，回滚应回到前一个完整版本，而不是在运行时静默切回宿主机执行模型。

## Open Questions

- 首个受支持的沙箱后端具体选择什么实现：容器型后端、系统级隔离工具，还是平台分层适配？本 change 需要在实现前固定一个无 silent fallback 的方案。
- `bash` 工具的最终输入 contract 是只接受显式 `cmd + cwd + env whitelist`，还是允许更高层的结构化字段后再拼接命令？当前设计倾向前者，但实现阶段需要定稿。
