## Context

`skill-metadata-foundation` 是 `plan-agent-skill-runtime-evolution` 中的第一个 follow-on change。当前 `apps/agent-backend` 已有 canonical `SKILL.md` frontmatter parser、skill catalog、managed registry，以及 agent detail / execution catalog 两条 metadata 暴露链，但它们只覆盖 `id`、`name`、`description`、`inputExample`、`outputExample`、`allowed-tools` 这一小部分字段，而且命名风格不统一。

这会直接卡住后续 change：

- `skill-discovery-and-listing` 需要稳定的 skill metadata contract 才能决定 listing 输入。
- `skill-invocation-policy` 需要稳定的 `user-invocable`、`disable-model-invocation`、`allowed-tools` contract 才能把这些字段接入权限边界。
- `skill-runtime-overrides-and-forking` 需要稳定的 `model`、`effort`、`context` contract 才能安全引入运行时语义。

因此 foundation 的职责不是“让字段生效”，而是先定义“哪些字段存在、叫什么、如何校验、默认是什么、如何一路透传到运行时数据面”。这个 change 同时还要把 canonical metadata 和 managed/governed metadata 的边界钉死，避免 `displayName`、`displayDescription` 一类治理字段重新混回 `SKILL.md`。

## Goals / Non-Goals

**Goals:**
- 为 canonical `SKILL.md` frontmatter 定义一套正式 metadata contract。
- 统一 canonical frontmatter 的命名规范，并对多词字段采用单一写法。
- 为 required / optional / forbidden 字段定义校验和缺失语义。
- 将新增 canonical metadata 从 parser 透传到 catalog、managed registry、agent detail、execution catalog。
- 更新仓库内 bundled `SKILL.md` 文档，使其与新 contract 保持一致。
- 保持 managed registry 对用户可见治理字段的权威性，不让 canonical package 吸收这些字段。

**Non-Goals:**
- 不在本 change 中让 `allowed-tools` 真正进入工具权限链。
- 不在本 change 中让 `user-invocable` 或 `disable-model-invocation` 改变调用策略。
- 不在本 change 中让 `model`、`effort` 改变模型选型。
- 不在本 change 中让 `context` 改变 skill 执行模式或触发 fork。
- 不在本 change 中引入 listing 预算、条件激活、compaction 保留、provider abstraction。
- 不在本 change 中重做 `agent-backend` skill 管理页面的整体前端样式或布局。

## Decisions

### Decision: canonical `SKILL.md` 的多词 metadata 统一采用 kebab-case

foundation 将 canonical frontmatter 的多词字段统一为 kebab-case，避免继续沿用 camelCase、snake_case、kebab-case 混用。首批 canonical metadata 集合固定为：

- required: `id`, `name`, `description`
- optional: `when-to-use`, `input-example`, `output-example`, `allowed-tools`, `user-invocable`, `disable-model-invocation`, `model`, `effort`, `context`

其中单词字段继续保持单词写法，只有多词字段做 kebab-case 统一。

Rationale:
- 当前仓库已经有 `allowed-tools`，沿着文档友好的 frontmatter 风格继续收敛，比引入 camelCase 更一致。
- 用户已经明确要求“全部新字段统一”，同时接受更新现有 repo 内 `SKILL.md`。
- 这样可以明确区别“canonical frontmatter contract”与“内部 TypeScript/JSON camelCase 镜像字段”。

Alternatives considered:
- 继续接受 `inputExample` / `when_to_use` / `allowed-tools` 混用。
- 把 canonical frontmatter 改成 camelCase。

Why not:
- 混用会把 foundation 变成兼容债务层，后续每个 change 都要重复处理旧别名。
- camelCase 不符合当前 `SKILL.md` frontmatter 已经存在的 kebab-case 基调。

### Decision: 对 canonical parser 采用硬切换，不兼容旧多词字段名

foundation 生效后，canonical parser 只接受新的 canonical 字段名，不再把 `inputExample`、`outputExample`、`when_to_use` 等旧命名当作同义字段读取。仓库内 bundled `SKILL.md` 与后续上传包都必须满足新写法。

Rationale:
- 用户已经明确选择 hard cutover，而不是兼容旧字段名。
- 如果在 foundation 保留别名，后续 spec 和实现会长期背负“真实 canonical 字段到底是哪一个”的歧义。

Alternatives considered:
- parser 同时接受新旧字段，再在输出时归一。

Why not:
- 这会让 foundation 无法真正收敛 contract。

### Decision: optional metadata 缺失时按“未声明”处理，而不是合成行为默认值

foundation 只定义 metadata 存在性和透传语义，不提前注入运行时策略。因此新增 optional metadata 在缺失时统一按“未声明”处理：

- parser 不报错
- catalog / registry / runtime surface 省略对应字段
- 不因为字段缺失而自动推断启用、禁用、fork、模型切换等行为

`id`、`name`、`description` 仍然是唯一 required canonical identity fields。

Rationale:
- 用户已明确表示新增字段允许不填写，技能仍应是合法 canonical skill。
- 这能把 foundation 和后续行为型 change 干净分层。

Alternatives considered:
- 为 `user-invocable`、`disable-model-invocation`、`context` 提前分配运行时默认值。

