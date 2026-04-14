# mml-cli-tool Specification

## Purpose
Define the standalone MML CLI behavior for schema catalog access, rules initialization, command validation, and business `.mml` file instance query.
## Requirements
### Requirement: CLI 工具目录结构
系统 SHALL 在根目录提供 `cli-tools/` 目录，每个 CLI 工具作为独立子目录，包含 `src/`（源码）和 `dist/`（编译产物）。

#### Scenario: pnpm workspace 识别 CLI 工具
- **WHEN** `pnpm-workspace.yaml` 包含 `cli-tools/*`
- **THEN** 每个 `cli-tools/<name>/` 下的 package.json 被识别为 workspace 成员

### Requirement: mml schema list 命令
CLI SHALL 提供 `mml schema list` 命令，列出所有可用的网络类型及其版本。

#### Scenario: 正常列出 schema 列表
- **WHEN** 执行 `mml schema list --json`
- **THEN** 输出 JSON 到 stdout，格式为 `{ "networkTypes": string[], "networkVersionsByType": Record<string, string[]> }`
- **AND** exit code 为 0

#### Scenario: 数据库文件不存在
- **WHEN** 执行 `mml schema list` 且指定的数据库文件不存在
- **THEN** 输出错误信息到 stderr
- **AND** exit code 为 3（resource not found）

#### Scenario: 静默输出模式
- **WHEN** 执行 `mml schema list --quiet`
- **THEN** 每行输出一个 "网络类型:版本" 组合，无其他装饰

### Requirement: mml schema show 命令
CLI SHALL 提供 `mml schema show --type <type> --version <version>` 命令，返回指定网络类型和版本的完整 schema。

#### Scenario: 查询存在的 schema
- **WHEN** 执行 `mml schema show --type AMF --version 20.9.2 --json`
- **THEN** 输出 JSON 到 stdout，包含 `networkType`、`networkVersion`、`commands` 数组
- **AND** 每个 command 包含 `commandName` 和 `params` 数组
- **AND** exit code 为 0

#### Scenario: 查询不存在的 schema
- **WHEN** 执行 `mml schema show --type UNKNOWN --version 0.0.1`
- **THEN** 输出错误信息到 stderr，提示未找到匹配的规则集
- **AND** exit code 为 3（resource not found）

#### Scenario: 缺少必填参数
- **WHEN** 执行 `mml schema show` 不带 --type 或 --version
- **THEN** 输出 usage 信息到 stderr
- **AND** exit code 为 2（usage error）

#### Scenario: 过滤特定命令
- **WHEN** 执行 `mml schema show --type AMF --version 20.9.2 --command "ADD UE" --json`
- **THEN** 仅返回匹配的命令 schema，不返回全部命令

### Requirement: mml validate 命令
CLI SHALL 提供 `mml validate --type <type> --version <version> --command "<mml>"` 命令，验证 MML 命令是否符合规则。

#### Scenario: 验证通过的命令
- **WHEN** 执行 `mml validate --type AMF --version 20.9.2 --command "ADD UE:..." --json`
- **AND** 命令符合该网络类型版本的参数规则
- **THEN** 输出 `{ "valid": true, "command": "ADD UE", "errors": [] }` 到 stdout
- **AND** exit code 为 0

#### Scenario: 验证失败的命令
- **WHEN** 执行 `mml validate` 且命令不符合规则
- **THEN** 输出 `{ "valid": false, "command": "...", "errors": [{ "param": "...", "message": "..." }] }` 到 stdout
- **AND** exit code 为 1（validation failure）

#### Scenario: 未知命令名
- **WHEN** 执行 `mml validate` 且命令名不在 schema 中
- **THEN** 输出 `{ "valid": false, "command": "...", "errors": [{ "message": "unknown command" }] }` 到 stdout
- **AND** exit code 为 3（resource not found）

### Requirement: mml init 命令
CLI SHALL 提供 `mml init --dir <path>` 命令，扫描目录下所有 CHECK_RULE Excel 文件并全量初始化规则库。这是独立部署场景下数据准备的唯一入口。

#### Scenario: 成功初始化
- **WHEN** 执行 `mml init --dir ./rules --json`
- **AND** 目录中包含格式正确的 CHECK_RULE Excel 文件
- **THEN** 创建或覆盖 SQLite 数据库
- **AND** 输出 `{ "imported": number, "files": string[] }` 到 stdout
- **AND** exit code 为 0

#### Scenario: 目录不存在
- **WHEN** 执行 `mml init --dir ./nonexistent`
- **THEN** 输出错误信息到 stderr
- **AND** exit code 为 3（resource not found）

#### Scenario: 强制覆盖已有数据
- **WHEN** 执行 `mml init --dir ./rules` 且数据库中已存在相同网络类型和版本的规则集
- **THEN** 强制覆盖已有规则集，不报错
- **AND** exit code 为 0

