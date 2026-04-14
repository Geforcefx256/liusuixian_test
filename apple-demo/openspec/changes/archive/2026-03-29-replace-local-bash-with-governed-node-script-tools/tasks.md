## 1. Script Manifest Infrastructure

- [x] 1.1 定义 `SCRIPTS.yaml` 文件的解析器、类型和校验逻辑（`src/skills/scriptManifest.ts`），接入现有 skill catalog load issue 模式
- [x] 1.2 扩展 `SkillCatalogEntry` 增加 `execTemplates` 字段，在 skill 加载时读取并解析 `SCRIPTS.yaml`
- [x] 1.3 更新 build phase / approved skill 收口逻辑，确保只有 approved skills 的脚本模板会出现在 `skill:exec` 工具描述中

## 2. Script Execution Runtime

- [x] 2.1 新增 `skill:exec` 工具 manifest 和 input schema，注册到 `SkillToolProvider`（单一工具入口）
- [x] 2.2 实现 `skill:exec` 动态描述生成器，列出所有 governed + approved 的脚本模板及参数概要
- [x] 2.3 实现固定 Node 脚本执行器：`spawn(node, args, { shell: false })`，包含参数 schema 校验、路径边界校验（pathBase）、超时（setTimeout + SIGKILL 进程组）、输出截断（50KB / 2000 行）
- [x] 2.4 实现 `invokeExec()` 分发逻辑：skill 治理解析 → 模板查找 → 参数校验 → 执行器调用 → 结果/artifact 返回
- [x] 2.5 复用现有 structured output 契约：artifact_ref 解析、rows_result 透传、workspace output 注册

## 3. Skill Package Migration

- [x] 3.1 为 `ne-csv-processor` 创建 `SCRIPTS.yaml`（extract + encode 两个模板）
- [x] 3.2 为 `tai-fqdn-converter` 创建 `SCRIPTS.yaml`（convert 模板，positional payload）
- [x] 3.3 为 `naming-generation-rowcipher` 创建 `SCRIPTS.yaml`（generate 模板，positional payload）
- [x] 3.4 更新所有 3 个 `SKILL.md`：移除 bash 命令模板段落，`allowed-tools` 中 `local:bash` 替换为 `skill:exec`

## 4. Remove `local:bash` + Sandbox

- [x] 4.1 删除 `src/runtime/tools/local/sandbox/` 整个目录
- [x] 4.2 删除 `src/runtime/tools/local/runCommand.ts` 及其测试
- [x] 4.3 从 `localProvider.ts` 移除 bash 工具注册和 `invokeBash()` 方法
- [x] 4.4 从 `schemas.ts` 移除 `bashInputSchema`
- [x] 4.5 从 `ConfigLoader.ts` 移除 sandbox 配置段（类型、默认值、解析、合并、env 覆盖、校验）
- [x] 4.6 从 `src/index.ts`、`src/runtime/bootstrap.ts`、`src/routes/gateway.ts` 移除 sandbox 传参
- [x] 4.7 从 `src/runtime/tools/index.ts` 移除 sandbox 参数

## 5. Verification

- [x] 5.1 新增 `scriptManifest.test.ts`：覆盖 manifest 解析、校验、路径拒绝、env 校验
- [x] 5.2 新增 `scriptExecutor.test.ts`：覆盖 argv 构建、超时、输出截断、路径越界、参数校验
- [x] 5.3 更新 `skillProvider.test.ts`：覆盖 exec 分发成功、模板未找到、技能未批准、参数校验失败
- [x] 5.4 更新 `tests/skillFixtures.ts`：支持 `SCRIPTS.yaml` fixture
- [x] 5.5 更新所有现有测试：移除 sandbox fixtures、bash 工具期望、bash 相关用例
- [x] 5.6 端到端验证：工具目录不含 `local:bash`，`skill:exec` 可用，repo skill 脚本通过 exec 正常执行

## 6. Description Contract Correction

- [x] 6.1 调整 `skill:exec` 描述生成逻辑：只保留稳定调用契约，不再内嵌动态模板清单，并明确提示先通过 `skill` 读取 `SKILL.md`
- [x] 6.2 更新相关测试：断言 `skill:exec.description` 不包含任何逐模板元数据，同时现有 exec 调用能力不回退
- [x] 6.3 重新执行针对 `skill:exec` 的目录与 provider 测试，验证变更后 catalog 与运行时行为一致
