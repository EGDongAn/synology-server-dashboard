import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { ServerService } from './server.service'
import { DockerService } from './docker.service'
// Removed circular import - using console.log instead of logger
// import { CronJob } from 'cron' - not needed for now
import Redis from 'ioredis'

const prisma = new PrismaClient()

export interface MonitoringMetrics {
  serverId: string
  timestamp: Date
  cpu: number
  memory: number
  disk: number
  containers?: {
    total: number
    running: number
    stopped: number
  }
  services?: Array<{
    id: string
    name: string
    status: string
  }>
}

export interface HealthCheckConfig {
  url: string
  interval: number
  timeout: number
  method?: string
  expectedStatus?: number
  retries?: number
}

export class MonitoringService {
  private io: Server
  private redis: Redis
  private serverService: ServerService
  private dockerService: DockerService
  private monitoringJobs = new Map<string, NodeJS.Timeout>()
  private healthCheckJobs = new Map<string, NodeJS.Timeout>()

  constructor(io: Server, redis: Redis) {
    this.io = io
    this.redis = redis
    this.serverService = new ServerService()
    this.dockerService = new DockerService()

    // Start global monitoring
    this.startGlobalMonitoring()
  }

  private startGlobalMonitoring() {
    // Monitor all online servers every 30 seconds
    const globalJob = setInterval(async () => {
      await this.monitorAllServers()
    }, 30000)

    // Cleanup old metrics every hour
    const cleanupJob = setInterval(async () => {
      await this.cleanupOldMetrics()
    }, 3600000)

    console.log('Global monitoring started')
  }

  async startServerMonitoring(serverId: string, interval = 30000) {
    // Stop existing job if any
    this.stopServerMonitoring(serverId)

    const intervalSeconds = Math.floor(interval / 1000)
    const intervalMs = intervalSeconds * 1000

    const job = setInterval(async () => {
      try {
        await this.collectAndBroadcastMetrics(serverId)
      } catch (error) {
        console.error(`Monitoring error for server ${serverId}:`, error)
      }
    }, intervalMs)
    this.monitoringJobs.set(serverId, job)
    console.log(`Started monitoring for server ${serverId} with ${interval}ms interval`)
  }

  stopServerMonitoring(serverId: string) {
    const job = this.monitoringJobs.get(serverId)
    if (job) {
      clearInterval(job)
      this.monitoringJobs.delete(serverId)
      console.log(`Stopped monitoring for server ${serverId}`)
    }
  }

  async collectAndBroadcastMetrics(serverId: string) {
    try {
      const metrics = await this.collectServerMetrics(serverId)
      
      // Store metrics in database
      await this.storeMetrics(metrics)
      
      // Store in Redis for real-time access
      await this.storeMetricsInRedis(metrics)
      
      // Broadcast to connected clients
      this.io.to(`server:${serverId}`).emit('metrics', metrics)
      
      // Check thresholds and trigger alerts if needed
      await this.checkThresholds(serverId, metrics)
      
      return metrics
    } catch (error) {
      console.error(`Failed to collect metrics for server ${serverId}:`, error)
      throw error
    }
  }

  private async collectServerMetrics(serverId: string): Promise<MonitoringMetrics> {
    const [resources, containers, services] = await Promise.allSettled([
      this.serverService.updateServerResources(serverId),
      this.collectContainerMetrics(serverId),
      this.collectServiceMetrics(serverId)
    ])

    const timestamp = new Date()
    const metrics: MonitoringMetrics = {
      serverId,
      timestamp,
      cpu: 0,
      memory: 0,
      disk: 0
    }

    if (resources.status === 'fulfilled') {
      metrics.cpu = resources.value.cpuUsage
      metrics.memory = resources.value.memoryUsage
      metrics.disk = resources.value.diskUsage
    }

    if (containers.status === 'fulfilled') {
      metrics.containers = containers.value
    }

    if (services.status === 'fulfilled') {
      metrics.services = services.value
    }

    return metrics
  }

  private async collectContainerMetrics(serverId: string) {
    try {
      const containers = await this.dockerService.getContainers(serverId, true)
      
      return {
        total: containers.length,
        running: containers.filter(c => c.state === 'running').length,
        stopped: containers.filter(c => c.state === 'exited').length
      }
    } catch (error) {
      // Docker might not be available
      return { total: 0, running: 0, stopped: 0 }
    }
  }

  private async collectServiceMetrics(serverId: string) {
    try {
      const services = await prisma.service.findMany({
        where: { serverId },
        select: {
          id: true,
          name: true,
          status: true
        }
      })

      return services
    } catch (error) {
      console.error(`Failed to collect service metrics for server ${serverId}:`, error)
      return []
    }
  }

