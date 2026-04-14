## 1. 项目脚手架

- [x] 1.1 创建 `cli-tools/mml/` 目录结构（src/commands、src/core、dist）
- [x] 1.2 创建 `cli-tools/mml/package.json`（name: mml-cli，bin: { mml: ./dist/cli.js }，dependencies 待确认版本）
- [x] 1.3 创建 `cli-tools/mml/tsconfig.json`（target: ES2022, module: NodeNext, outDir: dist）
- [x] 1.4 在 `pnpm-workspace.yaml` 中添加 `cli-tools/*`
- [x] 1.5 确认并安装依赖（commander、xlsx 及必要类型声明；SQLite 方案与 Node 22 内置 `node:sqlite` 保持一致）

## 2. MML core 分层

- [x] 2.1 提取统一的 schema / parse / validation / query contract 类型
- [x] 2.2 提取 rules catalog store（SQLite 数据库操作）
- [x] 2.3 提取 schema 查询服务
- [x] 2.4 提取 `conditionParser.ts`（条件表达式解析）
- [x] 2.5 提取 `fileName.ts`（Excel 文件名解析）
- [x] 2.6 提取 `importer.ts`（Excel 导入逻辑）
- [x] 2.7 从现有 `mmlSemantics` 提取 MML parse / validate 核心逻辑
- [x] 2.8 新增业务 `.mml` 文件实例查询核心 API
- [x] 2.9 创建 `index.ts` 导出 programmatic API

## 3. CLI 命令实现

- [x] 3.1 实现 CLI 入口 `cli.ts`（commander 程序、全局选项 --db、--json、--quiet、--help）
- [x] 3.2 实现 `mml schema list` 命令（输出网络类型和版本列表）
- [x] 3.3 实现 `mml schema show` 命令（输出指定类型的参数 schema，支持 --command 过滤）
- [x] 3.4 实现 `mml validate` 命令（验证 MML 命令，返回错误列表）
- [x] 3.5 将 `mml import` 重构为 `mml init` 命令（从 Excel 全量初始化规则库，强制覆盖）
- [x] 3.6 实现 `mml file query` 命令（查询业务 `.mml` 文件中的实际命令实例）
- [x] 3.7 实现 `--where <PARAM=VALUE>` 条件解析与 AND 过滤
- [x] 3.8 实现 `--select <PARAM>` 紧凑结果输出
- [x] 3.9 实现 `--text-only` 紧凑文本输出
- [x] 3.10 实现默认大小写不敏感的参数名和值匹配

## 4. Agent Skill

- [x] 4.1 创建 `apps/agent-backend/assets/skills/mml-generation/SKILL.md`（轻量使用说明）
- [x] 4.2 创建 `apps/agent-backend/assets/skills/mml-generation/SCRIPTS.yaml`
- [x] 4.3 创建受治理脚本入口，支持 schema 查询、validate、file query
- [x] 4.4 验证 agent runtime 可通过 `skill:exec` 调用该能力

## 5. 构建与验证

- [x] 5.1 验证 `pnpm install` 正常安装 cli-tools/mml 依赖
- [x] 5.2 验证 CLI 构建（`pnpm --filter mml-cli build`）
- [x] 5.3 验证各命令功能（schema list、schema show、validate、init、file query）
- [x] 5.4 验证 `file query --where`
- [x] 5.5 验证 `file query --select`
- [x] 5.6 验证 `file query --text-only`
- [x] 5.7 验证 exit code 语义正确
- [x] 5.8 验证紧凑 JSON 输出格式和 --help 自文档化

## 6. import → init 命令重构

- [x] 6.1 将 `cli.ts` 中的 `import` 命令替换为 `init`（命令名、description、help examples）
- [x] 6.2 去掉对外的 `mml import` 命令入口
- [x] 6.3 更新 `--help` 示例中的 `import` 引用为 `init`
- [x] 6.4 验证 `mml init --dir` 功能正常（创建 db、全量覆盖、目录不存在报错）
- [x] 6.5 验证 `mml import` 不再可用
- [x] 6.6 重新构建并确认类型检查通过
