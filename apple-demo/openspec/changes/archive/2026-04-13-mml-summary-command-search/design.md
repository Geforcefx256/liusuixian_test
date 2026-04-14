# Design: MML 汇总页面命令搜索

## 修改范围

仅涉及 `apps/web/src/components/workbench/WorkspaceEditorPane.vue`，纯前端变更，无后端改动。

## 数据流

```
mmlSummarySearchQuery (ref<string>)
        │
        ▼
filteredMmlSheets (computed)
  = mmlWorkbook.sheets.filter(s =>
      s.commandHead.toUpperCase().includes(query.toUpperCase())
    )
        │
        ▼
模板 v-for 从 mmlWorkbook.sheets 改为 filteredMmlSheets
```

## 状态设计

在组件 `<script>` 中新增：

| 状态 | 类型 | 说明 |
|-----|------|------|
| `mmlSummarySearchQuery` | `ref('')` | 搜索框绑定值 |
| `filteredMmlSheets` | `computed` | 基于 query 过滤后的 sheet 列表 |

- 搜索为大小写不敏感匹配（MML 命令通常大写，但允许用户小写输入）
- 搜索框为空时 `filteredMmlSheets` 返回全部 sheets，行为与当前一致
- 切换文件或离开汇总页时，`mmlSummarySearchQuery` 无需重置（随 workbook 数据变化自然适配）

## 模板结构变更

在 `workspace-editor__mml-summary-hero` 和 `workspace-editor__mml-summary-grid` 之间插入搜索框：

```
hero 区域
─────────────────
搜索框（新增）       ← workspace-editor__mml-summary-search
─────────────────
card grid          ← v-for 改为遍历 filteredMmlSheets
  或
空状态提示           ← 当 filteredMmlSheets 为空且 query 非空
  或
原有空状态           ← 当 sheets 本身为空（无命令）
```

空状态判断逻辑：

```
sheets.length === 0        → "未识别到任何MML命令，请在文本视图下增加命令。"（现有）
sheets.length > 0
  && filteredMmlSheets === 0 → "未找到匹配的命令"（新增）
```

## 样式设计

搜索框复用项目已有的输入框风格，与 summary card 视觉一致：

```css
.workspace-editor__mml-summary-search {
  /* 与 hero/card 同等圆角和边框风格 */
  padding: 8px 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  background: #fff;
  width: 100%;
  font-size: inherit;
  color: var(--text-primary);
  outline: none;
}

.workspace-editor__mml-summary-search:focus {
  border-color: var(--line-strong);
}

.workspace-editor__mml-summary-search::placeholder {
  color: var(--text-secondary);
}
```

## 不做的事

- 不引入防抖：sheet 数量有限（通常 <100），同步过滤无性能问题
- 不持久化搜索状态：纯瞬态 UI 状态
- 不新增组件：改动量小，直接在 WorkspaceEditorPane 内完成
