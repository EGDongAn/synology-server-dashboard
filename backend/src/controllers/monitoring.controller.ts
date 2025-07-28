import { Response } from 'express'
import { MonitoringService } from '../services/monitoring.service'
import { AuthenticatedRequest } from '../middleware/auth'
import Joi from 'joi'
import { logger } from '../index'

let monitoringService: MonitoringService

// Validation schemas
const healthCheckSchema = Joi.object({
  url: Joi.string().uri().required(),
  interval: Joi.number().min(5000).max(300000).default(30000), // 5s to 5min
  timeout: Joi.number().min(1000).max(30000).default(5000),    // 1s to 30s
  method: Joi.string().valid('GET', 'POST', 'HEAD').default('GET'),
  expectedStatus: Joi.number().min(100).max(599).default(200),
  retries: Joi.number().min(0).max(5).default(3)
})

export class MonitoringController {
  static setMonitoringService(service: MonitoringService) {
    monitoringService = service
  }

  async getServerMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId } = req.params
      const { hours } = req.query

      if (hours) {
        const history = await monitoringService.getMetricsHistory(
          serverId,
          parseInt(hours as string)
        )
        
        res.json({
          success: true,
          data: history
        })
      } else {
        const latest = await monitoringService.getLatestMetrics(serverId)
        
        res.json({
          success: true,
          data: latest
        })
      }
    } catch (error) {
      logger.error('Get server metrics error:', error)
      res.status(500).json({
        error: 'Failed to fetch server metrics'
      })
    }
  }

  async startServerMonitoring(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId } = req.params
      const { interval } = req.body

      const monitoringInterval = interval ? parseInt(interval) : 30000
      
      if (monitoringInterval < 5000 || monitoringInterval > 300000) {
        return res.status(400).json({
          error: 'Interval must be between 5000ms and 300000ms'
        })
      }

      await monitoringService.startServerMonitoring(serverId, monitoringInterval)

      res.json({
        success: true,
        message: 'Server monitoring started',
        interval: monitoringInterval
      })
    } catch (error) {
      logger.error('Start server monitoring error:', error)
      res.status(500).json({
        error: 'Failed to start server monitoring'
      })
    }
  }

  async stopServerMonitoring(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId } = req.params

      monitoringService.stopServerMonitoring(serverId)

      res.json({
        success: true,
        message: 'Server monitoring stopped'
      })
    } catch (error) {
      logger.error('Stop server monitoring error:', error)
      res.status(500).json({
        error: 'Failed to stop server monitoring'
      })
    }
  }

  async collectMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId } = req.params

      const metrics = await monitoringService.collectAndBroadcastMetrics(serverId)

      res.json({
        success: true,
        data: metrics
      })
    } catch (error) {
      logger.error('Collect metrics error:', error)
      res.status(500).json({
        error: 'Failed to collect metrics'
      })
    }
  }

  async startHealthCheck(req: AuthenticatedRequest, res: Response) {
    try {
      const { serviceId } = req.params
      const { error, value } = healthCheckSchema.validate(req.body)
      
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        })
      }

      await monitoringService.startHealthCheck(serviceId, value)

      res.json({
        success: true,
        message: 'Health check started',
        config: value
      })
    } catch (error) {
      logger.error('Start health check error:', error)
      res.status(500).json({
        error: 'Failed to start health check'
      })
    }
  }

  async stopHealthCheck(req: AuthenticatedRequest, res: Response) {
    try {
      const { serviceId } = req.params

      monitoringService.stopHealthCheck(serviceId)

      res.json({
        success: true,
        message: 'Health check stopped'
      })
    } catch (error) {
      logger.error('Stop health check error:', error)
      res.status(500).json({
        error: 'Failed to stop health check'
      })
    }
  }

  async getMonitoringStats(req: AuthenticatedRequest, res: Response) {
    try {
      const stats = await monitoringService.getMonitoringStats()

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('Get monitoring stats error:', error)
      res.status(500).json({
        error: 'Failed to fetch monitoring statistics'
      })
    }
  }

  async getAlerts(req: AuthenticatedRequest, res: Response) {
    try {
      const { status, severity, serverId } = req.query
      const limit = parseInt(req.query.limit as string) || 50
      const offset = parseInt(req.query.offset as string) || 0

      const where: any = {}
      if (status) where.status = status
      if (severity) where.severity = severity
      if (serverId) where.serverId = serverId

      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()

      const [alerts, total] = await Promise.all([
        prisma.alert.findMany({
          where,
          include: {
            server: {
              select: {
                id: true,
                name: true,
                ipAddress: true
              }
            },
            service: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.alert.count({ where })
      ])

      res.json({
        success: true,
        data: {
          alerts,
          total,
          hasMore: offset + limit < total
        }
      })
    } catch (error) {
      logger.error('Get alerts error:', error)
      res.status(500).json({
        error: 'Failed to fetch alerts'
      })
    }
  }

  async acknowledgeAlert(req: AuthenticatedRequest, res: Response) {
    try {
      const { alertId } = req.params

      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()

      const alert = await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedAt: new Date()
        }
      })

      res.json({
        success: true,
        data: alert
      })
    } catch (error) {
      logger.error('Acknowledge alert error:', error)
      res.status(500).json({
        error: 'Failed to acknowledge alert'
      })
    }
  }

  async resolveAlert(req: AuthenticatedRequest, res: Response) {
    try {
      const { alertId } = req.params

      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()

      const alert = await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date()
        }
      })

      res.json({
        success: true,
        data: alert
      })
    } catch (error) {
      logger.error('Resolve alert error:', error)
      res.status(500).json({
        error: 'Failed to resolve alert'
      })
    }
  }

  async getHealthChecks(req: AuthenticatedRequest, res: Response) {
    try {
      const { serviceId } = req.params
      const limit = parseInt(req.query.limit as string) || 100

      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()

      const healthChecks = await prisma.healthCheck.findMany({
        where: { serviceId },
        orderBy: { checkedAt: 'desc' },
        take: limit
      })

      // Calculate health percentage
      const recentChecks = healthChecks.slice(0, 20) // Last 20 checks
      const healthyCount = recentChecks.filter(hc => hc.status === 'HEALTHY').length
      const healthPercentage = recentChecks.length > 0 
        ? (healthyCount / recentChecks.length) * 100 
        : 0

      res.json({
        success: true,
        data: {
          healthChecks,
          healthPercentage: Math.round(healthPercentage),
          averageResponseTime: recentChecks
            .filter(hc => hc.responseTime !== null)
            .reduce((sum, hc) => sum + (hc.responseTime || 0), 0) / 
            recentChecks.filter(hc => hc.responseTime !== null).length || 0
        }
      })
    } catch (error) {
      logger.error('Get health checks error:', error)
      res.status(500).json({
        error: 'Failed to fetch health checks'
      })
    }
  }
}