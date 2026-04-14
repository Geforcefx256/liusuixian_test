## 1. 依赖安装

- [x] 1.1 在 `apps/web/package.json` 添加 `marked@15.0.7` 和 `dompurify@3.3.0` 依赖
- [x] 1.2 执行 `pnpm install` 确认依赖解析无误，验证类型声明可用（dompurify 自带类型，不安装 @types/dompurify）

## 2. 解析器替换

- [x] 2.1 重写 `apps/web/src/components/workbench/markdownPreview.ts`，使用 marked + DOMPurify 实现，保持 `renderMarkdownToHtml(source: string): string` 导出接口不变
- [x] 2.2 配置 marked：`gfm: true`, `breaks: true`；通过 html renderer 覆盖将原始 HTML 转义为字面文本
- [x] 2.3 配置自定义 renderer：link 方法应用与当前 `normalizeUrl()` 相同的协议白名单（仅允许 http/https/mailto/#锚点/相对路径），非白名单协议不输出 `<a>` 仅返回链接纯文本；白名单内链接添加 `target="_blank" rel="noreferrer"`
- [x] 2.4 配置 DOMPurify：ALLOW_TAGS 白名单覆盖 marked 合法产出标签集（p, h1-h6, blockquote, pre, hr, ul, ol, li, br, strong, em, a, code, del, table, thead, tbody, tr, th, td）

## 3. Eligibility 扩展

- [x] 3.1 在 `apps/web/src/stores/assistantTextPresentation.ts` 新增 GFM 表格分隔行检测模式
- [x] 3.2 在 `isAssistantTextReadingModeEligible` 中使用该模式，使包含表格语法的文本通过 eligibility 检测

## 4. 样式补充

- [x] 4.1 在 `apps/web/src/components/workbench/AssistantTextMessage.vue` 添加 `:deep(table)` 系列样式，确保宽表格可横向滚动且不撑破气泡布局
- [x] 4.2 在 `apps/web/src/components/workbench/WorkspaceMarkdownPreview.vue` 添加 `:deep(table)` 系列样式

## 5. 测试适配与补充

- [x] 5.1 适配 `apps/web/src/components/workbench/markdownPreview.test.ts` 现有用例至新实现输出格式
- [x] 5.2 新增表格渲染测试用例
- [x] 5.3 新增删除线渲染测试用例
- [x] 5.4 新增 XSS 防护测试：原始 HTML 作为字面文本显示、危险协议链接降级为纯文本
- [x] 5.5 在 `apps/web/src/stores/assistantTextPresentation.test.ts` 新增表格 eligibility 用例
- [x] 5.6 新增裸 URL autolink 渲染测试用例，锁定接受的产品行为变化
- [x] 5.7 运行全量前端测试，确认无回归

## 6. 验证

- [ ] 6.1 启动前端，在聊天窗口发送包含表格的 markdown 内容，确认渲染正确且默认进入 reading mode
- [ ] 6.2 确认链接点击行为（新窗口打开、协议白名单生效）
- [ ] 6.3 确认原始 HTML 输入作为字面文本显示
- [ ] 6.4 确认宽表格在窄气泡内可横向滚动而不撑破布局
