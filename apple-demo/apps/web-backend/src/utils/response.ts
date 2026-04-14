import type { ApiResponse, PaginatedPayload } from '@apple-demo/shared'

export function success<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  }
}

export function error(message: string, data?: unknown): ApiResponse {
  return {
    success: false,
    data,
    error: message,
    timestamp: new Date().toISOString()
  }
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number): ApiResponse<PaginatedPayload<T>> {
  return success({
    items,
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
  })
}
