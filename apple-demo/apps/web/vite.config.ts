import path from 'node:path'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const webApiTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3200'
const agentApiTarget = process.env.VITE_AGENT_API_PROXY_TARGET || 'http://127.0.0.1:3100'

export default defineConfig({
  plugins: [vue()],
  publicDir: path.resolve(__dirname, './public'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5175,
    proxy: {
      '/web/api': {
        target: webApiTarget,
        changeOrigin: true
      },
      '/agent/api': {
        target: agentApiTarget,
        changeOrigin: true
      }
    }
  }
})
