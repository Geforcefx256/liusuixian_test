# 工作空间侧边栏 UI 修复设计

日期: 2026-04-10

## 修改范围

仅 `apps/web/src/components/workbench/WorkspaceSidebar.vue`（模板 + 脚本 + CSS）

## 改动项

### 1. 去掉"新建 MML"选项
- 移除顶层 "+" 下拉菜单中的 `新建 MML` 按钮
- 移除文件夹内 "+" 下拉菜单中的 `新建 MML` 按钮
- 共 2 处模板移除

### 2. 修复创建文件夹时图标和名字不在一行
- 确保 `.workspace-sidebar__file--editing` 行内 flex 布局不换行
- 图标 SVG 添加 `flex-shrink: 0` 防止被挤压

### 3. 修复文件名和扩展名间距过大
- `.workspace-sidebar__rename-editor` 改为 `display: inline-flex`
- `.workspace-sidebar__rename-input` 的 `flex: 1` 改为 `flex: 0 1 auto`
- 使 extension span 紧跟输入内容

### 4. upload 和 project 文件夹支持展开/收缩
- group-row 改为可点击，左侧添加 `▸/▾` caret
- 新增 `collapsedGroupIds` 响应式 Set 状态
- 收缩时隐藏 group-tree 区域
- group-tree 添加 `overflow-y: auto` 自适应滚动

### 5. 展开/收缩按钮稍微大一点
- group-row 的 caret 增大到 `width: 16px; font-size: 14px`
- 点击热区覆盖整行

## 不变

- 后端接口不变
- Props / emits 接口不变
- 文件树数据结构不变