  private async storeMetrics(metrics: MonitoringMetrics) {
    try {
      await prisma.serverMetric.create({
        data: {
          serverId: metrics.serverId,
          cpuUsage: metrics.cpu,
          memoryUsage: metrics.memory,
          diskUsage: metrics.disk,
          timestamp: metrics.timestamp
        }
      })
    } catch (error) {
      console.error('Failed to store metrics in database:', error)
    }
  }

  private async storeMetricsInRedis(metrics: MonitoringMetrics) {
    try {
      const key = `metrics:${metrics.serverId}`
      const data = JSON.stringify(metrics)
      
      // Store latest metrics with 1 hour expiry
      await this.redis.setex(key, 3600, data)
      
      // Store in time series (last 24 hours)
      const timeSeriesKey = `metrics:timeseries:${metrics.serverId}`
      await this.redis.zadd(
        timeSeriesKey,
        metrics.timestamp.getTime(),
        data
      )
      
      // Remove old entries (older than 24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
      await this.redis.zremrangebyscore(timeSeriesKey, 0, oneDayAgo)
    } catch (error) {
      console.error('Failed to store metrics in Redis:', error)
    }
  }

  async getLatestMetrics(serverId: string): Promise<MonitoringMetrics | null> {
    try {
      const key = `metrics:${serverId}`
      const data = await this.redis.get(key)
      
      if (data) {
        return JSON.parse(data)
      }
      
      // Fallback to database
      const metric = await prisma.serverMetric.findFirst({
        where: { serverId },
        orderBy: { timestamp: 'desc' }
      })
      
      if (metric) {
        return {
          serverId,
          timestamp: metric.timestamp,
          cpu: metric.cpuUsage,
          memory: metric.memoryUsage,
          disk: metric.diskUsage
        }
      }
      
      return null
    } catch (error) {
      console.error(`Failed to get latest metrics for server ${serverId}:`, error)
      return null
    }
  }

  async getMetricsHistory(serverId: string, hours = 24): Promise<MonitoringMetrics[]> {
    try {
      const timeSeriesKey = `metrics:timeseries:${serverId}`
      const hoursAgo = Date.now() - (hours * 60 * 60 * 1000)
      
      const results = await this.redis.zrangebyscore(
        timeSeriesKey,
        hoursAgo,
        Date.now()
      )
      
      return results.map(data => JSON.parse(data))
    } catch (error) {
      console.error(`Failed to get metrics history for server ${serverId}:`, error)
      
      // Fallback to database
      const since = new Date(Date.now() - (hours * 60 * 60 * 1000))
      const metrics = await prisma.serverMetric.findMany({
        where: {
          serverId,
          timestamp: { gte: since }
        },
        orderBy: { timestamp: 'asc' }
      })
      
      return metrics.map(metric => ({
        serverId,
        timestamp: metric.timestamp,
        cpu: metric.cpuUsage,
        memory: metric.memoryUsage,
        disk: metric.diskUsage
      }))
    }
  }

  async startHealthCheck(serviceId: string, config: HealthCheckConfig) {
    // Stop existing health check
    this.stopHealthCheck(serviceId)

    const intervalMs = config.interval

    const job = setInterval(async () => {
      try {
        await this.performHealthCheck(serviceId, config)
      } catch (error) {
        console.error(`Health check error for service ${serviceId}:`, error)
      }
    }, intervalMs)

    this.healthCheckJobs.set(serviceId, job)
    console.log(`Started health check for service ${serviceId}`)
  }

  stopHealthCheck(serviceId: string) {
    const job = this.healthCheckJobs.get(serviceId)
    if (job) {
      clearInterval(job)
      this.healthCheckJobs.delete(serviceId)
      console.log(`Stopped health check for service ${serviceId}`)
    }
  }

