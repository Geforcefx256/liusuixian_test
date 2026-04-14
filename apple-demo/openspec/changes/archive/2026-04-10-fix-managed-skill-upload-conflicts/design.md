## Context

managed skill 上传当前以 canonical `id` 作为唯一冲突判断依据，并在运行时继续支持 skill 按 “name or id” 解析。由于 canonical `name` 没有被上传链路显式保护，不同 `id` 的 skill 可以共享同一个 `name`，最终由 catalog 别名表只保留首个命中的 `name` 映射，造成上传成功但运行时解析结果不稳定。

上传链路的另一个问题是错误出口不稳定。`/agent/api/admin/skills/upload` 依赖 `multer` 中间件处理 multipart 请求，但当前局部路由没有把中间件错误统一转换为产品约定的 JSON 结构；管理员上传非 ZIP 或触发上传中间件错误时，前端无法稳定消费错误代码并给出一致提示。

本次变更限定在 managed skill 上传治理链路，不扩展为全站统一错误中间件重构，也不改变现有顶层目录结构或依赖集合。

## Goals / Non-Goals

**Goals:**
- 阻止 canonical `id` 或 canonical `name` 冲突的 skill ZIP 进入持久化流程。
- 保留现有同 `id` 覆盖确认流程，同时把冲突类型显式暴露为 `id` 或 `name`。
- 对 `/agent/api/admin/skills/upload` 的局部上传中间件错误返回稳定 JSON 响应。
- 让 Skill 管理页明确区分“可确认覆盖的 `id` 冲突”和“必须阻断的 `name` 冲突”。

**Non-Goals:**
- 不重构全局 Express 错误处理中间件顺序。
- 不改变 runtime “name or id” 工具契约。
- 不引入新的第三方依赖。
- 不清理或迁移历史 canonical skill 目录结构；当前仓库没有现存 canonical `name` 重名资产。

## Decisions

### 1. 将 canonical 冲突分为 `id` 冲突和 `name` 冲突两类

上传前读取待上传包的 canonical `id` 与 `name`，并与当前 canonical catalog 中已存在的 skill 做比对。

- 若存在同 `id` skill 且请求未显式确认覆盖，返回 `409`，`reason = 'id'`
- 若存在同 `name` 但不同 `id` 的 skill，返回 `409`，`reason = 'name'`
- 若是覆盖同 `id` skill，但新包的 `name` 又撞上了其他 skill 的 canonical `name`，优先按 `name` 冲突拒绝

这样可以保护 runtime 现有 “name or id” 解析契约，不需要改动工具层行为。

备选方案：
- 允许 canonical `name` 重复，只要求调用方改用 `id`
  - 否决原因：与现有运行时文案和解析契约冲突，会把问题转嫁给调用方
- 发现 `name` 冲突后自动改名
  - 否决原因：会改写 canonical 身份，破坏 skill 包的作者意图

### 2. 仅 `id` 冲突支持覆盖确认，`name` 冲突必须阻断

现有覆盖实现依赖 `skillId` 对应的 canonical 目录进行替换。`name` 冲突没有唯一安全的替换目标，因此即便带 `overwrite=true`，也不能把 `name` 冲突视作可继续覆盖的合法路径。

前端继续使用现有冲突提示区块，但只在 `reason = 'id'` 时显示“确认覆盖”；`reason = 'name'` 时显示阻断说明并保留取消/重新上传路径。

备选方案：
- 对 `name` 冲突也复用覆盖按钮
  - 否决原因：会制造“系统允许覆盖但后端无安全替换目标”的假象

### 3. 局部包装 upload 中间件错误，不做全局错误通道重排

本次只对 `/agent/api/admin/skills/upload` 做局部修复：将 `multer` / multipart 前置错误转换为稳定 JSON，例如 `{ error, code }`，并保持现有业务校验错误结构不变。

这样可以最小化 blast radius，避免把整个 `agent-backend` 的错误处理顺序一起改动。

备选方案：
- 调整全局 Express error middleware 到所有路由之后
  - 否决原因：影响面更大，本次需求只要求 skill 上传入口先稳定

### 4. 冲突与错误结构沿用现有管理端契约并增量扩展

前端和后端继续复用现有上传错误消费方式：

- 冲突仍返回 `409`
- 包校验失败仍返回 `400` + `issues`
- 新增 `reason: 'id' | 'name'` 用于冲突细分
- 新增稳定的上传中间件错误 `code`，避免前端落入纯文本错误分支

这样可以控制改动范围，避免重写前端 API 消费层。

## Risks / Trade-offs

- [风险] catalog 与 managed registry 都保存 canonical 元数据，冲突检查若选错数据源会出现判断不一致
  → Mitigation：以上传前的 canonical catalog 为准，再用 managed record 补充冲突详情展示

- [风险] `name` 冲突阻断后，管理员可能认为覆盖能力“退化”
  → Mitigation：前端明确说明只有同 `id` 冲突支持确认覆盖，`name` 冲突需要调整 canonical 元数据

- [风险] 只修局部上传错误，其他 multipart 路由仍可能保留不一致行为
  → Mitigation：本次仅在 design 中明确范围，后续若要统一可另起变更
