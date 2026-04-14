# agent-backend

智能体运行时后端，提供会话、工具执行、文件工作区和运行时编排能力。

## 推荐用法

在仓库根目录执行：

```bash
pnpm dev:agent-backend
pnpm --filter @apple-demo/agent-backend build
pnpm --filter @apple-demo/agent-backend test
pnpm --filter @apple-demo/agent-backend type-check
```

如果需要下载 sqlite 扩展：

```bash
pnpm --dir apps/agent-backend download-vec
```

## 运行前提

- Node.js 22+
- `apps/web-backend` 已启动，用于认证与 schema 服务

默认服务地址：

```text
http://127.0.0.1:3100
```

## 配置要点

配置文件为 [config.json](/D:/AI%20MML/apple-demo/apps/agent-backend/config.json)。

当前需要特别注意：

- `auth.baseUrl` 默认指向 `http://localhost:3200`
- 单模型配置支持 `stream: false`，未配置时默认按流式请求上游模型
- 模型超时只接受 `streamFirstByteTimeoutMs` 和 `streamIdleTimeoutMs`
- 当 `stream: false` 时，`streamFirstByteTimeoutMs` 和 `streamIdleTimeoutMs` 仅作为兼容保留字段，不代表精确流阶段超时语义
- 旧字段 `requestTimeoutMs` 会直接导致启动失败
- 修改模型超时配置后必须重启服务
- 默认禁用 `local:bash`
- 建议将 `config.json` 外置到程序目录之外维护
- `runtime.workspaceDir` 用于 agent 工作区
- `memory.dbPath`、`runtime.fileLogging.directory`、`runtime.managedSkills.registryPath`、`runtime.managedSkills.packagesDir` 都应指向独立的运行时可写目录
- 上传的 managed skill ZIP 会解压并持久化到 `runtime.managedSkills.packagesDir/<skillId>`，不会写回程序包内的 `assets/skills`

## 工作区与数据目录

- `apps/agent-backend/workspace`：运行时工作区
- `apps/agent-backend/data`：运行时数据

这两个目录都属于运行态目录，不应提交本地生成内容。

推荐的外置配置示例：

```json
{
  "memory": {
    "dbPath": "/srv/mml-agent/data/memory.db"
  },
  "runtime": {
    "workspaceDir": "/srv/mml-agent/workspace",
    "fileLogging": {
      "directory": "/srv/mml-agent/data/logs",
      "enabled": true,
      "format": "jsonl",
      "split": "daily",
      "redactSensitive": true
    },
    "managedSkills": {
      "registryPath": "/srv/mml-agent/data/managed-skills.json",
      "packagesDir": "/srv/mml-agent/data/skills"
    }
  }
}
```

- `server.requestBodyLimits.defaultJson` 控制普通 JSON 请求体上限
- `server.requestBodyLimits.fileSaveJson` 控制 `PUT /agent/api/files/:fileKey` 的文件保存请求体上限
- 建议仅在确有需要时放大 `fileSaveJson`，避免无差别放大全局 JSON body 限额

## 主要能力

- `POST /agent/api/agent/run`
- 工作区文件读写与上传
- 会话状态持久化
- governed skill 执行
- gateway / MCP 工具接入

## 与其他服务的边界

- 认证和用户态来自 `apps/web-backend`
- MML schema 读取来自 `apps/web-backend:/web/api/mml/schema`
- `apps/agent-backend` 不再暴露浏览器侧 MML schema 兼容路由

## 验证

建议在仓库根目录统一验证：

```bash
pnpm type-check
pnpm test
pnpm build
```
