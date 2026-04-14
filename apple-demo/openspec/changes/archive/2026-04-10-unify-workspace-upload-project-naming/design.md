## Context

当前工作区语义分散在多层命名中：

- 前端展示使用 `upload / project`
- workspace group id 使用 `input / working`
- 文件 source 使用 `upload / output`
- 磁盘目录与 skill 路径使用 `uploads / outputs`
- `local:write` 与 governed skill artifact_ref 继续暴露 `outputs`

这导致几个问题：

- 前端需要维护翻译层，把后端 `input / working` 再映射成 `upload / project`
- 运行时打开文件后，模型拿到的 `activeFile.path`、`source` 与工具 schema 文案不一致
- governed skill 脚本和 `local:write` 仍在使用 `outputs` 概念，和 workbench 的 `project` 心智模型冲突
- 测试断言同时覆盖多套前缀，放大改动成本

这次改动是跨前端、后端、runtime tool、skill execution 的命名域重构，适合先形成统一设计后再实施。

## Goals / Non-Goals

**Goals:**

- 让工作区公共命名只剩一套：`upload / project`
- 统一 workspace group id、workspace file source、workspace-relative path、tool 契约和 script 契约
- 删除命名翻译层，使前端直接消费后端的 canonical naming
- 将运行时物理目录与 script path base 也切换到 `upload / project`

**Non-Goals:**

- 不提供旧命名兼容别名
- 不迁移或兼容历史 session metadata、历史 file-map 或历史脚本输出
- 不改变 `user + agent` 作用域隔离模型
- 不引入新的第三方依赖

## Decisions

### 1. `upload / project` 成为唯一 canonical naming

所有对外和对内运行时契约统一使用：

- group id: `upload | project`
- file source: `upload | project`
- workspace path prefix: `upload/...`、`project/...`
- route naming: `/files/project`
- tool wording: write to `project`

选择理由：

- `upload` 表示用户输入材料来源
- `project` 表示 agent 生成、编辑、组织的工作产物
- 这两个词已经是当前 UI 的用户心智模型

备选方案：

- 保留 `input / working` 作为 API，前端继续翻译
  - 拒绝，继续保留多套命名，只会让模型和维护者更混乱
- 只改文案，不改内部 contract
  - 拒绝，问题根源就是 contract 漂移，不是 copy 漂移

### 2. 物理目录和 file store 前缀一并重命名

文件存储目录也统一切到：

- `upload/`
- `project/`

`fileStore.getWorkspaceRelativePath()`、冲突路径、打开文件返回路径、artifact_ref 路径统一从这里产出，不再让 `uploads/outputs` 外溢。

备选方案：

- 只改公共 path，保留磁盘目录 `uploads/outputs`
  - 拒绝，这会继续留下内部和外部两套名词，script executor 与日志仍会泄漏旧词

### 3. governed skill script 契约同步重命名

governed skill script 的命名也一并切换：

- pathBase: `uploadDir | projectDir`
- environment variables: `WORKSPACE_UPLOAD_DIR`、`WORKSPACE_PROJECT_DIR`
- artifact_ref path prefix: `project/...`

这样 skill 脚本、runtime 校验、artifact 注册、LLM 可见结果都能与 workbench 命名保持一致。

备选方案：

- 仅把 artifact_ref 输出路径改成 `project/...`，脚本环境变量与 pathBase 保留旧名
  - 拒绝，脚本作者仍会看到旧词，不能算完全统一

### 4. 一次性切断旧命名，不做 silent fallback

本次改动直接移除：

- `input / working`
- `output / outputs`
- 前端的 group label normalization

不提供旧前缀兼容识别，也不保留双写逻辑。

备选方案：

- 双前缀兼容一个版本后再清理
  - 拒绝，用户已经明确暂不考虑历史数据和兼容路径，应直接切换

## Risks / Trade-offs

- [Risk] workspace API、前端 store、tool schema、skill executor 会同时变化，改动面大 → Mitigation: 先从 file store 定义 canonical naming，再逐层替换调用方和测试
- [Risk] 现有 canonical skill 脚本与测试样例依赖 `WORKSPACE_OUTPUTS_DIR`、`outputsDir`、`outputs/...` → Mitigation: 同一 change 内同步修改 skill assets、script validator、executor 和测试夹具
- [Risk] requirement 标题仍可能保留历史 `working` 术语以满足 OpenSpec delta 匹配 → Mitigation: 在 requirement 内容与实现层面统一为 `project`，不让旧命名继续进入代码契约
- [Risk] 如果只改部分 public contract，会留下新的混合状态 → Mitigation: 将 file store、routes、types、tool schema、skill contracts、frontend store 和测试作为同一批交付

## Migration Plan

1. 先重命名 file store 的 canonical group/source/path 生成规则与目录常量。
2. 随后重命名 runtime route、workspace metadata、write tool、skill executor 的公共契约。
3. 最后移除前端命名翻译层并更新所有测试断言到 `upload / project`。
4. 本次不做历史数据迁移；以新命名契约为唯一有效状态。

## Open Questions

- None.
