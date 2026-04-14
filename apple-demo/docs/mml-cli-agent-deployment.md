# mml-cli 部署到 Agent 系统方案

## 背景

`mml-cli` 是独立的 Node.js CLI 工具（`cli-tools/mml/`），提供 MML 规则查询、校验、文件解析等能力。Agent 后端需要调用这些能力来辅助 MML 配置生成。

## 现状

- `mml-cli` 已构建，产物在 `cli-tools/mml/dist/`
- 核心逻辑在 `cli-tools/mml/src/core/`，已通过 `src/index.ts` 导出完整 API
- CLI 入口（`cli.ts`）只是核心 API 之上的薄壳，依赖 `commander`
- Agent 后端通过 `executeGovernedScript()` 执行受控脚本（spawn node 子进程），不暴露通用 shell 能力
- `scriptExecutor` 支持的 argv 类型：`option`、`flag`、`payload`（不支持重复参数）

## 方案：Skill + 直接调用核心 API

### 思路

利用 Agent 已有的 `skill:exec` 机制创建 mml-cli skill。脚本模板不调用 CLI 二进制（避免双重 spawn），而是直接 import `mml-cli` 的核心模块（`MmlRuleStore`、`DbBackedMmlSchemaService`、`validateCommandAgainstSchema`、`queryMmlFile`），esbuild 打包时自动内联。

数据库路径通过 `RUNTIME_ROOT` 环境变量（由 scriptExecutor 自动注入）定位。

### 前置条件

将 `mml-cli` 添加为 `agent-backend` 的 workspace 依赖：

```jsonc
// apps/agent-backend/package.json
{
  "dependencies": {
    "mml-cli": "workspace:*"
  }
}
```

这样 esbuild 打包 skill 脚本时能解析到 `mml-cli` 的核心模块。

### 目录结构

```
apps/agent-backend/assets/skills/mml-cli/
├── SKILL.md
├── SCRIPTS.yaml
└── scripts/
    ├── schema-list.ts
    ├── schema-show.ts
    ├── validate.ts
    └── file-query.ts
```

### SKILL.md

```markdown
---
id: mml-cli
name: MML CLI 工具
description: 查询 MML 规则目录、校验 MML 命令、解析业务 .mml 文件
---

# MML CLI 工具

提供以下能力，通过 skill:exec 调用对应脚本模板：

- **schema-list**: 列出可用的网元类型和版本
- **schema-show**: 查看指定网元类型版本的命令 schema（可按命令名筛选）
- **validate**: 校验 MML 命令文本是否符合规则，返回校验结果和错误详情
- **file-query**: 从业务 .mml 文件查询命令实例，支持参数过滤和选择
```

### SCRIPTS.yaml

```yaml
templates:
  - id: schema-list
    description: 列出可用的网元类型和版本
    entry: scripts/schema-list.ts
    inputSchema:
      type: object
      properties: {}
    argv: []
    timeoutSeconds: 10

  - id: schema-show
    description: 查看指定网元类型和版本的命令 schema
    entry: scripts/schema-show.ts
    inputSchema:
      type: object
      properties:
        type:
          type: string
          description: 网元类型
        version:
          type: string
          description: 版本号
        command:
          type: string
          description: 筛选的命令名（可选）
      required:
        - type
        - version
    argv:
      - kind: payload
        encoding: json
    timeoutSeconds: 10

  - id: validate
    description: 校验 MML 命令是否符合规则
    entry: scripts/validate.ts
    inputSchema:
      type: object
      properties:
        type:
          type: string
          description: 网元类型
        version:
          type: string
          description: 版本号
        command:
          type: string
          description: MML 命令文本
      required:
        - type
        - version
        - command
    argv:
      - kind: payload
        encoding: json
    timeoutSeconds: 15

  - id: file-query
    description: 从业务 .mml 文件查询命令实例
    entry: scripts/file-query.ts
    inputSchema:
      type: object
      properties:
        file:
          type: string
          description: .mml 文件路径（相对于 workspace）
          pathBase: workspaceRoot
        commandName:
          type: string
          description: 命令名
        where:
          type: array
          items:
            type: string
          description: 参数过滤条件，格式 PARAM=VALUE
        select:
          type: string
          description: 返回指定参数值
        textOnly:
          type: boolean
          description: 仅返回匹配的命令文本
        limit:
          type: integer
          description: 返回结果数量限制
          minimum: 1
      required:
        - file
        - commandName
    argv:
      - kind: payload
        encoding: json
    timeoutSeconds: 15
```

