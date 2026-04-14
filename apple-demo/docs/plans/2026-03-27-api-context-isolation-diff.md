# 当前分支 vs origin/agent-V2-base 的 API 上下文隔离差异分析计划

日期：2026-03-27

## 目标
检查当前分支是否仍保留远端 `origin/agent-V2-base` 中为 Nginx 代理准备的 API 上下文隔离：
- `web-backend` 使用的上下文前缀
- `agent-backend` 使用的上下文前缀
- 前端调用时使用的 API base
- 代理层（Vite / Nginx）是否仍按上下文拆分

## 执行步骤
1. 检查当前分支与远端分支中的：前端 API 配置、Vite 代理配置、后端路由挂载前缀、Nginx 配置。
2. 提取 `web-backend` 与 `agent-backend` 的 context path 是否仍分别存在。
3. 判断当前分支是否还能通过统一域名 + 不同前缀方式让 Nginx 反向代理。
4. 输出差异与结论。