  private async performHealthCheck(serviceId: string, config: HealthCheckConfig) {
    const startTime = Date.now()
    let status: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN' = 'UNKNOWN'
    let responseTime: number | null = null
    let statusCode: number | null = null
    let error: string | null = null

    try {
      const axios = await import('axios')
      const response = await axios.default({
        method: config.method || 'GET',
        url: config.url,
        timeout: config.timeout || 5000,
        validateStatus: () => true // Don't throw on non-2xx status
      })

      responseTime = Date.now() - startTime
      statusCode = response.status
      
      const expectedStatus = config.expectedStatus || 200
      status = response.status === expectedStatus ? 'HEALTHY' : 'UNHEALTHY'
      
      if (status === 'UNHEALTHY') {
        error = `Expected status ${expectedStatus}, got ${response.status}`
      }
    } catch (err) {
      responseTime = Date.now() - startTime
      status = 'UNHEALTHY'
      error = err instanceof Error ? err.message : 'Unknown error'
    }

    // Store health check result
    await prisma.healthCheck.create({
      data: {
        serviceId,
        status,
        responseTime,
        statusCode,
        error
      }
    })

    // Broadcast health check result
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { server: true }
    })

    if (service) {
      this.io.to(`server:${service.serverId}`).emit('healthCheck', {
        serviceId,
        serviceName: service.name,
        status,
        responseTime,
        statusCode,
        error,
        timestamp: new Date()
      })

      // Update service status if unhealthy
      if (status === 'UNHEALTHY' && service.status !== 'ERROR') {
        await prisma.service.update({
          where: { id: serviceId },
          data: { status: 'ERROR' }
        })
      } else if (status === 'HEALTHY' && service.status === 'ERROR') {
        await prisma.service.update({
          where: { id: serviceId },
          data: { status: 'RUNNING' }
        })
      }
    }
  }

  private async checkThresholds(serverId: string, metrics: MonitoringMetrics) {
    const server = await prisma.server.findUnique({
      where: { id: serverId }
    })

    if (!server) return

    const alerts = []

    // CPU threshold (default 80%)
    if (metrics.cpu > 80) {
      alerts.push({
        type: 'HIGH_CPU',
        severity: metrics.cpu > 90 ? 'CRITICAL' : 'HIGH',
        message: `High CPU usage: ${metrics.cpu.toFixed(1)}%`
      })
    }

    // Memory threshold (default 85%)
    if (metrics.memory > 85) {
      alerts.push({
        type: 'HIGH_MEMORY',
        severity: metrics.memory > 95 ? 'CRITICAL' : 'HIGH',
        message: `High memory usage: ${metrics.memory.toFixed(1)}%`
      })
    }

    // Disk threshold (default 90%)
    if (metrics.disk > 90) {
      alerts.push({
        type: 'HIGH_DISK',
        severity: metrics.disk > 95 ? 'CRITICAL' : 'HIGH',
        message: `High disk usage: ${metrics.disk.toFixed(1)}%`
      })
    }

    // Create alerts
    for (const alertData of alerts) {
      // Check if similar alert already exists and is active
      const existingAlert = await prisma.alert.findFirst({
        where: {
          serverId,
          type: alertData.type as any,
          status: 'ACTIVE'
        }
      })

      if (!existingAlert) {
        const alert = await prisma.alert.create({
          data: {
            serverId,
            type: alertData.type as any,
            severity: alertData.severity as any,
            title: `${alertData.type.replace('_', ' ')} - ${server.name}`,
            message: alertData.message,
            channels: ['email', 'slack']
          }
        })

        // Broadcast alert
        this.io.emit('alert', {
          id: alert.id,
          serverId,
          serverName: server.name,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          timestamp: alert.createdAt
        })
      }
    }
  }

  private async monitorAllServers() {
    try {
      const servers = await prisma.server.findMany({
        where: { status: 'ONLINE' }
      })

      // Broadcast global stats
      const stats = {
        totalServers: servers.length,
        timestamp: new Date()
      }

      this.io.emit('globalStats', stats)
    } catch (error) {
      console.error('Failed to monitor all servers:', error)
    }
  }

  private async cleanupOldMetrics() {
    try {
      const retentionDays = parseInt(process.env.METRICS_RETENTION_DAYS || '30')
      const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000))

      const deleted = await prisma.serverMetric.deleteMany({
        where: {
          timestamp: { lt: cutoffDate }
        }
      })

      console.log(`Cleaned up ${deleted.count} old metrics`)
    } catch (error) {
      console.error('Failed to cleanup old metrics:', error)
    }
  }

  async getMonitoringStats() {
    return {
      activeServers: this.monitoringJobs.size,
      activeHealthChecks: this.healthCheckJobs.size,
      jobs: {
        monitoring: Array.from(this.monitoringJobs.keys()),
        healthChecks: Array.from(this.healthCheckJobs.keys())
      }
    }
  }

  shutdown() {
    // Stop all monitoring jobs
    for (const [serverId, job] of this.monitoringJobs) {
      clearInterval(job)
    }
    this.monitoringJobs.clear()

    // Stop all health check jobs
    for (const [serviceId, job] of this.healthCheckJobs) {
      clearInterval(job)
    }
    this.healthCheckJobs.clear()

    console.log('Monitoring service shutdown')
  }
}