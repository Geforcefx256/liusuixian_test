import type { CorsOptions } from 'cors'

export const agentBackendCorsOptions: CorsOptions = {
  origin(origin, callback) {
    callback(null, origin || true)
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition']
}
