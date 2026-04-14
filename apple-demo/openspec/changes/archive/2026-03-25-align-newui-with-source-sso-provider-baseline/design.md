## Context

当前仓库的 `newui` 分支已经具备独立演进的 `apps/web`、`apps/web-backend` 和 `apps/agent-backend`，但这三块能力与 `/Users/derrick92/Documents/code/codex/apple-demo` 已经形成语义分叉。分叉主要集中在三处：

- SSO 只迁入了部分基础能力，源仓库中的完整 OAuth/SSO 行为并未被完整吸收。
- `huaweiHisApi` provider 在当前仓库中只有部分 transport/header/body 支持，尚未完全对齐源仓库的配置与活动模型语义。
- 同名三方件在两个仓库中已出现版本漂移，导致运行时与测试基线不一致。

这次变更的约束很明确：

- `/Users/derrick92/Documents/code/codex/apple-demo` 是 SSO、`huaweiHisApi` 和共享依赖版本的真值基线。
- 当前仓库保留 `newui` 的目录结构、UI 基线和现有 workbench 面。
- 不能通过静默 fallback、mock 路径或“先兼容着跑”的方式规避差异，差异必须显式收敛。

## Goals / Non-Goals

**Goals:**

- 将源仓库中的完整 SSO 特性集按语义迁入当前 `newui` 主线。
- 将 `huaweiHisApi` provider 的配置、解析、运行和测试语义与源仓库对齐。
- 将当前仓库与源仓库共享的三方件版本统一到源仓库基线。
- 在保留当前 `newui` UI 和目录布局的前提下完成上述对齐。

**Non-Goals:**

- 不将当前仓库整体回退成源仓库的 monorepo 结构。
- 不替换当前 `newui` 前端为源仓库的前端实现。
- 不引入超出源仓库基线的新 SSO 或 provider 产品能力。
- 不为了降低改造成本而保留长期双轨语义。

## Decisions

### 1. 以“语义对齐迁移”替代“提交级硬合并”

`newui` 与源仓库的历史已经分叉，且当前仓库自身又在认证、runtime 和 workbench 上继续演进。直接按 commit `merge` 或大面积 `cherry-pick` 会把旧路径覆盖到当前路径上，风险高且不可控。

因此本次采用“源仓库为语义真值，当前仓库为实现载体”的迁移方式：

- 先以 OpenSpec 定义必须对齐的行为契约。
- 再在 `apps/web-backend`、`apps/web`、`apps/agent-backend` 中按当前结构实现这些契约。

备选方案：
- 直接合并源分支：历史不共线，冲突面过大。
- 只迁局部补丁：无法满足“SSO 是完整新特性基线”的要求。

### 2. SSO 按完整能力域拆分对齐，而不是按单个 bug patch 对齐

SSO 对齐不再只包含 `SameSite` 或 wildcard allowlist，而是按完整能力域处理：

- auth mode 与登录入口语义
- login-url、callback、state 持久化与单次消费
- identity binding 与首次建号策略
- session cookie 策略与跨端口 same-site 行为
- same-origin 与 wildcard origin allowlist
- 最小 userinfo 兼容
- OAuth refresh、upstream logout、token cipher

这样做的原因是这些能力在源仓库中已经形成闭环，拆成零散 patch 迁移会再次制造半迁移状态。

备选方案：
- 只补当前已知缺口：短期可用，但会持续保留 auth 语义分叉。

### 3. `huaweiHisApi` 按“配置 + 解析 + 运行 + 测试”四层对齐

当前仓库已经具备 `custom.headers` 和 `custom.body` 的部分支持，但这不足以认定 `huaweiHisApi` 已完成迁移。本次要求同时对齐四层内容：

- 配置层：`modelRegistry` 中的 `huaweiHisApi` 条目、默认值、超时、采样与 custom payload 基线。
- 解析层：`activeModel` / `modelsByAgent.activeModel` 的归一化规则，以及 runtime model 的选取顺序。
- 运行层：provider request headers/body、request URL、错误与日志语义。
- 测试层：配置解析与 provider client 行为测试需要反映源仓库语义。

备选方案：
- 仅保留 transport 能力：会让配置和运行时观察结果继续漂移。

### 4. 共享依赖版本统一到源仓库基线

对于两个仓库共同使用的三方件，不再以“当前哪个更高”或“当前哪个先装上”为准，而是统一以源仓库版本为准。对齐范围至少覆盖：

- `vue`
- `@vue/compiler-sfc`
- `vue-tsc`
- `typescript`
- `vitest`
- `@types/node`
- `zod`
- `sql.js`
- `tsx`
- `express`

这样做的原因是源仓库已经作为本次能力对齐的真值基线，版本分叉会直接影响测试、构建和运行时语义。

备选方案：
- 保留当前版本组合：后续每次迁移源仓库能力都要先重新解释版本差异。

### 5. 迁移顺序按“依赖基线 → 认证契约 → runtime provider”推进

推荐顺序如下：

1. 先统一共享依赖版本，稳定构建与测试基线。
2. 再收敛 SSO 契约与服务端认证行为。
3. 最后对齐 `huaweiHisApi` 与 runtime model 选择语义。

这样可以避免 provider 行为调试被底层依赖和认证分叉噪音掩盖。

## Risks / Trade-offs

- [Risk] SSO 对齐涉及 `web`、`web-backend`、`agent-backend` 三侧联动，容易出现“单侧完成、整体未闭环”。
  → Mitigation: 以 spec 为驱动拆分 capability，要求每条 requirement 都有明确场景和回归测试。

- [Risk] 共享依赖版本回收到源仓库基线后，可能暴露当前 `newui` 中被高版本或低版本偶然掩盖的问题。
  → Mitigation: 先统一版本，再跑类型检查和相关测试，避免把依赖差异和业务差异混在一起排查。

- [Risk] `huaweiHisApi` 在当前仓库里看似“部分可用”，容易被误判为无需迁移。
  → Mitigation: 以配置解析、运行时选择和测试语义是否一致作为完成标准，而不是只看请求是否能发出。

- [Risk] 直接照搬源仓库代码会破坏当前 `newui` 的 UI 与目录布局。
  → Mitigation: 仅以源仓库作为行为基线，不复制其整体结构。

## Migration Plan

1. 统一共享三方件版本到源仓库基线，并更新 lockfile。
2. 在 `apps/web-backend` 和 `apps/web` 中完成完整 SSO 语义对齐。
3. 在 `apps/agent-backend` 中完成 wildcard allowlist、auth 集成和 `huaweiHisApi` 相关 runtime 语义对齐。
4. 跑通与认证、runtime、provider 相关的测试和类型检查。
5. 若迁移中发现当前 `newui` 行为与源仓库存在不可兼容点，以 spec 记录差异并显式决策，不保留隐式双轨逻辑。

## Open Questions

- `newui` 前端是否需要显式消费 OAuth upstream logout 返回的重定向结果，还是由后端维持现有路由契约后再由前端跳转。
- 共享依赖对齐时，是否需要一次性引入源仓库 root 级 `pnpm` overrides，还是仅对当前三套 `apps/*` 包进行版本收敛。
