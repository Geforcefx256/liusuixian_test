## Context

当前工作区文件流已经支持上传、新建、打开、保存、下载和删除，但仍缺少显式重命名能力。后端的文件权威状态由 `fileStore` 统一维护，真实文件路径、内存索引与 `file-map.json` 需要保持一致；前端则以 `fileKey` 作为工作区文件的稳定 identity，在 Sidebar、已打开标签和编辑器缓存之间收敛状态。

这次变更跨越 `apps/agent-backend` 与 `apps/web`，同时涉及工作区 contract、文件持久化一致性以及前端 destructive action 约束，因此需要在实现前固定 rename v1 的边界：
- 仅允许修改 basename
- 不允许修改扩展名
- 不支持仅大小写变化的重命名
- legacy output 保留读取兼容，但不支持重命名
- 当前会话运行中，或目标文件存在未保存修改时，前端不允许删除或重命名

## Goals / Non-Goals

**Goals:**
- 为当前 `user + agent` 工作区提供显式文件重命名能力，覆盖 upload 文件与带 `relativePath` 的 output 文件。
- 保持文件 identity 稳定，rename 后不更换 `fileKey`、`fileId` 或 `createdAt`。
- 让后端在 rename 过程中保持磁盘文件、内存索引与 `file-map.json` 一致，并在持久化失败时回滚。
- 在前端工作区 Sidebar 的行级动作菜单中提供 rename 入口，并在 rename 成功后同步更新已打开编辑器的文件名与路径。
- 在前端阻止运行中或脏文件的 destructive actions，避免用户在高风险状态下继续删除或重命名。

**Non-Goals:**
- 不支持移动文件到新目录，不支持批量重命名。
- 不支持修改扩展名，不支持仅大小写变化的重命名。
- 不在本次变更中移除 legacy output 兼容代码。
- 不新增回收站、撤销删除、撤销重命名或自动冲突改名能力。

## Decisions

### Decision: 后端新增独立 rename API，而不是复用现有保存接口

后端将在现有 `/files/:fileKey` 路由组下新增 `PATCH /files/:fileKey/rename` 接口，body 仅接受新的 `fileName`。该接口继续复用当前 `requireUser` 与 `agentId` scope 解析逻辑。

Rationale:
- rename 和 save 语义不同，独立 endpoint 更清晰，也能避免后续在 `PUT /files/:fileKey` 混入额外分支。
- rename 需要专门的输入校验与冲突返回，不适合伪装成内容保存的一部分。

Alternatives considered:
- 复用 `PUT /files/:fileKey`：会让内容保存和文件命名变更共用一个入口，增加协议歧义。
- 用“删除 + 新建”模拟 rename：会破坏前端基于 `fileKey` 的稳定 identity，不符合当前工作区状态模型。

### Decision: rename 由 `fileStore` 单点实现，并以“改磁盘后持久化，失败则回滚”为一致性策略

`fileStore` 将新增公开 rename 方法，负责：
1. 解析 entry 与 scope
2. 将新名字规范化为 basename
3. 生成目标 `relativePath`
4. 检查同 scope、同 kind 下的路径冲突
5. 执行磁盘 `rename`
6. 更新内存 entry 的 `originalName`、`relativePath`、`storageExtension`
7. 持久化 `file-map.json`
8. 若持久化失败，则将磁盘文件改回旧路径，并恢复旧 entry

Rationale:
- 当前文件权威状态集中在 `fileStore`，rename 也应在这里完成，避免 route 层散落文件系统逻辑。
- 先改磁盘再持久化，失败时回滚，能让“真实文件路径”和 map 状态尽量保持一致，避免 map 指向不存在的新路径。

Alternatives considered:
- 先写 `file-map.json` 再改磁盘：一旦文件系统 rename 失败，metadata 会先漂移到新路径。
- 持久化失败后不回滚：会留下磁盘路径与 `file-map.json` 分叉的问题，排障成本更高。

### Decision: rename v1 只支持 path-addressed 文件，并显式拒绝超出边界的请求

后端会对以下情况返回显式错误，而不是尝试兼容：
- 新名字包含路径分隔符
- 新旧扩展名不同
- 新旧 basename 仅大小写变化
- 目标路径在同 scope、同 kind 下已存在
- output 缺失 `relativePath`，即 legacy output

对 output 文件，rename 只替换原 `relativePath` 最后一段 basename，保留目录不变；对 upload 文件，`relativePath` 直接替换为新 basename。

Rationale:
- 这样能让 Win/Linux 行为更稳定，也能避免 v1 误入“移动文件”或“格式切换”语义。
- legacy output 的展示名、磁盘路径和编辑器显示名并不完全等价，本次不值得为它扩大 rename 复杂度。

Alternatives considered:
- 支持修改目录：会把 rename 扩展为 move，超出这次范围。
- 支持仅大小写变化：跨平台差异明显，需要额外的临时名中转逻辑与测试。
- 同时删除 legacy 兼容代码：属于独立治理变更，不应与 rename v1 混做。

### Decision: 前端在 Sidebar 行级动作菜单中新增 rename，并以保守策略拦截 destructive actions

前端将在现有 `WorkspaceFileActionMenu` 中增加 `重命名` 入口，采用简单输入框/对话框收集新的 basename。成功后刷新 workspace metadata，并对已打开文件的编辑器状态做 metadata 原地更新，保留当前 buffer、dirty state 和 tab identity。

当前前端只有会话级 `isRunning` 信号，因此 v1 采用保守策略：
- 当前会话运行中时，统一禁止工作区文件的删除和重命名
- 某个文件存在未保存修改时，禁止对该文件执行删除和重命名

Rationale:
- 行级动作菜单已承载下载/删除，是最自然的重命名入口。
- 保持 identity 不变并原地更新 editor metadata，能避免 rename 后标签丢失或 buffer 被重建。
- 会话级运行拦截虽然偏保守，但比猜测“具体哪个文件正在运行中”更可靠，也更符合 v1 的实现复杂度。

Alternatives considered:
- 允许运行中继续 rename/delete 仅做确认：与已确认的产品决策冲突。
- 只在 UI 上隐藏入口，不在 store 层兜底：容易留下状态绕过路径。
- rename 后直接关闭并重开当前文件：会影响已有 buffer 与标签体验。

## Risks / Trade-offs

- [会话级运行拦截比“仅拦截真正被使用的文件”更保守] → v1 明确采用保守策略，后续若需要更细粒度判断，可单独扩展运行时文件占用模型。
- [rename 涉及磁盘文件、内存索引与 `file-map.json`，回滚链路比删除更复杂] → 将 rename 流收敛到 `fileStore` 单点实现，并补充持久化失败回滚测试。
- [legacy output 无法 rename 可能让少量历史文件体验不一致] → 当前保留显式错误与读取兼容，legacy 清理或迁移作为后续独立 change 处理。
- [前端需要同时刷新 workspace metadata 和已打开 editor metadata] → 通过稳定 `fileKey` identity 和 store 原地更新，避免把 rename 降级成“删除 + 新建”。

## Migration Plan

1. 先补后端 rename contract 与 `fileStore` 回滚测试，固定输入校验、冲突与持久化失败语义。
2. 再补前端 API 与 store 动作，落实 destructive-action 拦截与重命名成功后的状态收敛。
3. 最后接入 Sidebar 行级菜单交互与组件测试。
4. 本次变更不要求迁移现有 workspace 数据；已有 path-addressed 文件可直接使用 rename，legacy output 继续按现有兼容逻辑读取但不支持 rename。

## Open Questions

- None for v1. Legacy output 兼容清理将通过单独 change 讨论。
