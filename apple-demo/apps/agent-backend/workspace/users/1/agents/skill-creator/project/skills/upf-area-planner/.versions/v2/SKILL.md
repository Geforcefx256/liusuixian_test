---
id: upf-area-planner
name: upf-area-planner
description: 解析 UPF 服务区规划数据并生成 MML 命令
when-to-use: 当需要根据 UPF 服务区规划数据生成 MML 配置命令时使用
depends-on:
  - mml-cli
allowed-tools:
  - local:question
---

# UPF 服务区规划工具

## 目标
解析 CSV/表格格式的 UPF 服务区规划数据，生成相应的 MML 命令（ADD UPAREA、UPAREABIND 等）。

## 交互规则

1. **必填参数收集**：
   - 用户必须提供规划数据（CSV 格式）
   - 如果用户未提供现网配置信息，需要询问 MML 脚本文件路径，然后使用 mml-cli 的 file-query 查询现有 AREANAME

2. **参数处理**：
   - 规划数据必须包含以下列：网络类型,服务区类型,起始服务区,终止服务区,原UPF服务区,新UPF服务区
   - 服务区类型如果为空，根据网络类型自动推断：
     - 2/3G → LAI
     - 4G → TAI
     - 5G → N2TAI

3. **执行流程**：
   - 解析规划数据
   - 查询现网配置（如需要）
   - 生成 MML 命令
   - 输出生成结果和统计信息

## 操作步骤

1. **收集规划数据**：
   - 向用户获取 CSV 格式的规划数据
   - 验证数据格式是否包含必需的列

2. **查询现网配置**（可选但推荐）：
   - 询问用户 MML 脚本文件路径
   - 使用 mml-cli 的 file-query 模板查询现有 AREANAME
   - 命令：`skill:exec({ skillName: "mml-cli", templateId: "file-query", args: { file: "文件路径", commandNames: ["ADD UPAREA"], select: "AREANAME" } })`

3. **生成命令**：
   - 调用本 Skill 的 generate 模板
   - 传入规划数据和现网配置信息

4. **输出结果**：
   - 显示生成的 MML 命令
   - 显示统计信息（ADD UPAREA 数量、ADD BIND 数量、RMV BIND 数量）
   - 确保命令顺序正确：ADD UPAREA 命令在前，绑定命令在后

## 参数来源约束

- **规划数据**：必须从用户输入获取
- **现网配置**：优先从用户提供的 MML 文件查询，如用户无法提供，可跳过此步骤
- **MML 文件路径**：必须明确询问用户，禁止扫描目录

## 输出格式

输出应包含：
1. 生成的 MML 命令列表（每行一条命令）
2. 统计信息：
   - 新增 UPAREA 数量
   - 新增绑定数量
   - 移除绑定数量
3. 解析后的规划数据概览

## 注意事项

1. **命令顺序**：ADD UPAREA 命令必须在 UPAREABIND 命令之前执行
2. **服务区类型映射**：
   - 2/3G + LAI → UPAREABINDLAI
   - 4G + TAI → UPAREABINDS1TAI
   - 5G + N2TAI → UPAREABINDN2TAI
3. **空值处理**：新 UPF 服务区为空时，只生成 RMV 命令，不生成 ADD 命令
4. **去重处理**：同一服务区名+类型组合只生成一次 ADD UPAREA 命令
5. **错误处理**：数据格式错误时给出明确提示