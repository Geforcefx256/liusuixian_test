# 当前结构折中演进方案（低成本版）

日期：2026-03-27

## 背景
当前仓库相对 `origin/agent-V2-base` 已从完整 pnpm monorepo 收缩为以 `apps/` 为中心的三服务产品仓：
- `apps/web`
- `apps/web-backend`
- `apps/agent-backend`
- `openspec/`

当前方案的优势是业务聚焦、启动链路清晰、前端和认证后端范围收敛；不足是缺少根级 workspace 编排、共享包层与统一测试入口，长期会导致复用能力下降、边界变糊、依赖治理成本上升。

本方案目标不是回退到完整 `agent-V2-base`，而是在保持当前产品化结构前提下，以最低成本补回最关键的工程骨架。

---

## 目标状态
保留当前目录主形态：

```text
apps/
  web/
  web-backend/
  agent-backend/
packages/
  shared/
  agent-contracts/
scripts/
tests/
docs/plans/
openspec/
package.json
pnpm-workspace.yaml
tsconfig.base.json
```

说明：
- 继续保留 `apps/` 命名，不强制改回 `apps/`，避免大规模路径迁移。
- 不一次性恢复 `mml-core` / `agent-core` 全量包，只先恢复“最值得抽离”的薄共享层。
- 根级 `tests/` 只新增跨应用/跨包边界测试，不搬走现有 app 内部测试。

---

## 必补目录/包

### 1. 根级 workspace 骨架（优先级 P0）
必须补回：
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `scripts/`
- 可选：根 `vitest.workspace.ts` 或统一测试脚本

作用：
- 统一安装依赖
- 统一 `dev/build/test/type-check`
- 提供统一构建与发布产物组装入口
- 为后续共享包提供合法 workspace 入口

推荐内容：
- `pnpm-workspace.yaml`
  - `apps/*`
  - `packages/*`
- 根 `package.json` 脚本：
  - `dev:web`
  - `dev:api`
  - `dev:all`
  - `build`
  - `build:web`
  - `build:web-backend`
  - `build:agent-backend`
  - `assemble`
  - `test`
  - `type-check`
- 根 `scripts/` 首批建议：
  - `clean-dist.mjs`
  - `assemble-web-backend.mjs`
  - `assemble-agent-backend.mjs`
  - 可选：`kill-port.mjs`

原则：
- 只做编排，不改变现有 app 启动方式。
- 允许 app 内继续保留自己的 `package.json` 与本地脚本。
- 整体构建脚本只负责组装产物，不吞掉各 app 自己的 build 责任。

### 2. `packages/shared`（优先级 P0）
第一批应抽出的内容：
- 通用 TypeScript 类型
- API DTO / 响应体定义
- 用户/会话/角色基础类型
- 文件元数据类型
- 通用 zod schema（如果前后端共用）
- 小型纯函数工具（不能依赖 Vue / Express / Node runtime）

不建议一开始放进去的内容：
- UI 逻辑
- Store
- Express middleware
- Agent runtime 逻辑

目标：
- 先解决“重复定义”和“协议漂移”问题。
- 让 `apps/web` 和两个 backend 的协议先稳定。

### 3. `packages/agent-contracts`（优先级 P1）
这是折中方案里最关键的新包。

建议不要一上来恢复完整 `agent-core`，而是先建立一个更薄的：
- `packages/agent-contracts`

内容只放：
- agent 会话模型
- 对话消息模型
- tool call / tool result 协议类型
- workbench 富消息协议类型
- 上传文件、审批、计划状态等前后端共享协议
- 可选：协议 schema / validator

为什么不是直接恢复 `agent-core`：
- 当前 `apps/agent-backend` 还在快速演化
- 如果过早抽 runtime/service 实现，会把频繁变动的内部逻辑锁死
- 先抽“契约”，成本低、收益高、风险小

### 4. 根级 `tests/`（优先级 P1）
建议新增但保持很薄：
- `tests/contracts/`
- `tests/integration/`

分别用于：
- `contracts/`：共享类型/schema/序列化兼容性测试
- `integration/`：跨服务关键链路冒烟测试

首批只补 3 类测试：
1. web <-> web-backend 登录/会话协议
2. web <-> agent-backend 对话/流式事件协议
3. agent-backend 文件/工作区协议

不要做：
- 大规模迁移 app 内已有测试到根目录

### 5. `docs/architecture/`（优先级 P2）
补回最少文档：
- `docs/architecture/repository-structure.md`
- `docs/architecture/agent-protocol-boundaries.md`

作用：
- 让后续抽包有边界依据
- 避免 shared/contracts 再次膨胀成“杂物间”

---

## 不建议现在补回的包

### 不建议立即恢复 `packages/mml-core`
原因：
- 当前前端已收敛，MML 相关复杂度暂未成为主矛盾
- 现在恢复它，收益不如先治理协议与依赖

触发条件：
- 当 MML 解析/生成逻辑再次在前端、后端、agent 内重复出现
- 或需要独立测试 MML 引擎时，再抽

