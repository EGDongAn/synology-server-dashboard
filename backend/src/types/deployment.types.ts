export interface CreateDeploymentDto {
  serverId: string
  serviceId: string
  version?: string
  environment?: 'development' | 'staging' | 'production'
  config?: Record<string, any>
  description?: string
}

export interface UpdateDeploymentDto {
  version?: string
  status?: string
  environment?: 'development' | 'staging' | 'production'
  config?: Record<string, any>
  description?: string
  healthCheckUrl?: string
  healthCheckInterval?: number
}

export interface DeploymentFilters {
  serverId?: string
  serviceId?: string
  status?: string
  environment?: string
  limit?: number
  offset?: number
}

export interface DeploymentLog {
  id: string
  deploymentId: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'
  message: string
  timestamp: Date
}

export interface DeploymentStats {
  total: number
  running: number
  failed: number
  successful: number
  successRate: number
  recentDeployments: any[]
}

export interface RollbackRequest {
  targetVersion?: string
  reason?: string
}

export interface DeploymentResult {
  deploymentId: string
  status: string
  message: string
  details?: Record<string, any>
}

export interface ServiceConfig {
  // Docker specific
  image?: string
  containerName?: string
  environment?: string[]
  ports?: Array<{
    host: number
    container: number
    protocol?: 'tcp' | 'udp'
  }>
  volumes?: Array<{
    host: string
    container: string
    readonly?: boolean
  }>
  dockerConfig?: Record<string, any>

  // Systemd specific
  serviceName?: string
  serviceFile?: string
  binaryPath?: string
  backupPath?: string

  // Generic commands
  deployCommand?: string
  rollbackCommand?: string
  startCommand?: string
  stopCommand?: string
  restartCommand?: string
  healthCheckCommand?: string

  // Health check configuration
  healthCheckUrl?: string
  healthCheckInterval?: number
  healthCheckTimeout?: number
  healthCheckRetries?: number
}