#### Scenario: 数据库不存在时自动创建
- **WHEN** 执行 `mml init --dir ./rules` 且数据库文件不存在
- **THEN** 自动创建数据库文件并完成导入
- **AND** exit code 为 0

### Requirement: mml file query 命令
CLI SHALL 提供 `mml file query` 命令，用于查询业务 `.mml` 文件中的实际命令实例。

#### Scenario: 按命令名查询实例
- **WHEN** 执行 `mml file query --file ./working/core-a.mml --command "ADD NGPEIPLCY" --json`
- **THEN** 输出 JSON 到 stdout
- **AND** 返回该文件中所有命令名为 `ADD NGPEIPLCY` 的语句实例
- **AND** 每条命中至少包含语句序号和原始命令文本
- **AND** exit code 为 0

#### Scenario: 按条件过滤实例
- **WHEN** 执行 `mml file query --file ./working/core-a.mml --command "ADD SGSLNK" --where IPTYPE=IPv4 --json`
- **THEN** 返回所有命令名匹配且参数 `IPTYPE` 值等于 `IPV4` 的语句实例
- **AND** 参数名匹配 SHALL 忽略大小写
- **AND** 参数值匹配 SHALL 默认忽略大小写
- **AND** exit code 为 0

#### Scenario: 多条件 AND 过滤
- **WHEN** 执行 `mml file query --file ./working/core-a.mml --command "ADD SGSLNK" --where IPTYPE=IPV4 --where LNK=1 --json`
- **THEN** 仅返回同时满足全部条件的语句实例
- **AND** exit code 为 0

#### Scenario: 选取特定参数值
- **WHEN** 执行 `mml file query --file ./working/core-a.mml --command "ADD SGSLNK" --where IPTYPE=IPV4 --select VLRIPV4_1 --json`
- **THEN** 每条命中额外返回参数 `VLRIPV4_1` 的实际值
- **AND** 输出格式保持紧凑，不返回完整参数 schema
- **AND** exit code 为 0

#### Scenario: text-only 紧凑输出
- **WHEN** 执行 `mml file query --file ./working/core-a.mml --command "ADD NGPEIPLCY" --text-only --json`
- **THEN** 输出 JSON 到 stdout
- **AND** 结果仅包含文件标识、命中数量和原始命令文本数组
- **AND** exit code 为 0

#### Scenario: 无匹配结果
- **WHEN** 执行 `mml file query` 且文件中没有匹配实例
- **THEN** 输出 `{ "n": 0, "rows": [] }` 或 `{ "n": 0, "texts": [] }` 的 JSON 结果到 stdout
- **AND** exit code 为 0

#### Scenario: 文件不存在
- **WHEN** 执行 `mml file query --file ./missing.mml --command "ADD SGSLNK"`
- **THEN** 输出错误信息到 stderr
- **AND** exit code 为 3（resource not found）

#### Scenario: where 条件语法错误
- **WHEN** 执行 `mml file query --file ./working/core-a.mml --command "ADD SGSLNK" --where IPTYPE`
- **THEN** 输出 usage 信息到 stderr
- **AND** exit code 为 2（usage error）

### Requirement: 全局选项
CLI SHALL 支持以下全局选项。

#### Scenario: 指定数据库路径
- **WHEN** 执行任意命令带 `--db /path/to/db`
- **THEN** 使用指定路径的数据库文件

#### Scenario: 环境变量指定数据库路径
- **WHEN** 设置环境变量 `MML_DB_PATH=/path/to/db` 且未指定 `--db` 参数
- **THEN** 使用环境变量指定的路径

#### Scenario: 默认数据库路径
- **WHEN** 未指定 `--db` 且未设置 `MML_DB_PATH`
- **THEN** 使用 `./data/mml-rules.db` 作为默认路径

### Requirement: Exit code 语义
CLI SHALL 使用一致的 exit code 语义。

#### Scenario: Exit code 规范
- **WHEN** 命令执行成功
- **THEN** exit code 为 0
- **WHEN** `mml file query` 没有找到匹配实例
- **THEN** exit code 仍为 0
- **WHEN** 命令验证失败或一般错误
- **THEN** exit code 为 1
- **WHEN** 参数用法错误
- **THEN** exit code 为 2
- **WHEN** 资源未找到
- **THEN** exit code 为 3

### Requirement: 自文档化 help
CLI SHALL 提供完整的 --help 输出，包含命令描述、参数说明和使用示例。

#### Scenario: 顶层 help
- **WHEN** 执行 `mml --help`
- **THEN** 列出所有子命令和全局选项

#### Scenario: 子命令 help
- **WHEN** 执行 `mml schema show --help`
- **THEN** 显示该命令的完整用法、必填/可选参数、示例
