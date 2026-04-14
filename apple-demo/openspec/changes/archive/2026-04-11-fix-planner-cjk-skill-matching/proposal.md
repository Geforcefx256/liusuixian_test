## Why

`scoreSkill()`（`planner.ts:250-259`）使用 `/\s+/` 对用户输入进行分词，再逐 token 与 skill 元数据做子串匹配。该策略对英文有效，但中文文本天然不以空格分隔词汇，导致整条中文输入被当作单个 token，几乎不可能命中 haystack。实际案例：用户输入 `"读取存量mml配置"`，期望匹配 `mml-cli`（描述包含"存量""MML"），但因分词失败得分为 0，skill 未进入候选列表。

## What Changes

- 重写 `scoreSkill()` 的分词逻辑，采用"混合拆分"策略：
  1. 用正则 `/[\u4e00-\u9fff]+|[a-zA-Z0-9_-]+/g` 按语种边界提取连续片段，隔离中文段与拉丁/数字段。
  2. 对拉丁/数字段保持整词作为 token。
  3. 对中文段生成 bigram（二字滑窗）作为 token。
  4. 过滤长度 < 2 的 token 后，逐个与 haystack 做 `includes()` 匹配。
- 对 haystack 侧同样应用混合拆分，以支持 skill 描述中的中文片段与输入 token 双向匹配。
- 不引入任何第三方分词依赖。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-planner`: `scoreSkill()` 分词算法变更，使 planner 候选 skill 筛选能正确处理中文及中英混合输入。

## Impact

- Affected code: `apps/agent-backend/src/agent/workspace/planner.ts`（`scoreSkill` 函数，约 20 行变更）
- Affected runtime behavior: planner 候选 skill 排序结果可能变化——此前中文输入下大量 skill 得分为 0 触发兜底逻辑（返回前 5 个 skill），修复后将按实际相关性排序
- Dependencies: 无新增依赖
