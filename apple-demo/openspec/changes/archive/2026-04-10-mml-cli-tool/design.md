## Context

当前仓库中的 MML 能力并不在一个地方：

- `apps/web-backend/src/mmlRules/` 提供 Excel 规则导入、SQLite 存储与 schema 查询
- `apps/web/src/components/workbench/mmlSemantics.ts` 提供 MML 文本解析与基于 schema 的参数校验
- Agent 侧当前没有统一、离线、可脚本化的 MML 能力入口

这意味着，现有能力虽然能支撑前端工作台，但并没有形成一个稳定的程序化接口供 CLI、Agent 和后续自动化任务共同复用。

同时，业务侧不仅需要“规则查询”，还需要对实际业务 `.mml` 文件做实例查询，例如：

- 查询某个文件中所有 `ADD SGSLNK` 命令
- 查询 `ADD SGSLNK` 中 `IPTYPE=IPV4` 的实例
- 在命中的实例中提取特定参数的实际值
- 返回原始命令文本，便于直接复核或复用

因此，这个变更不应只被建模为“MML 规则 CLI”，而应被建模为“统一的 MML CLI”。

## Goals / Non-Goals

**Goals:**
- 提供独立的 `mml` CLI 工具，统一承载规则目录和业务 `.mml` 文件两类能力
- 为规则目录提供 schema 查询、规则库初始化和命令校验能力
- 为业务 `.mml` 文件提供命令实例查询、条件过滤和参数值提取能力
- 将现有分散在 web-backend 和 web 前端中的 MML 核心逻辑收敛为统一的 MML core 分层
- 遵循 agent 友好的 CLI 设计规范：结构化 JSON 输出、语义化 exit code、自文档化 `--help`
- 为 Agent 提供轻量 skill，通过 governed script 调用 CLI / core，不依赖裸 shell 命令

**Non-Goals:**
- 不修改 web-backend 的现有 HTTP API 和对外协议
- 不替换或迁移 web-backend 当前的规则目录 ownership
- 不在第一版中实现复杂表达式过滤（如 OR、正则、范围比较）
- 不在第一版中默认返回冗长的全量参数表、位置信息和 parse metadata

## Decisions

### D1: 新增 `cli-tools/` 顶层目录

**选择**: 在根目录新增 `cli-tools/`，每个 CLI 工具一个子目录。

**备选方案**:
- `tools/` — 语义过宽，与 `scripts/` 边界模糊
- `bin/` — 通常更适合构建产物，不适合源码
- `packages/mml-cli/` — 语义上更偏 package，而不是独立 CLI 工具集合

**理由**: `cli-tools/` 与现有 `apps/`、`packages/`、`scripts/` 的职责区分足够清楚，也为未来增加其他 CLI 工具保留了稳定结构。

### D2: 引入 MML core 分层

**选择**: 在 `cli-tools/mml/` 内部按逻辑划分统一的 MML core 分层：

- `contracts`：统一 schema / parse / validation / query 相关类型
- `catalog`：规则目录、SQLite 存储、schema 查询、Excel 导入
- `semantics`：MML 文本解析与基于 schema 的命令校验
- `instances`：业务 `.mml` 文件中的命令实例查询

**理由**:
- 规则目录能力和实例查询能力的数据源不同，但共享一组 MML 领域类型
- 仅复制 `web-backend/src/mmlRules/` 无法得到完整的 `validate` 能力，因为 MML 文本解析与实例级参数校验主要在前端 `mmlSemantics`
- 统一 core 分层可以避免 CLI、前端和 agent 后续再次各自复制逻辑

### D3: `validate` 来源于 semantics，而不是仅来源于 web-backend mmlRules

**选择**: `mml validate` 基于“解析 MML 文本 + 使用 schema 做参数校验”实现，核心能力来源于现有 `mmlSemantics` 逻辑，并抽入 MML core。

**理由**:
- `apps/web-backend/src/mmlRules/` 当前只覆盖规则导入、存储与 schema 查询
- 命令文本解析、duplicate/unknown param 检测、值校验、条件必选判断等能力已经存在于前端工作台语义层
- 如果只复制 web-backend 的 `store/service/importer`，CLI 的 `validate` 能力是不完整的

### D4: 规则目录继续与 web-backend 数据兼容

**选择**: CLI 使用与 web-backend 兼容的 SQLite schema，默认路径支持 `--db` 或 `MML_DB_PATH` 指定。

**理由**:
- 允许 CLI 直接读取 web-backend 已导入的规则数据库
- 避免重复导入同一批 Excel
- 保持现有数据结构稳定

### D5: SQLite 依赖与 web-backend 保持一致

