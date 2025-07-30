export class MonitoringService {
  constructor(io: any, redis: any) {
    console.log('MonitoringService stub initialized')
  }

  shutdown() {
    console.log('MonitoringService stub shutdown')
  }
}

export interface MonitoringMetrics {
  serverId: string
  timestamp: Date
  cpu: number
  memory: number
  disk: number
}

export interface HealthCheckConfig {
  url: string
  interval: number
  timeout: number
  method?: string
  expectedStatus?: number
  retries?: number
}