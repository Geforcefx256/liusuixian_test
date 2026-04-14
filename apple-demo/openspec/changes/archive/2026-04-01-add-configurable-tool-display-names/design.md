## Context

当前运行时对工具名称的用户可见展示存在两条独立链路。流式工具调用态由后端在 `tool.started` 事件里生成 `displayName`，完成态头部汇总则由前端根据 `metrics.tools[].tool` 再次做本地归一化。两处都缺少显式展示名映射，因此像 `skill:read_asset` 这样的内部工具 ID 会直接以 `read_asset` 暴露给用户。

这个问题跨越后端配置加载、运行时事件生成、bootstrap 契约和前端头部汇总逻辑，属于跨模块行为一致性问题。用户已经明确希望这类名称后续可在 `config.json` 中调整，而不是继续散落在前后端硬编码里。

## Goals / Non-Goals

**Goals:**
- 提供一个集中式、可配置的 `tool -> displayName` 映射来源。
- 让流式 `tool.started` 展示和完成态头部汇总展示使用同一套映射。
- 保持真实工具 ID、调用路由和权限策略不变，只改善用户可见名称。
- 为首批高频内建工具提供默认中文展示名。

**Non-Goals:**
- 不重命名任何真实工具 ID，如 `read_asset`、`read_file`。
- 不改变工具调用权限、allow/deny 策略或 provider 路由逻辑。
- 不为所有动态 MCP/gateway 工具强制提供翻译；未命中映射的工具仍保留现有回退展示。
- 不引入新的第三方依赖或新的顶层配置文件。

## Decisions

### 1. 将展示名映射放在 `apps/agent-backend/config.json` 的 `runtime.tools.displayNames`

`displayNames` 与 `deny`、`runtimeRetry` 同属于运行时工具行为配置，放在 `runtime.tools` 下语义最顺，也符合用户对“在 config.json 里可改”的预期。

备选方案：
- 放在前端常量里：实现最快，但无法满足运行时可调，且会让前后端再次分叉。
- 放在 `gateway.config.json`：该文件当前聚焦 gateway server/policy，不适合承载 `local:*`、`skill:*` 这类非 gateway 工具的展示配置。

### 2. bootstrap 单独下发扁平 `toolDisplayNames` 映射

前端完成态汇总无法直接复用后端 `tool.started.displayName`，因为它只拿到 `metrics.tools[].tool`。因此 bootstrap 需要把运行时展示名映射作为显式元数据下发给前端，供前端统一解析。

设计上采用扁平映射：

```text
{
  "toolDisplayNames": {
    "skill:read_asset": "读取技能文件",
    "local:question": "等待你回答"
  }
}
```

备选方案：
- 只在 `gateway.tools[]` manifest 里加展示名：不够，因为完成态汇总并不从 manifest 取名，而且 `local:*` / `skill:*` 也不是纯 gateway 语义。
- 让前端重新从 `gateway.tools[]` 建索引：可行但耦合更重，还需要解决命名空间和回退策略，不如显式映射直接。

### 3. 工具展示名解析遵循“全名命中优先，未命中再回退”的策略

映射键使用完整工具名，例如 `local:read_file`、`skill:read_asset`。解析时优先查完整工具名；若没有命中，则回退到当前逻辑，即移除 provider 前缀后的归一化名称。

这样可以：
- 避免 `mcp:default:transform_rows` 与其他 provider 下同名工具冲突。
- 保持现有未配置工具的展示稳定，不引入静默失败。

### 4. 首批仅为固定内建工具提供默认中文展示名

首批默认覆盖 `local:*` 与 `skill:*` 内建工具，包括：
- `local:read_file` -> `读取工作区文件`
- `local:list_directory` -> `查看工作区目录`
- `local:find_files` -> `查找工作区文件`
- `local:search_in_files` -> `搜索文件内容`
- `local:write` -> `写入工作区文件`
- `local:question` -> `等待你回答`
- `skill:skill` -> `加载技能说明`
- `skill:read_asset` -> `读取技能文件`
- `skill:list_assets` -> `查看技能目录`
- `skill:find_assets` -> `查找技能文件`
- `skill:exec` -> `执行技能脚本`

动态 MCP/gateway 工具暂不在本次变更中强制提供默认翻译，后续可以按实际业务工具逐步补充。

## Risks / Trade-offs

- [配置与前端状态不同步] → 通过 bootstrap 下发同一份映射，避免前后端各自维护一份名称表。
- [未配置工具继续显示英文归一化名] → 保留现有回退逻辑，避免因配置不全而阻断功能；后续可按高频工具逐步补齐。
- [bootstrap 契约新增字段影响类型] → 仅新增可选/受控字段，保持既有消费者在补齐实现前的兼容性。
- [未来不同 provider 存在同名工具] → 使用完整工具名作为键，避免别名冲突。

## Migration Plan

1. 在后端配置加载器中引入 `runtime.tools.displayNames`，并为内建工具填充默认值。
2. 在运行时工具展示名解析逻辑中接入该映射，覆盖 `tool.started.displayName`。
3. 扩展 runtime bootstrap 契约，下发 `toolDisplayNames`。
4. 前端完成态头部汇总改为优先使用 `toolDisplayNames`，未命中时保留现有回退。
5. 验证 `local:*` 与 `skill:*` 工具在流式态和完成态显示一致。

本次变更不涉及数据迁移。若需要回滚，可删除配置读取与 bootstrap 字段消费逻辑，前端和后端将自然回退到当前的归一化工具名展示。

## Open Questions

- 暂无阻塞性开放问题。本次默认不覆盖动态 MCP/gateway 工具的中文名，后续若出现稳定高频工具，再按完整工具名补配置即可。