**选择**: 使用 Node 22 内置 `node:sqlite`，不新增 `better-sqlite3`。

**理由**:
- 当前 web-backend 已基于 `node:sqlite`
- 避免引入新的 native dependency 和额外安装复杂度
- 与现有实现保持一致比追求”常见 CLI 依赖”更重要

### D6: 使用 `mml init` 替代 `mml import`，作为规则库初始化的唯一入口

**选择**: 提供 `mml init --dir <path>` 命令，扫描目录下所有 CHECK_RULE Excel 文件并全量导入到 SQLite 数据库，强制覆盖已有数据。去掉原有的 `mml import` 命令。

**备选方案**:
- 同时保留 `init` 和 `import` — 两个命令做同样的事，增加用户困惑
- 只保留 `import` — 语义偏增量式，不符合”部署后一次性初始化”的实际使用场景

**理由**:
- CLI 独立部署时，规则库初始化是部署后的第一步操作，`init` 的语义比 `import` 更明确
- 大多数使用 CLI 的场景不需要反复初始化，一次性操作用 `init` 更自然
- 部署包分发场景下（Excel 随包分发），`init` 是用户唯一需要知道的数据准备命令
- 保留两个功能相同的命令没有收益，去掉 `import` 减少认知负担

### D7: 新增 `mml file query` 命令，用于业务 `.mml` 文件实例查询

**选择**: 提供 `mml file query`，面向业务 `.mml` 文件做实例级查询，而不是继续将所有查询收拢到 `schema show`。

建议支持的参数：
- `--file <path>`：业务 `.mml` 文件路径
- `--command <name>`：命令名
- `--where <PARAM=VALUE>`：实例过滤条件，可重复，按 AND 语义处理
- `--select <PARAM>`：提取目标参数值
- `--text-only`：仅返回原始命令文本数组
- `--limit <n>`：限制返回命中数量

**理由**:
- 业务诉求是“查询文件里的实际命令实例”，不是“查询规则定义”
- `schema show` 面向规则目录，`file query` 面向业务文件，职责应分开
- 通过独立命令可以获得更稳定、更省 token 的输出契约

### D8: `file query` 默认返回紧凑 JSON，并保留原始命令文本

**选择**:
- 默认返回轻量 JSON
- 命中项至少保留：
  - `i`：语句序号
  - `text`：原始命令文本
- 若带 `--select`，额外返回：
  - `v`：选中参数的实际值
- 若带 `--text-only`，返回文本数组，不返回完整参数映射

**理由**:
- 业务希望直接看到实际实例化命令原文
- Agent 需要控制 token 占用
- 全量参数表、位置信息、parse metadata 虽然有用，但不适合作为默认输出

### D9: `--where` 第一版只支持简单等值匹配

**选择**:
- 仅支持 `PARAM=VALUE`
- 多个 `--where` 按 AND 处理
- 参数名匹配忽略大小写
- 参数值匹配默认忽略大小写
- 比较对象为解析后的显示值，而不是原始带引号 token

**理由**:
- 业务最常见的场景就是类似 `IPTYPE=IPv4`
- 默认忽略大小写更贴近人工使用习惯
- 先保持语法简单，避免第一版引入表达式解析复杂度

### D10: Agent 通过 governed skill script 接入

**选择**: 在 `apps/agent-backend/assets/skills/` 中新增 `mml-generation` skill，并通过 `SCRIPTS.yaml` + `skill:exec` 调用 CLI / core。

**理由**:
- 当前 agent runtime 面向模型暴露的是受治理的 `skill:exec`，而不是通用 shell
- `skill:exec` 的输入是结构化参数，更适合表达 `file / command / where / select` 这类查询
- 现有 `agent-backend` dist 组装流程已经支持 skill script 入口收集和打包

## Risks / Trade-offs

- **[逻辑收敛成本]** → 需要从 web-backend 和前端工作台两侧提取 MML 逻辑，短期比“纯复制 store/importer”更复杂，但长期更一致
- **[代码位置重排]** → 会引入新的 core 分层，初期需要额外测试来保证语义一致
- **[规则查询与实例查询并存]** → CLI 能力边界更广，命令分组和帮助文档需要设计清楚，避免用户混淆
- **[输出压缩与可读性平衡]** → 默认紧凑 JSON 更省 token，但也意味着某些调试字段需要通过显式选项获取
- **[新增顶层目录]** → 需要在 `pnpm-workspace.yaml` 中接入 `cli-tools/*`
- **[Agent 集成]** → 若希望在发布产物中使用该能力，需要把 skill script 和对应 runtime 入口纳入现有 `agent-backend` dist 流程