> **说明**：`file-query` 的 `where` 参数是数组类型，SCRIPTS.yaml 的 argv builder 无法将其展开为多个 `--where` 选项，因此统一使用 `payload` 编码，脚本通过 `process.argv[2]` 读取完整 JSON 参数。`schema-show` 和 `validate` 也使用相同模式保持一致。`file` 字段使用 `pathBase: workspaceRoot`，由 execValidation 自动解析为绝对路径并校验边界。

### 脚本示例

#### scripts/schema-list.ts

```typescript
import { MmlRuleStore } from 'mml-cli/dist/core/store.js'
import { DbBackedMmlSchemaService } from 'mml-cli/dist/core/service.js'

const dbPath = process.env.RUNTIME_ROOT
  ? `${process.env.RUNTIME_ROOT}/data/mml-rules.db`
  : './data/mml-rules.db'

const store = new MmlRuleStore(dbPath)
store.initialize()
try {
  const service = new DbBackedMmlSchemaService(store)
  process.stdout.write(JSON.stringify(service.getOptions(), null, 2))
} finally {
  store.close()
}
```

#### scripts/validate.ts

```typescript
import { MmlRuleStore } from 'mml-cli/dist/core/store.js'
import { DbBackedMmlSchemaService } from 'mml-cli/dist/core/service.js'
import { validateCommandAgainstSchema } from 'mml-cli/dist/core/semantics.js'

const args = JSON.parse(process.argv[2]!)
const dbPath = process.env.RUNTIME_ROOT
  ? `${process.env.RUNTIME_ROOT}/data/mml-rules.db`
  : './data/mml-rules.db'

const store = new MmlRuleStore(dbPath)
store.initialize()
try {
  const service = new DbBackedMmlSchemaService(store)
  const schema = service.getSchema(args.type, args.version)
  if (!schema) {
    process.stderr.write('No matching ruleset found.')
    process.exitCode = 1
    return
  }
  const result = validateCommandAgainstSchema(args.command, schema)
  process.stdout.write(JSON.stringify(result, null, 2))
  if (!result.valid) {
    process.exitCode = 1
  }
} finally {
  store.close()
}
```

其余脚本（`schema-show.ts`、`file-query.ts`）结构相同：解析 payload，调用核心 API，输出 JSON。

### 注册到 ManagedSkillRegistry

在 `apps/agent-backend/src/skills/managedPolicies.ts` 中添加：

```typescript
{
  id: 'mml-cli',
  lifecycle: 'published',
}
```

### 构建步骤

```bash
# 1. 安装依赖（添加 workspace 引用后）
pnpm install

# 2. 构建 agent-backend（esbuild 会将 mml-cli 核心模块内联打包进 skill 脚本）
pnpm --filter @apple-demo/agent-backend assemble
```

`build-agent-dist.mjs` 自动处理：
1. 复制 `assets/skills/mml-cli/` → `dist/assets/skills/mml-cli/`
2. 读取 `SCRIPTS.yaml`，用 esbuild 将 `scripts/*.ts` 打包为 `scripts/*.js`（mml-cli 核心代码会被内联）
3. 重写 `SKILL.md` 中的路径（`.ts` → `.js`，`npx tsx` → `node`）

### 调用流程

```
Agent Loop (LLM)
  → skill:exec { template: "mml-cli:validate", args: { type, version, command } }
  → scriptExecutor.executeGovernedScript()
    → 验证参数（execValidation）
    → 构造 argv: ["node", "validate.js", '{"type":"AMF",...}']
    → spawn node 子进程
  → validate.js 直接调用 MmlRuleStore + validateCommandAgainstSchema
  → 输出 JSON 结果
```

### 与 CLI 方案的对比

| | 直接 import 核心模块 | 调用 CLI 二进制 |
|---|---|---|
| 进程开销 | 单次 spawn | 双重 spawn |
| 路径问题 | esbuild 内联，无路径依赖 | 需要定位 cli.js，构建后路径不稳定 |
| 依赖 | esbuild 打包进产物 | 运行时需要 node_modules |
| 数组参数 | payload JSON 透传 | 需要展开为重复 CLI 选项 |
| 调试 | 可直接 import 测试 | 只能通过 CLI 调用测试 |

## 待确认事项

1. **数据库文件位置**：默认 `${RUNTIME_ROOT}/data/mml-rules.db`，需确认部署环境中数据库的实际路径。
2. **`xlsx` 依赖**：esbuild 会尝试打包 mml-cli 的全部代码。`xlsx` 仅 `mml init` 命令使用，`validate`/`schema`/`file query` 不依赖它。esbuild 的 tree-shaking 应能排除，但需验证打包体积。
3. **`node:sqlite`**：`MmlRuleStore` 使用 Node 22 内置的 `node:sqlite`（`DatabaseSync`），esbuild 标记为 external 即可，无需打包。
