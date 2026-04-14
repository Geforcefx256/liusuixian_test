# 工作空间侧边栏 UI 修复实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复工作空间侧边栏 5 项 UI 问题：去掉新建 MML、修复文件夹图标对齐、修复文件名间距、添加分组展开/收缩、增大展开按钮

**Architecture:** 所有改动集中在 `WorkspaceSidebar.vue` 的模板 + 脚本 + CSS，以及对应测试文件。无后端改动。

**Tech Stack:** Vue 3 + TypeScript + Vitest

---

### Task 1: 去掉"新建 MML"选项

**Files:**
- Modify: `apps/web/src/components/workbench/WorkspaceSidebar.vue:67` (顶层菜单)
- Modify: `apps/web/src/components/workbench/WorkspaceSidebar.vue:220` (文件夹内菜单)

**Step 1: 移除顶层 "+" 菜单中的 MML 选项**

在 `WorkspaceSidebar.vue` 第 67 行，删除：

```html
<button type="button" @click="handleCreateWorking('mml', null)">新建 MML</button>
```

**Step 2: 移除文件夹内 "+" 菜单中的 MML 选项**

在第 220 行，删除：

```html
<button type="button" @click.stop="handleCreateWorking('mml', node.relativePath)">新建 MML</button>
```

**Step 3: 验证测试通过**

Run: `pnpm --filter @apple-demo/web test -- --run WorkspaceSidebar`
Expected: PASS（现有测试不依赖 MML 创建按钮）

**Step 4: Commit**

```bash
git add apps/web/src/components/workbench/WorkspaceSidebar.vue
git commit -m "fix(web): remove MML option from workspace create menus"
```

---

### Task 2: 修复创建文件夹时图标和名字不在一行

**Files:**
- Modify: `apps/web/src/components/workbench/WorkspaceSidebar.vue` CSS 部分（约第 974 行 `.workspace-sidebar__file` 样式）

**Step 1: 确保 file--editing 行不换行且图标不被挤压**

在 `.workspace-sidebar__file` 样式中（第 974 行），添加 `flex-wrap: nowrap`：

```css
.workspace-sidebar__file {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  padding: 8px 10px;
  text-align: left;
  flex-wrap: nowrap;
}
```

**Step 2: 确保 SVG 图标不被挤压**

在 `.workspace-sidebar__file .icon-svg` 或 `.workspace-sidebar__file--editing .icon-svg` 中添加 `flex-shrink: 0`。

找到已有的 `.icon-svg` 样式块（约在全局样式附近），确认是否已有 `flex-shrink: 0`。如果没有，在 `.workspace-sidebar__file--editing .icon-svg` 中添加：

```css
.workspace-sidebar__file--editing .icon-svg {
  flex-shrink: 0;
}
```

**Step 3: 验证**

Run: `pnpm --filter @apple-demo/web test -- --run WorkspaceSidebar`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/components/workbench/WorkspaceSidebar.vue
git commit -m "fix(web): prevent folder icon from wrapping to next line in sidebar"
```

---

### Task 3: 修复文件名和扩展名间距过大

**Files:**
- Modify: `apps/web/src/components/workbench/WorkspaceSidebar.vue:1111-1118` (CSS)

**Step 1: 修改 rename-editor 和 rename-input 样式**

将第 1111-1119 行的样式从：

```css
.workspace-sidebar__rename-editor {
  display: flex;
  align-items: center;
}

.workspace-sidebar__rename-input {
  flex: 1;
  min-width: 0;
}
```

改为：

```css
.workspace-sidebar__rename-editor {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
}

.workspace-sidebar__rename-input {
  flex: 0 1 auto;
  min-width: 0;
}
```

**Step 2: 验证**

Run: `pnpm --filter @apple-demo/web test -- --run WorkspaceSidebar`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/components/workbench/WorkspaceSidebar.vue
git commit -m "fix(web): reduce gap between filename input and extension in sidebar"
```

---

### Task 4: upload 和 project 文件夹支持展开/收缩

**Files:**
- Modify: `apps/web/src/components/workbench/WorkspaceSidebar.vue:44-71` (模板 - group-row)
- Modify: `apps/web/src/components/workbench/WorkspaceSidebar.vue:73-75` (模板 - group-tree v-if)
- Modify: `apps/web/src/components/workbench/WorkspaceSidebar.vue:386` (脚本 - 新增状态)
- Modify: `apps/web/src/components/workbench/WorkspaceSidebar.vue` CSS (group-row 样式)
- Modify: `apps/web/src/components/workbench/WorkspaceSidebar.test.ts` (添加测试)

**Step 1: 在脚本中添加 collapsedGroupIds 状态**

在第 387 行 `const newMenuOpen = ref(false)` 之前，添加：

