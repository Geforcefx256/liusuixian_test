---
id: mml-cli
name: mml-cli
description: 查询存量网元MML脚本中的命令，查询命令参数含义、校验 MML命令是否正确。
---

# MML CLI 工具

提供以下能力：查询存量网元 MML 脚本（.txt 文件）、按网元类型和版本查询命令参数含义、校验 MML 命令是否正确。

## 交互规则

1. 任何必填参数缺失时，**必须直接询问用户**，禁止自行推断或猜测。
2. **禁止**使用 `list_directory`、`find_files` 等工具扫描目录来填补缺失参数，这会浪费 token。
3. 所有必填参数确认后才能调用 `skill:exec`。
4. 用户提到 MML 脚本文件但未提供文件名或路径时，必须明确询问，禁止扫描 workspace。注意 MML 脚本文件后缀为 .txt，不是 .mml。

## 可用模板

### schema-list

列出 MML 规则数据库中所有可用的网元类型和版本。

无输入参数。

### schema-show

返回指定网元类型和版本的命令参数含义（schema）。

必填参数：
- `type` - 网元类型（如 NR、LTE、AMF）。未指定时必须询问用户。
- `version` - 网元版本（如 20.9.2）。未指定时必须询问用户。

可选参数：
- `command` - 筛选单个命令名

### validate

校验 MML 命令文本是否符合指定网元类型和版本的规则。

必填参数：
- `type` - 网元类型。未指定时必须询问用户。
- `version` - 网元版本。未指定时必须询问用户。
- `command` - 待校验的 MML 命令文本。未指定时必须询问用户。

### file-query

从存量网元 MML 脚本（.txt 文件）中查询命令实例，支持多命令查询、参数过滤和选择。

必填参数：
- `file` - MML 脚本文件（.txt）相对于 workspace 根目录的路径。**必须询问用户文件名，禁止扫描目录。**

可选参数：
- `commandNames` - 要查询的命令名列表（数组），一次可查多个命令。不传则返回文件中所有命令。
- `where` - 过滤条件数组 `[{paramName, expectedValue}]`
- `select` - 选择并返回指定参数的值
- `textOnly` - 仅返回匹配的命令文本
- `limit` - 每个命令的返回结果数量上限