Why not:
- 这会把“schema contract”偷渡成“runtime policy”。

### Decision: governed 字段继续只属于 managed registry，不得进入 canonical `SKILL.md`

foundation 明确 canonical 与 governed 的边界：

- canonical `SKILL.md` 只允许表达 skill 自身 metadata
- managed registry 继续独占治理字段，例如 `displayName` / `displayDescription` 对应的用户可见展示字段，以及 starter / lifecycle / binding 一类产品治理字段
- canonical parser 必须拒绝已知 governed 字段进入 `SKILL.md`

Rationale:
- 用户已明确同意 `displayName/displayDescription` 这类 governed 字段不进入 canonical `SKILL.md`。
- 这能避免 canonical package 被产品表面治理需求污染。

Alternatives considered:
- 允许 canonical skill 携带受治理展示字段，再由导入时选择性忽略。

Why not:
- 这会模糊 canonical body 和 managed governance 的权责边界。

### Decision: 透传路径固定为 parser -> catalog -> managed registry -> agent detail / execution catalog

foundation 的 metadata 扩展遵循单一路径：

1. `frontmatter.ts` 负责 canonical 解析和校验。
2. `catalog.ts` 建立 canonical skill entry 的内部镜像。
3. `managedRegistry.ts`/`managedTypes.ts` 同步可镜像的 canonical metadata，但不改变 governed 字段所有权。
4. `agents/service.ts` 和 `agent/types.ts` 通过 agent detail / execution catalog 暴露这些 metadata。

这个 change 不修改 `chatOrchestrator`、planning prompt、skill listing prompt 或 compaction 链路。

Rationale:
- 用户认可 parser -> catalog -> registry -> API data surface 的透传路线。
- 这条路径覆盖了 foundation 所需的数据面，同时避免碰行为链。

Alternatives considered:
- 直接从 parser/canonical asset 读取 `SKILL.md`，由下游调用方各自解析。
- 跳过 managed registry，只在 agent detail 临时拼接 metadata。

Why not:
- 前者会重复解析并破坏 contract 单点。
- 后者会让 managed skill 数据模型与 runtime surface 脱节。

### Decision: internal mirror 保持 repo-native camelCase，但与 canonical 字段一一映射

canonical frontmatter 统一用 kebab-case；内部 TypeScript 类型与 JSON payload 继续沿用现有 repo-native camelCase 风格。示例：

- `when-to-use` -> `whenToUse`
- `input-example` -> `inputExample`
- `output-example` -> `outputExample`
- `disable-model-invocation` -> `disableModelInvocation`
- `allowed-tools` -> `allowedTools`

Rationale:
- 仓库现有运行时代码和 API 类型已经是 camelCase。
- 保持内部命名风格稳定，可以把这次 change 聚焦在 canonical contract，而不是扩大成全链路命名重构。

Alternatives considered:
- 让 API / internal types 也直接暴露 kebab-case。

Why not:
- 这会扩大改动面，并把一个 metadata foundation change 变成 repo 级别的命名迁移。

## Risks / Trade-offs

- [Risk] hard cutover 会让旧 canonical `SKILL.md` 在 parser 升级后直接失效  
  → Mitigation: 在本 change 内同时更新仓库内 bundled `SKILL.md`，并在 spec 中把旧字段不再被接受写成显式 contract。

- [Risk] 把过多字段纳入 foundation 会让后续 change 看起来范围变小，但实现边界更模糊  
  → Mitigation: 只纳入 metadata contract 本身，不纳入 `agent`、`paths`、`shell`、listing activation、policy enforcement 等行为型议题。

- [Risk] runtime surface 开始返回更多 metadata 后，调用方可能误以为这些字段已经生效  
  → Mitigation: 在 runtime spec 中明确这是 passthrough-only metadata，缺失字段不合成策略，存在字段也不改变当前行为。

- [Risk] managed registry 新增 canonical mirror 字段可能触发持久化版本升级  
  → Mitigation: 将 registry 版本迁移限定在 metadata 字段扩展，不改变 lifecycle / binding / starter 语义，并保持可从 catalog 重建 mirror 字段。

## Migration Plan

1. 扩展 canonical frontmatter parser 和 skill catalog 类型，建立新的 metadata contract。
2. 扩展 managed registry mirror 字段与持久化结构，让 canonical metadata 能被稳定同步。
3. 扩展 agent detail / execution catalog 的 metadata 暴露类型和序列化逻辑。
4. 更新仓库内 bundled `SKILL.md` 到新 canonical 字段名。
5. 通过 spec 和测试验证：required 字段、optional 缺失、forbidden governed 字段、旧字段硬切换、runtime passthrough。

Rollback strategy:
- 若实现阶段需要回退，只需回滚本 change 的 parser/type/registry/schema 变更和 bundled skill 文档更新。
- 本 change 不引入新的 runtime policy，因此不涉及线上行为型回滚链。

## Open Questions

- 当前没有阻塞本 change 的开放问题。后续关于 `allowed-tools` enforcement、`user-invocable` / `disable-model-invocation` policy、`model` / `effort` 执行语义、`context=fork` 执行链路，应下沉到各自 follow-on change。
