# mml-cli-skill Specification

## Purpose
Define the governed `mml-generation` skill surface that lets the agent use the MML CLI and core capabilities through structured `skill:exec` calls.
## Requirements
### Requirement: mml-generation skill 定义
系统 SHALL 在 `apps/agent-backend/assets/skills/mml-generation/` 提供受治理的 MML skill 包，指导 Agent 调用统一的 MML CLI / core 能力。

#### Scenario: Skill 被发现和加载
- **WHEN** Agent-backend 启动并扫描 skills 目录
- **THEN** `mml-generation` skill 出现在可用 skill 列表中

### Requirement: Skill 内容仅包含使用说明
SKILL.md SHALL 仅包含 CLI 的使用指引（何时用、怎么用、参数格式），不包含任何 MML 规则数据。

#### Scenario: Skill 文件大小可控
- **WHEN** 读取 mml-generation 的 SKILL.md
- **THEN** 文件内容不超过 100 行，不包含特定网络类型的参数规范数据

### Requirement: Skill 通过 governed script 接入
系统 SHALL 在 `mml-generation` skill 包中提供 `SCRIPTS.yaml` 和对应脚本入口，使 Agent 通过 `skill:exec` 调用 MML 能力，而不是依赖裸 shell 命令。

#### Scenario: Skill 提供可执行模板
- **WHEN** Agent-backend 扫描 `mml-generation` skill 包
- **THEN** 该 skill 可声明一个或多个 `skill:exec` 可用的模板
- **AND** 模板输入使用结构化参数表达，而不是要求模型拼接 shell 命令字符串

### Requirement: Skill 指导 Agent 按规则目录流程操作
SKILL.md SHALL 描述 Agent 在规则目录相关场景下的标准调用流程。

#### Scenario: 生成命令流程
- **WHEN** Agent 需要生成 MML 命令
- **THEN** SKILL.md 指导 Agent 执行以下步骤：
  1. 查询可用网络类型和版本
  2. 查询指定网络类型版本的参数 schema
  3. 根据参数规范构造 MML 命令
  4. 验证命令是否符合规则

#### Scenario: 验证命令流程
- **WHEN** Agent 需要验证用户提供的 MML 命令
- **THEN** SKILL.md 指导 Agent 调用对应的验证模板并根据返回结果反馈

### Requirement: Skill 指导 Agent 查询业务 `.mml` 文件实例
SKILL.md SHALL 描述 Agent 使用 `mml file query` 能力查询业务 `.mml` 文件中的实际命令实例。

#### Scenario: 按条件查询实例命令
- **WHEN** Agent 需要查询某个业务 `.mml` 文件中满足条件的实际命令实例
- **THEN** SKILL.md 指导 Agent 提供文件路径、命令名和 `where` 条件
- **AND** 调用结果可返回原始命令文本

#### Scenario: 提取特定参数值
- **WHEN** Agent 需要从命中的业务命令实例中提取某个参数的实际值
- **THEN** SKILL.md 指导 Agent 使用 `select` 语义发起查询
- **AND** 调用结果以紧凑 JSON 形式返回，避免不必要的 token 开销
