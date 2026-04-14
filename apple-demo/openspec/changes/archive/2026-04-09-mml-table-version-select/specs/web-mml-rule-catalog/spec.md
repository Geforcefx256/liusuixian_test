## ADDED Requirements

### Requirement: Web 后端 SHALL 为表格视图选择暴露 MML 类型与版本选项
Web 后端 SHALL 暴露需要认证的 `网元类型` 与 `网元版本` 选项数据，使前端表格视图流程能够基于后端规则数据渲染下拉候选。

#### Scenario: 选项查询返回可用的网元类型与版本
- **WHEN** 一个已认证客户端请求 MML 类型版本选项接口，且后端已经存在导入后的规则数据
- **THEN** `web-backend` MUST 从已存储的规则数据中返回可选的 `网元类型` 值及其对应的 `网元版本` 值
- **AND** 该响应 MUST 足以支持前端渲染默认值为 `请选择` 的下拉框

#### Scenario: 规则数据为空时返回空选项集合
- **WHEN** 一个已认证客户端请求 MML 类型版本选项接口，且后端没有任何已导入规则数据
- **THEN** `web-backend` MUST 返回空选项数据
- **AND** 服务 MUST NOT 伪造占位的类型或版本值

## MODIFIED Requirements

### Requirement: Web 后端 SHALL 负责已导入 MML 规则目录的完整生命周期
Web 后端 SHALL 将固定的 Excel 驱动 MML 规则工作簿视为 `networkType + networkVersion` schema 查询的规范来源，并 SHALL 负责该目录的导入、存储、替换以及导入后清理生命周期。

#### Scenario: 启动导入接受新的工作簿命名规则
- **WHEN** `web-backend` 在启用 MML 规则导入时启动，且配置的规则目录中存在名为 `CHECK_RULE_<networkType>_<networkVersion>.xlsx` 的工作簿
- **THEN** 服务 MUST 解析该工作簿中的 `CHECK_RULE` sheet
- **AND** 服务 MUST 从该文件名中解析出 `networkType` 和 `networkVersion`

#### Scenario: 相同类型和版本的旧规则在导入前被替换
- **WHEN** `web-backend` 扫描到一个其 `networkType + networkVersion` 已存在于存储规则数据中的工作簿
- **THEN** 服务 MUST 在导入新工作簿内容之前删除该相同 `networkType + networkVersion` 的旧存储数据
- **AND** 服务 MUST 将新导入的命令和参数持久化为该组合的当前存储数据

#### Scenario: 导入成功持久化后删除原工作簿
- **WHEN** `web-backend` 成功从一个匹配规则的工作簿中导入并持久化规则数据
- **THEN** 服务 MUST 从导入目录中删除该源工作簿文件
- **AND** 在新规则数据成功保存之前，服务 MUST NOT 删除该源文件

### Requirement: Web 后端 SHALL 暴露规范的认证 MML schema 路由
Web 后端 SHALL 在 `/web/api/mml/schema` 暴露规范的 MML schema 查询能力，并 SHALL 要求调用方具备现有的已认证 web session 上下文。

#### Scenario: 已认证 schema 查询返回导入后的规则元数据
- **WHEN** 一个已认证客户端请求 `/web/api/mml/schema`，且其 `networkType` 与 `networkVersion` 能匹配到已导入规则数据
- **THEN** `web-backend` MUST 返回由已导入规则目录组装出的命令级和参数级元数据
- **AND** 该响应 MUST 保持当前工作台消费者所需的标准化 schema 契约

#### Scenario: 缺失规则集时返回空 schema 而不伪造数据
- **WHEN** 一个已认证客户端请求 `/web/api/mml/schema`，但该 `networkType + networkVersion` 没有任何已导入规则数据
- **THEN** `web-backend` MUST 为该查询返回空 schema
- **AND** 服务 MUST NOT 伪造任何未被已导入规则数据支撑的工作簿规则内容

#### Scenario: 未认证的 schema 查询被拒绝
- **WHEN** 客户端在没有有效已认证 web session 的情况下请求 `/web/api/mml/schema`
- **THEN** `web-backend` MUST 沿用现有认证拦截路径拒绝该请求
- **AND** 该路由 MUST NOT 匿名暴露规范 MML schema
