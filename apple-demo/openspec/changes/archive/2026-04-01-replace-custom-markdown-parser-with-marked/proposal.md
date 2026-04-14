## Why

当前 workbench 聊天消息和工作区文件预览使用自定义轻量 markdown 解析器（`markdownPreview.ts`，约 150 行），不支持 GFM 表格语法。Agent 返回包含表格的内容时，用户看到的是原始管道符文本而非渲染后的表格，严重影响信息可读性。

该问题有两层：
1. 自定义解析器缺少表格、删除线等 GFM 扩展的解析能力。
2. `assistantTextPresentation.ts` 的 reading-mode eligibility 不识别表格语法，纯表格 assistant 回复不会进入 reading mode，即使解析器支持表格也无济于事。

两层需要同时修复。

## What Changes

- 将 `apps/web` 的自定义 markdown 解析器替换为 `marked`，并搭配 `DOMPurify` 做 HTML 输出清洗。
- 扩展 `assistantTextPresentation.ts` 的 eligibility 检测，使包含 GFM 表格语法的 assistant 文本进入 reading mode。
- 保持 `renderMarkdownToHtml` 导出接口不变，消费组件零调用改动。
- 适配现有单元测试至新实现。
- 迁移到 marked 后，裸 URL 等当前不支持的低层 GFM 行为可能开始生效，本次视为接受的产品行为变化。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: Markdown 渲染能力从自定义解析器迁移到 marked + DOMPurify，新增 GFM 表格和删除线支持（不含任务列表）；reading-mode eligibility 新增表格语法信号检测，纯表格 assistant 回复默认进入 reading mode。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/markdownPreview.ts`（重写）
  - `apps/web/src/stores/assistantTextPresentation.ts`（新增表格检测）
  - `apps/web/src/components/workbench/AssistantTextMessage.vue`（新增表格样式）
  - `apps/web/src/components/workbench/WorkspaceMarkdownPreview.vue`（新增表格样式）
  - `apps/web/src/components/workbench/markdownPreview.test.ts`（适配）
  - `apps/web/src/stores/assistantTextPresentation.test.ts`（新增表格用例）
- Dependencies:
  - 新增 `marked`（implementation 时确认当前兼容的 latest 15.x patch 或 latest stable）
  - 新增 `dompurify`（implementation 时确认当前可用且无已知漏洞的 3.3.x patch，不得低于 3.3.2）
  - 依赖版本需在 implementation 前获得确认
- Systems:
  - 无后端变更，无 API 变更
- OpenSpec spec 触点:
  - 本次 change 的 `specs/agent-web-workbench/spec.md` 中声明 MODIFIED requirement，来源为基线 `openspec/specs/agent-web-workbench/spec.md` 的 "Markdown preview" requirement 和 "reading mode" requirement
  - Markdown 渲染能力变更为 marked + DOMPurify，支持 GFM 表格和删除线
  - Reading-mode eligibility 新增表格语法信号检测
  - 不修改归档 spec 文件

## Open Questions

- 需确认使用 marked 的官方配置或扩展点达成 "raw HTML 作为转义后的字面文本显示" 这一行为要求，implementation 时根据实际 API 确认具体方案。