```typescript
const collapsedGroupIds = ref(new Set<string>())
```

**Step 2: 添加 toggleGroupCollapse 函数**

在脚本中合适位置添加：

```typescript
function toggleGroupCollapse(groupId: string): void {
  const next = new Set(collapsedGroupIds.value)
  if (next.has(groupId)) {
    next.delete(groupId)
  } else {
    next.add(groupId)
  }
  collapsedGroupIds.value = next
}
```

**Step 3: 修改模板 group-row — 添加 caret 和点击事件**

将第 44 行的 group-row `<div>` 改为：

```html
<button
  class="workspace-sidebar__group-row"
  type="button"
  :aria-label="collapsedGroupIds.has(group.id) ? '展开' : '收起'"
  @click="toggleGroupCollapse(group.id)"
>
  <div class="workspace-sidebar__group-meta">
    <span class="workspace-sidebar__group-caret">
      {{ collapsedGroupIds.has(group.id) ? '▸' : '▾' }}
    </span>
    <svg viewBox="0 0 24 24" class="icon-svg" aria-hidden="true">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
    <span>{{ group.label }}</span>
    <span v-if="group.entries.length > 0" class="workspace-sidebar__group-count">{{ group.entries.length }}</span>
  </div>
  <div v-if="group.id === 'working'" class="workspace-sidebar__group-actions" @click.stop>
    <!-- ... 保持不变 ... -->
  </div>
</button>
```

注意：`group-actions` 上的 `@click.stop` 防止点击 "+" 按钮时触发折叠。

**Step 4: 修改 group-tree 的 v-if 条件**

将第 73-75 行的 `v-if` 条件加上折叠判断：

```html
<div
  v-if="!collapsedGroupIds.has(group.id) && (groupVisibleNodeMap[group.id].length > 0 || (group.id === 'working' && creatingKind))"
  class="workspace-sidebar__group-tree"
>
```

**Step 5: 添加 CSS 样式**

在 `.workspace-sidebar__group-row` 样式中（第 910 行），改为按钮样式：

```css
.workspace-sidebar__group-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-block: 12px 8px;
  font-size: var(--font-dense);
  width: 100%;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  padding: 4px 6px;
  cursor: pointer;
  color: inherit;
  text-align: left;
}

.workspace-sidebar__group-row:hover {
  background: var(--surface-subtle);
}

.workspace-sidebar__group-caret {
  width: 16px;
  font-size: 14px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
```

同时给 `.workspace-sidebar__group-tree` 添加滚动：

```css
.workspace-sidebar__group-tree {
  display: grid;
  gap: 4px;
  min-width: 0;
  overflow-y: auto;
}
```

**Step 6: 添加测试**

在测试文件中添加折叠/展开测试：

```typescript
it('collapses and expands groups on click', async () => {
  const wrapper = mount(WorkspaceSidebar, {
    props: buildProps()
  })

  // group-tree initially visible
  expect(wrapper.find('.workspace-sidebar__group-tree').exists()).toBe(true)

  // click group-row to collapse
  await wrapper.findAll('.workspace-sidebar__group-row')[0].trigger('click')
  expect(wrapper.find('.workspace-sidebar__group-tree').exists()).toBe(false)

  // click again to expand
  await wrapper.findAll('.workspace-sidebar__group-row')[0].trigger('click')
  expect(wrapper.find('.workspace-sidebar__group-tree').exists()).toBe(true)
})
```

**Step 7: 运行测试验证**

Run: `pnpm --filter @apple-demo/web test -- --run WorkspaceSidebar`
Expected: PASS

**Step 8: Commit**

```bash
git add apps/web/src/components/workbench/WorkspaceSidebar.vue apps/web/src/components/workbench/WorkspaceSidebar.test.ts
git commit -m "feat(web): add expand/collapse for upload and project groups in workspace sidebar"
```

---

### Task 5: 增大展开/收缩按钮

**Files:**
- Modify: `apps/web/src/components/workbench/WorkspaceSidebar.vue` CSS

**说明:** 此任务已合并到 Task 4 的 CSS 中 — `group-caret` 的 `width: 16px; font-size: 14px` 和 `group-row` 的 `padding: 4px 6px` 点击热区。如果 Task 4 已实现，此任务无需额外操作。

---

## 完成验证

完成所有 Task 后，运行完整测试确认无回归：

```bash
pnpm --filter @apple-demo/web test
```

然后启动前端手动验证：

```bash
pnpm dev:web
```

确认：
1. "+" 菜单中不再有"新建 MML"
2. 创建文件夹时图标和名字在同一行
3. 创建文件时扩展名紧跟输入内容
4. upload/project 分组可展开/收缩
5. 展开按钮足够大，点击方便
