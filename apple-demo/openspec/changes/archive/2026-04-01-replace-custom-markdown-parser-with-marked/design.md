## Context

`markdownPreview.ts` 是一个手工编写的行级 markdown 解析器，通过正则逐行匹配标题、列表、代码块、引用等语法块，最终拼装 HTML。该解析器不支持 GFM 表格（管道符语法），也不支持删除线。

`assistantTextPresentation.ts` 决定 assistant 文本消息是否进入 reading mode。当前 eligibility 检测识别四类信号：标题、代码块、列表、长多段文本。表格语法不在检测范围内，纯表格 assistant 回复会被判为短对话文本，走 raw 气泡路径，即使解析器支持表格也无法触发渲染。

此变更涉及 `apps/web` 前端渲染层和 presentation 逻辑，不涉及后端或 API。

## Goals / Non-Goals

**Goals:**
- 使用 marked 替换自定义 markdown 解析器，支持 GFM 表格和删除线渲染。
- 使用 DOMPurify 对 marked 输出做 HTML 清洗，保持与当前解析器同等的安全水平。
- 源文本中的原始 HTML 必须作为转义后的字面文本显示，不渲染为有效的 HTML 元素，不静默删除。
- 保持 `renderMarkdownToHtml(source: string): string` 导出接口不变，消费组件零调用改动。
- 保持段落内换行转 `<br>` 的行为（marked `breaks: true`）。
- 链接保持 `target="_blank" rel="noreferrer"` 行为。
- 保持与当前解析器同等的链接协议白名单：仅允许 `http:`, `https:`, `mailto:`, `#`（锚点）, `/`（相对路径）。非白名单协议的链接降级为纯文本，不渲染 `<a>` 元素。
- 扩展 eligibility 检测，使包含表格语法的 assistant 文本默认进入 reading mode。
- 为两个渲染上下文补充表格 CSS，处理窄容器内的横向溢出。

**Non-Goals:**
- 不引入任务列表（task list）支持。marked 会输出 checkbox input 元素，需要额外的 sanitizer 白名单和样式，本次不纳入范围。
- 不回退 marked 带来的低层 GFM 行为变化（如裸 URL autolink），这些视为可接受的产品行为变化。
- 不为表格引入排序、筛选、复制等交互能力。
- 不引入代码语法高亮。
- 不改变 streaming 期间或 user 消息的渲染逻辑。

## Decisions

### Decision: 使用 marked + DOMPurify 替代自定义解析器

将 `markdownPreview.ts` 重写为 marked + DOMPurify 封装层。marked 负责 markdown → HTML，DOMPurify 负责清洗输出中的危险标签与属性。

Rationale:
- marked 内置 GFM 表格和删除线支持，无需额外插件。
- DOMPurify 是 marked 官方推荐的 XSS 防护方案。
- 两者职责分离：marked 负责功能，DOMPurify 负责安全。

Alternatives considered:
- 在现有自定义解析器中新增表格解析：可行，但可持续性差，后续每增加一种 GFM 扩展都需要手写解析逻辑。
- 使用 markdown-it：markdown-it 同样内置 GFM 表格和删除线支持，但 API 复杂度高于 marked（实例化 + 预设 + 插件链），对当前场景无优势。marked 的函数式 API（`marked.parse(source, options)`）更贴合当前单函数导出的封装模式。

### Decision: 源文本中的原始 HTML 作为转义后的字面文本显示

当前解析器通过 `escapeHtml()` 先转义全部输入再构建 HTML，源文本中的 `<script>alert(1)</script>` 会显示为 `&lt;script&gt;alert(1)&lt;/script&gt;` 的可见字面文本。

替换为 marked 后必须保持同等行为：源文本中的原始 HTML 标签不得渲染为有效的 HTML 元素，且必须作为转义后的字面文本对用户可见。不能静默删除原始 HTML 内容。

具体实现方式在 implementation 时根据 marked 的官方配置或扩展点确认。DOMPurify 白名单（见下一条 Decision）始终保留作为最终防线。

### Decision: DOMPurify 标签白名单作为纵深防线

DOMPurify 使用 ALLOW_TAGS 白名单，仅允许 marked 产出的已知安全标签：

  块级: p, h1-h6, blockquote, pre, hr, ul, ol, li, table, thead, tbody, tr, th, td, br
  行内: strong, em, a, code, del

Rationale:
- 白名单显式可审计，新增标签需显式添加。
- 与"原始 HTML 作为字面文本显示"的要求构成纵深防御。

### Decision: 非 http/https/mailto 协议的链接降级为纯文本

当前解析器的 `normalizeUrl()` 仅允许 `http:`, `https:`, `mailto:`, `#`（锚点）, `/`（相对路径）。不在白名单内的 URL，当前行为是不渲染 `<a>` 标签，仅保留链接可见文本。

替换为 marked 后，通过自定义 renderer 的 `link` 方法实现同等行为：对 href 值应用与当前 `normalizeUrl()` 相同的白名单逻辑，不在白名单内的链接不输出 `<a>` 元素，仅返回链接文本。

Rationale:
- 与当前解析器的实际行为一致：无 `<a>` 可点击，只有纯文字。
- 避免引入 `href="#"` 假链接，防止用户误点。

### Decision: 宽表格在窄容器内可横向滚动且不撑破布局

assistant 聊天气泡宽度受限，宽表格可能超出容器。design 目标是：宽表格可横向滚动，不撑破气泡布局，不截断内容。

具体实现优先考虑对表格语义和 border-collapse 影响最小的方案（如 wrapper 容器或等价手段），而非直接修改 table 元素的 display 属性。assistant 气泡和 workspace 预览共用同一套表格核心样式（边框、内边距、交替行色），assistant 气泡上下文额外处理宽度约束。

### Decision: 扩展 eligibility 检测以识别表格语法

在 `isAssistantTextReadingModeEligible` 中新增表格模式检测。GFM 表格至少包含一个分隔行（如 `|---|` 或 `|:---:|`），因此检测目标是匹配至少一行以 `|` 包围且包含连续 `-` 的分隔行模式。

Rationale:
- 纯表格 assistant 回复（不含标题、代码块或列表）在当前逻辑下无法进入 reading mode，这是用户看到原始管道符的直接原因。
- 分隔行是 GFM 表格的必要组成部分，检测分隔行可以准确区分表格文本与普通文本中偶然出现的管道符。

## Risks / Trade-offs

- [marked 输出格式与当前测试断言不完全一致] → 逐个适配测试用例，对齐 marked 的实际输出（如列表带换行缩进）。
- [新增两个 npm 依赖增大打包体积] → marked (~40KB) + DOMPurify (~20KB) 合计约 60KB min，对当前应用规模可接受。
- [DOMPurify 白名单可能需要随 marked 版本更新而扩展] → 白名单在 `markdownPreview.ts` 中集中定义，易于审计和维护。

## Migration Plan

1. 安装 marked 和 dompurify 依赖。
2. 重写 `markdownPreview.ts`，保持导出接口不变。
3. 扩展 `assistantTextPresentation.ts` 的 eligibility 检测。
4. 适配现有测试用例，新增表格、eligibility 和 autolink 测试。
5. 为两个组件添加表格 CSS。
6. 运行全量测试验证。
7. 回滚时恢复原 `markdownPreview.ts` 和 `assistantTextPresentation.ts` 并移除依赖即可，无数据迁移。

## Open Questions

- 需确认使用 marked 的官方配置或扩展点达成 "raw HTML 作为转义后的字面文本显示" 这一行为要求，implementation 时根据实际 API 确认具体方案。
