export interface ApiResponse<T> {
  data: T
  message?: string
  status?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface ErrorResponse {
  message: string
  error?: any
  status?: number
}