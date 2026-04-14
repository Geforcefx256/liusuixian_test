## Context

当前中文文件名乱码并不是前端渲染问题，也不是 `fileStore` 持久化层对 Unicode 不兼容。现有链路中，前端上传文件后，后端路由直接把 `req.file.originalname` 传给 `fileStore.writeUpload()`，后续 workspace metadata、打开文件 payload 和磁盘路径也都继续透传这个值。仓库中已有其他中文工作区路径可以正常存在，说明问题集中在 multipart 文件名进入运行时的第一跳。

本仓库当前使用 `multer@2.1.1`。其默认 `defParamCharset` 为 `latin1`，而 multipart `filename` 参数常由浏览器以 UTF-8 字节表达；当后端按 `latin1` 解释这些字节时，就会得到 `ä¸­æ.csv` 这一类乱码。由于根因已经明确位于上传边界，本次设计应优先在解析入口修正，而不是在后续 `fileStore`、前端 store 或展示层引入额外修补逻辑。

## Goals / Non-Goals

**Goals:**
- 让新的工作区上传在遇到中文等 UTF-8 文件名时保持原始可读文件名。
- 保证上传响应、工作区列表和后续打开文件 payload 中的文件名一致且可读。
- 将修复限制在 `apps/agent-backend` 上传边界与后端测试范围内，不扩大到无关前端改动。
- 保持 debug-first 原则，不增加静默 fallback、猜测性转码或历史数据自动修复。

**Non-Goals:**
- 不迁移或自动修复历史上已经存储为乱码的工作区文件。
- 不修改 `/agent/api/files/upload` 的响应结构，也不改动现有 workspace payload 结构。
- 不新增依赖、不升级 `multer` 或其他第三方库版本。
- 不改变当前工作区按 `user + agent` 隔离和复用的存储模型。

## Decisions

### Decision: 在 multer 初始化处显式声明 UTF-8 文件名参数解码

后端将在 `apps/agent-backend/src/routes/files.ts` 的 `multer(...)` 初始化中显式传入 `defParamCharset: 'utf8'`，让 multipart `filename` 参数在被写入 `req.file.originalname` 之前就按 UTF-8 解释。

Rationale:
- 根因就在上传解析边界，最小修复面就是在这里修正默认行为。
- 这样可以让后续 `fileStore`、workspace metadata 和 open-file contract 继续使用同一条现有数据流，无需引入额外补丁。
- 该方案不会改变 endpoint shape，也不会影响已有调用方。

Alternatives considered:
- 在 `fileStore` 中检测并反向修正乱码文件名：这会把 HTTP 上传边界错误扩散到持久化层，并引入猜测性转码。
- 在前端显示层做乱码回修：不能修复磁盘路径和后端 metadata，且会制造前后端状态不一致。

### Decision: 维持现有工作区文件名透传模型，不增加兼容分支

本次不改 `fileStore.writeUpload()`、`AgentService.listWorkspaceFiles()`、`openWorkspaceFile()` 的 contract，只让它们继续透传已经被正确解码的文件名。

Rationale:
- 现有后续链路本身没有编码问题，问题只是输入值已经坏掉。
- 保持 contract 不变可以把修复控制在单一入口，降低回归风险。

Alternatives considered:
- 为文件名增加新的编码字段或“原始文件名/显示文件名”双字段：会扩大 contract 变更范围，但对当前问题没有必要。

### Decision: 只为新上传行为补回归测试，不做历史乱码迁移

测试将覆盖中文文件名上传后的响应 payload、workspace metadata 和打开文件 payload，确保新上传文件名在用户可见链路中保持一致；历史乱码文件维持现状，不做自动迁移。

Rationale:
- 用户已经明确本次不处理历史乱码文件。
- 只校验新上传行为，能让测试直接锚定修复目标而不引入额外数据迁移复杂度。

Alternatives considered:
- 增加启动时扫描和批量重命名迁移：风险高、范围大，而且不在本次需求内。

## Risks / Trade-offs

- [某些客户端若显式发送非 UTF-8 且未声明扩展参数，文件名仍可能不符合预期] → 本次以浏览器 workbench 上传主路径为准，按 UTF-8 作为明确支持的默认 contract。
- [历史乱码文件继续存在，用户在同一工作区中会看到新旧文件名质量不一致] → 在 proposal 中明确非目标，不在实现里做隐式修复。
- [上传边界修复后，测试若仍只覆盖 ASCII 文件名，将难以防止回归] → 增加中文文件名专门回归测试。

## Migration Plan

1. 在上传路由设置 UTF-8 文件名参数解码并保留现有文件校验与 scope 逻辑。
2. 为工作区上传流补充中文文件名回归测试。
3. 运行受影响的 `agent-backend` 测试，确认新上传行为通过。
4. 部署后仅新的上传文件受益；若需修复历史乱码文件，应另开独立 change。

## Open Questions

- None at proposal time.
