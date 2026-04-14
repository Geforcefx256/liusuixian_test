## Context

`pickCandidateSkills()` 在 planner 入口处对用户输入与所有已注册 skill 做轻量相关性打分，筛选出至多 5 个候选 skill 供 LLM 优先参考。当前 `scoreSkill()` 用 `/\s+/` 分词，中文输入因无空格被整体视为单个 token，与 skill 元数据几乎不可能子串匹配，导致中文场景下候选 skill 退化为兜底的"前 5 个"，降低了规划准确性。

变更范围仅限 `planner.ts` 中的 `scoreSkill()` 函数，不涉及 planner 的系统提示、LLM 调用链路或 skill 元数据结构。

## Goals / Non-Goals

**Goals:**
- 使 `scoreSkill()` 能正确处理纯中文、纯英文、中英混合三类输入
- 不引入任何第三方分词依赖
- 保持现有英文/拉丁文分词行为不变

**Non-Goals:**
- 不做语义匹配或向量检索
- 不修改 `pickCandidateSkills()` 的筛选阈值或排序逻辑
- 不修改 skill 元数据格式或 SKILL.md 规范
- 不调整 planner 系统提示

## Decisions

### 1. 采用正则语种边界拆分 + 中文 bigram 滑窗策略

将输入文本按语种边界拆分为"连续中文段"和"连续拉丁/数字段"两类：

```
正则: /[\u4e00-\u9fff]+|[a-zA-Z0-9_-]+/g
```

- 拉丁/数字段：保持整词作为 token（与现有行为一致）
- 中文段：生成 bigram（二字滑窗），每个 bigram 作为一个 token

示例：

```
输入: "读取存量mml配置"
Step 1 — 语种拆分: ["读取存量", "mml", "配置"]
Step 2 — 中文段 bigram: "读取存量" → ["读取", "取存", "存量"]
Step 3 — 合并: ["读取", "取存", "存量", "mml", "配置"]
```

备选方案：
- 引入 `nodejieba` 等分词库。未采用，因为增加 native 编译依赖，与零依赖目标冲突。
- 纯字符级 n-gram（不区分语种）。未采用，因为会产生跨语种噪音 token（如 "量m"），降低匹配精度。

### 2. 对 haystack 侧同样应用混合拆分做双向 token 匹配

仅对 input 侧分词、haystack 侧仍用 `includes()` 做子串匹配已足够覆盖大部分场景：中文 bigram 本身就是短子串，`includes()` 可以直接命中 haystack 中的中文描述。

因此 **haystack 侧不做额外分词处理**，保持 `includes()` 语义不变。这样改动最小，且 bigram 天然适合子串匹配。

### 3. 保留 token 最小长度过滤

现有逻辑过滤 `token.length < 2` 的 token。中文 bigram 固定为 2 字符，恰好满足此条件。单个中文字（如输入仅一个"查"字）仍会被过滤，这是合理的，单字匹配噪音过大。

### 4. 抽取独立的 tokenize 函数

将分词逻辑抽取为独立的 `tokenize(input: string): string[]` 函数，与 `scoreSkill` 解耦，便于单独验证分词行为。

## Risks / Trade-offs

- [bigram 噪音] 中文 bigram 会产生无意义组合（如 "取存"），可能偶尔误匹配。但因 `scoreSkill` 仅用于粗筛候选（最多 5 个），且最终由 LLM 做精确判断，误匹配的实际影响很低。
- [三字词覆盖] 纯 bigram 无法覆盖三字中文词（如 "网元类"）。但 bigram 的子集（"网元"）通常已足够命中 haystack，且增加 trigram 会进一步放大噪音。
- [评分权重未区分] 中文 bigram 和拉丁整词的权重相同（各 +1），但 bigram 数量通常多于拉丁词，可能导致中文输入整体得分偏高。在当前粗筛场景下影响可忽略。

## Open Questions

- None.
