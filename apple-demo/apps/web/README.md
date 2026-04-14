# web

前端应用，推荐始终从仓库根目录通过 workspace 命令启动，而不是单独维护一套本地安装流程。

## 推荐用法

在仓库根目录执行：

```bash
pnpm dev:web
pnpm --filter @apple-demo/web build
pnpm --filter @apple-demo/web test
pnpm --filter @apple-demo/web type-check
```

## 依赖服务

前端依赖两个本地后端：

- `apps/web-backend`：`http://127.0.0.1:3200`
- `apps/agent-backend`：`http://127.0.0.1:3100`

默认代理配置见 [vite.config.ts](/D:/AI%20MML/apple-demo/apps/web/vite.config.ts)：

- `/web/api/* -> http://127.0.0.1:3200`
- `/agent/api/* -> http://127.0.0.1:3100`

## 部署时注入后端地址

前端支持通过 [public.js](/D:/AI%20MML/apple-demo/apps/web/public/public.js) 在部署时注入后端地址：

- `window.__APP_PUBLIC_CONFIG__.webBackendOrigin`
- `window.__APP_PUBLIC_CONFIG__.agentBackendOrigin`

示例：

```js
window.__APP_PUBLIC_CONFIG__ = {
  webBackendOrigin: 'https://10.10.10.12:3200',
  agentBackendOrigin: 'https://10.10.10.12:3100'
}
```

如果没有注入 `public.js`，前端会继续回退到：

- `VITE_WEB_API_BASE_URL`
- `VITE_AGENT_API_BASE_URL`
- 默认相对路径 `/web/api` 和 `/agent/api`

## 快速自检

```bash
curl http://127.0.0.1:3200/web/api/auth/mode
curl http://127.0.0.1:5175/web/api/auth/mode
```

这两个请求都返回 `200`，说明前端认证探测链路基本正常。