### 不建议立即恢复完整 `packages/agent-core`
原因：
- 当前 agent backend 变化仍快
- runtime、tool provider、session 管理、planner 等尚未稳定
- 过早抽实现层会造成频繁跨包改动

触发条件：
- 当第二个 consumer（例如 CLI、另一个 web、离线工具）需要复用 agent runtime
- 或 `apps/agent-backend/src` 再明显膨胀并出现重复子模块时，再拆

---

## 低成本演进路径

### 阶段 1：补基础骨架（1 次小改，P0）
目标：恢复 monorepo 编排，但不碰业务代码。

动作：
1. 新增根 `package.json`
2. 新增 `pnpm-workspace.yaml`
3. 新增根 `tsconfig.base.json`
4. 新增根 `scripts/`，补整体构建/组装脚本
5. 把三套 app 纳入 workspace
6. 补统一 README 的开发命令

验收：
- 根目录 `pnpm install` 成功
- 根目录能运行 `pnpm -r test`
- 根目录能运行统一 `pnpm build`
- `pnpm build` 不只是编译，还能得到约定好的可发布产物目录

收益：
- 这是所有后续低成本优化的前提
- 对现有代码影响最小

### 阶段 2：抽 `packages/shared`（P0）
目标：只抽协议基础与纯类型。

优先迁移内容：
- 用户/认证 DTO
- 通用 API 响应格式
- 文件资产元数据类型
- 前端与 backend 同名重复类型

做法：
- 先复制，再逐步替换 import
- 每迁一组类型就补一组兼容测试
- 不做大爆炸式迁移

验收：
- `apps/web` 和 `apps/web-backend` 至少共享一批真实 DTO
- 删除明显重复类型定义

### 阶段 3：抽 `packages/agent-contracts`（P1）
目标：稳定协议，不移动 runtime 实现。

优先迁移内容：
- 会话/消息/事件协议
- 工具调用结果结构
- workbench 结构化消息协议
- 前端 store 和 agent-backend 共用的协议枚举/状态模型

验收：
- web 与 agent-backend 的协议 import 不再靠复制/本地定义
- 协议变更只需改 1 个包

### 阶段 4：补根级边界测试（P1）
目标：防止之后的抽包带来静默破坏。

动作：
- 新增 `tests/contracts`
- 新增 `tests/integration`
- 用最小冒烟测试覆盖核心跨边界链路

验收：
- 关键接口改动时能第一时间失败

### 阶段 5：视情况再拆 `mml-core` / `agent-core`（P2）
只有在出现明确复用需求时再做，不提前投资。

---

## 目录建议（建议版）

```text
.
├─ apps/
│  ├─ web/
│  ├─ web-backend/
│  └─ agent-backend/
├─ packages/
│  ├─ shared/
│  │  └─ src/
│  │     ├─ api/
│  │     ├─ auth/
│  │     ├─ common/
│  │     ├─ files/
│  │     └─ index.ts
│  └─ agent-contracts/
│     └─ src/
│        ├─ conversation/
│        ├─ protocol/
│        ├─ session/
│        ├─ tools/
│        └─ index.ts
├─ scripts/
│  ├─ clean-dist.mjs
│  ├─ assemble-web-backend.mjs
│  ├─ assemble-agent-backend.mjs
│  └─ kill-port.mjs
├─ tests/
│  ├─ contracts/
│  └─ integration/
├─ docs/
│  ├─ architecture/
│  └─ plans/
├─ openspec/
├─ package.json
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

---

## 迁移原则

1. **目录名不强制回退到 `apps/`**
   - `apps/` 可以保留，避免纯形式迁移。

2. **先抽契约，再抽实现**
   - 先 `shared` / `agent-contracts`
   - 后 `mml-core` / `agent-core`

3. **先并存，后替换**
   - 允许过渡期本地类型与共享类型同时存在
   - 用 lint / grep / 测试逐步收敛

4. **共享包只放稳定内容**
   - 高频变动逻辑留在 app 内
   - 低频稳定协议进入 packages

5. **根测试只测边界，不吞并所有单测**
   - app 内测试继续留原地
   - 根测试只负责跨模块契约

---

## 推荐优先级

### 必做（现在就做）
1. 根 `package.json`
2. `pnpm-workspace.yaml`
3. `tsconfig.base.json`
4. 根 `scripts/` 与统一 `build`/`assemble` 入口
5. `packages/shared`

### 应做（基础稳定后）
6. `packages/agent-contracts`
7. `tests/contracts`
8. `tests/integration`

### 暂缓
9. `packages/mml-core`
10. `packages/agent-core`
11. 大规模目录回退到 `apps/`

---

## 最终建议

折中方案不是恢复整个 `agent-V2-base`，而是：

- **保留当前 `apps/` 产品化组织和收敛后的业务面**
- **补回根级 workspace 编排**
- **补回根级整体构建脚本，统一编译和产物组装**
- **只恢复两层薄共享包：`shared` + `agent-contracts`**
- **用少量根级边界测试守住协议**

这样能以较低成本拿回 70% 的 monorepo 优势，同时保住当前主线的交付效率。
