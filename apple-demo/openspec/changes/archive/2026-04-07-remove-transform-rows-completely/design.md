## Context

`transform_rows` 过去属于 gateway / MCP 路径中的历史工具名，但当前产品已经不希望继续暴露它。现状的问题不在于 catalog 还在大面积公开它，而在于 backend 仍保留多层“默认承认”语义：交付配置里保留 `defaultTool: "transform_rows"`，源码里保留默认常量与字段类型，MCP 执行链路还允许在缺少显式工具名时回退到 `defaultTool`，runtime deny 里也仍保留针对该工具的历史屏蔽项。

这导致系统语义分裂：

- runtime catalog 表面上已不暴露该工具；
- 配置、类型与执行链路却仍把它当作一个可恢复的默认工具；
- 排障时无法区分“工具已删除”与“工具只是被隐藏”。

这次变更只处理 `apps/agent-backend`。`apps/web` 当前只有 workbook-coupled gateway/tool 的通用兼容逻辑，没有显式注册或调用 `transform_rows`，因此不作为本次改动目标。

## Goals / Non-Goals

**Goals:**

- 将 `transform_rows` 从 backend 的配置语义、类型语义、执行语义和测试语义中一起移除。
- 确保 gateway / MCP runtime 不会再通过默认值、空字段回退或 shipped deny 残留重新承认该工具。
- 将 MCP 缺少 `tool` 的行为改为显式失败，使删除语义清晰可见，符合 debug-first 原则。
- 保持当前其余工具面、gateway/MCP 基础设施和前端 contract 不变。

**Non-Goals:**

- 不移除 gateway 或 MCP provider 本身。
- 不改变 `apps/web` 的 workbook/gateway 通用协议兼容行为。
- 不引入新的依赖、配置文件或顶层目录调整。
- 不顺带重构其他工具命名或 tool policy 机制。

## Decisions

### 1. 删除 `defaultTool` 对 `transform_rows` 的历史承认，而不是仅替换成另一个占位值

保留 `defaultTool` 字段但把值换成别的字符串，会继续维持“工具缺省时可自动选择”的语义，这与“彻底删除已废弃工具”目标冲突。  
本次设计选择移除 gateway / MCP 配置与类型中的 `defaultTool` 语义，避免后续继续通过默认工具恢复历史行为。

备选方案：

- 仅把 `transform_rows` 改成别的默认工具：不接受。会保留隐式回退机制，只是换了名字。
- 仅把配置文件里的 `defaultTool` 删除、代码继续兼容读取：不接受。代码层仍会承认旧语义。

### 2. MCP 缺少 `tool` 时改为显式失败

当前 [mcp/gateway.ts] 的行为是 `request.tool || this.config.defaultTool`。这类静默回退会掩盖调用方错误，也让已删除工具还能通过旁路路径被重新引用。  
本次设计要求：调用 MCP 时必须显式给出 `tool`；如果缺失，则返回清晰的校验失败，而不是执行默认工具。

备选方案：

- 保留回退，但仅在 `servers[*].tools` 非空时生效：不接受。仍然是隐式行为，增加排障成本。
- 让 catalog 层拦截、执行层继续回退：不接受。catalog 与执行语义不一致。

### 3. `transform_rows` 的删除不再依赖 deny 配置表达

deny 适合临时禁用或保留未来重启用的工具，不适合表达“已被产品永久移除”的语义。  
因此这次会同步删除 shipped runtime deny 中对 `transform_rows` 的条目，让删除语义由配置面与执行面本身承担，而不是靠一层屏蔽名单假装不存在。

备选方案：

- 保留 deny 作为双保险：不接受。会继续暗示该工具仍然是有效标识，只是被隐藏。

### 4. 测试与样例工具名一起去语义残留

如果实现删掉了，但测试、样例 manifest 和断言里仍以 `transform_rows` 作为默认示例，后续维护者仍会误判这是一个受支持的 canonical tool。  
因此本次设计要求测试改用中性占位工具名，避免仓库继续输出错误信号。

## Risks / Trade-offs

- [Risk] 旧的内部或手工调用路径可能依赖 `defaultTool` 隐式回退。  
  → Mitigation: 在 spec 中明确改为显式失败，并同步更新测试，确保失败是可见且可诊断的。

- [Risk] 删除 deny 条目后，若还有遗漏的回退逻辑，问题会直接暴露。  
  → Mitigation: 这是预期结果，符合 debug-first；通过配置解析、catalog、invoke 三层测试覆盖验证。

- [Risk] 现有测试大量使用 `transform_rows` 作为示例，修改面会较广。  
  → Mitigation: 只替换语义相关的示例名，不扩大到无关模块；保持测试关注点不变。

- [Trade-off] 从“保留兼容但隐藏”切换到“显式删除并失败”，短期可能暴露之前被静默掩盖的调用问题。  
  → Mitigation: 这是本次变更的目标之一，优先让错误显性化而不是继续维持模糊兼容。
