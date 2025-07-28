import { Response } from 'express'
import { NotificationService } from '../services/notification.service'
import { AuthenticatedRequest } from '../middleware/auth'
import { logger } from '../index'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
let notificationService: NotificationService

export class NotificationController {
  static setNotificationService(service: NotificationService) {
    notificationService = service
  }

  async getNotificationHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        alertId,
        channel,
        status,
        limit,
        offset
      } = req.query

      const filters: any = {}
      if (alertId) filters.alertId = alertId as string
      if (channel) filters.channel = channel as string
      if (status) filters.status = status as any
      if (limit) filters.limit = parseInt(limit as string)
      if (offset) filters.offset = parseInt(offset as string)

      const result = await notificationService.getNotificationHistory(filters)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('Get notification history error:', error)
      res.status(500).json({
        error: 'Failed to fetch notification history'
      })
    }
  }

  async getNotificationStats(req: AuthenticatedRequest, res: Response) {
    try {
      const { days } = req.query
      const period = days ? parseInt(days as string) : 7

      const stats = await notificationService.getNotificationStats(period)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('Get notification stats error:', error)
      res.status(500).json({
        error: 'Failed to fetch notification statistics'
      })
    }
  }

  async retryFailedNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const { hours } = req.body
      const retryPeriod = hours || 1

      const retriedCount = await notificationService.retryFailedNotifications(retryPeriod)

      res.json({
        success: true,
        message: `Retried ${retriedCount} failed notifications`,
        retriedCount
      })
    } catch (error) {
      logger.error('Retry failed notifications error:', error)
      res.status(500).json({
        error: 'Failed to retry notifications'
      })
    }
  }

  async testNotification(req: AuthenticatedRequest, res: Response) {
    try {
      const { channels, message } = req.body

      if (!channels || !Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json({
          error: 'Channels array is required'
        })
      }

      // Create a test alert
      const testAlert = await prisma.alert.create({
        data: {
          type: 'CUSTOM',
          severity: 'LOW',
          title: 'Test Notification',
          message: message || 'This is a test notification from Synology Dashboard.',
          channels,
          status: 'RESOLVED' // Mark as resolved immediately since it's a test
        }
      })

      // Send notification
      await notificationService.sendNotification(testAlert, {
        serverName: 'Test Server',
        serviceName: 'Test Service'
      })

      res.json({
        success: true,
        message: 'Test notification sent',
        alertId: testAlert.id
      })
    } catch (error) {
      logger.error('Test notification error:', error)
      res.status(500).json({
        error: 'Failed to send test notification'
      })
    }
  }

  async getNotificationChannels(req: AuthenticatedRequest, res: Response) {
    try {
      const channels = []

      // Check email configuration
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        channels.push({
          type: 'email',
          name: 'Email',
          configured: true,
          description: `Configured for ${process.env.SMTP_HOST}`
        })
      } else {
        channels.push({
          type: 'email',
          name: 'Email',
          configured: false,
          description: 'SMTP configuration required'
        })
      }

      // Check Slack configuration
      if (process.env.SLACK_WEBHOOK_URL) {
        channels.push({
          type: 'slack',
          name: 'Slack',
          configured: true,
          description: 'Webhook configured'
        })
      } else {
        channels.push({
          type: 'slack',
          name: 'Slack',
          configured: false,
          description: 'Webhook URL required'
        })
      }

      // Webhook is always available
      channels.push({
        type: 'webhook',
        name: 'Webhook',
        configured: !!process.env.ALERT_WEBHOOK_URL,
        description: process.env.ALERT_WEBHOOK_URL ? 'Custom webhook configured' : 'Optional custom webhook'
      })

      res.json({
        success: true,
        data: channels
      })
    } catch (error) {
      logger.error('Get notification channels error:', error)
      res.status(500).json({
        error: 'Failed to fetch notification channels'
      })
    }
  }

  async updateNotificationSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const { defaultChannels, severityFilters, rateLimits } = req.body

      // This would typically update user preferences or system settings
      // For now, we'll just validate and return success
      const settings = {
        defaultChannels: defaultChannels || ['email'],
        severityFilters: severityFilters || {
          CRITICAL: ['email', 'slack'],
          HIGH: ['email', 'slack'],
          MEDIUM: ['email'],
          LOW: []
        },
        rateLimits: rateLimits || {
          maxPerHour: 10,
          maxPerDay: 50
        },
        updatedAt: new Date(),
        updatedBy: req.user?.id
      }

      // In a real implementation, you would store these settings in the database
      // associated with the user or as global system settings

      res.json({
        success: true,
        message: 'Notification settings updated',
        data: settings
      })
    } catch (error) {
      logger.error('Update notification settings error:', error)
      res.status(500).json({
        error: 'Failed to update notification settings'
      })
    }
  }

  async getActiveAlerts(req: AuthenticatedRequest, res: Response) {
    try {
      const { severity, serverId } = req.query

      const where: any = {
        status: 'ACTIVE'
      }

      if (severity) where.severity = severity
      if (serverId) where.serverId = serverId

      const alerts = await prisma.alert.findMany({
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
          },
          notifications: {
            select: {
              channel: true,
              status: true,
              sentAt: true,
              attempts: true
            }
          }
        },
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' }
        ]
      })

      res.json({
        success: true,
        data: alerts
      })
    } catch (error) {
      logger.error('Get active alerts error:', error)
      res.status(500).json({
        error: 'Failed to fetch active alerts'
      })
    }
  }

  async createManualAlert(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        serverId,
        serviceId,
        type,
        severity,
        title,
        message,
        channels
      } = req.body

      if (!type || !severity || !title || !message) {
        return res.status(400).json({
          error: 'Type, severity, title, and message are required'
        })
      }

      const alert = await prisma.alert.create({
        data: {
          serverId: serverId || null,
          serviceId: serviceId || null,
          type: type as any,
          severity: severity as any,
          title,
          message,
          channels: channels || ['email']
        }
      })

      // Send notification
      await notificationService.sendNotification(alert)

      res.json({
        success: true,
        message: 'Manual alert created and notification sent',
        data: alert
      })
    } catch (error) {
      logger.error('Create manual alert error:', error)
      res.status(500).json({
        error: 'Failed to create manual alert'
      })
    }
  }
}