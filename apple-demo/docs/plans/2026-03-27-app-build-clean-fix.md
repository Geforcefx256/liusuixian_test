# app 下各应用 build/clean 修复计划

日期：2026-03-27

## 目标
确保 `apps/web`、`apps/web-backend`、`apps/agent-backend` 三个应用均具备完整且可执行的：
- install
- build
- clean

并修复当前 build 链路中的实际失败问题。

## 执行步骤
1. 检查三个应用当前 `package.json`、构建配置和产物目录约定。
2. 分别执行安装与构建，记录失败点。
3. 对每个应用补充标准 `clean` 脚本，确保可以清除构建产物与临时目录。
4. 修复构建失败涉及的配置、路径或代码问题。
5. 重新验证每个应用的 `install -> build -> clean` 链路。

## 约束
- 不改变应用的对外功能语义。
- `clean` 只清理构建产物和安全的临时目录，不删除源码或运行时业务数据。
- 优先使用应用本地脚本完成各自职责，避免将单应用职责错误上提到根目录。

## 预期结果
- `apps/web` 支持 `npm install` / `npm run build` / `npm run clean`
- `apps/web-backend` 支持 `npm install` / `npm run build` / `npm run clean`
- `apps/agent-backend` 支持 `npm install` / `npm run build` / `npm run clean`
- 构建失败问题被定位并修复
