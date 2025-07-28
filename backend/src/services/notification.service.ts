import Bull from 'bull'
import nodemailer from 'nodemailer'
import axios from 'axios'
import { PrismaClient, Alert, NotificationStatus } from '@prisma/client'
import { config } from '../config'
import { logger } from '../index'
import Redis from 'ioredis'

const prisma = new PrismaClient()

export interface NotificationChannel {
  send(notification: NotificationPayload): Promise<void>
}

export interface NotificationPayload {
  id: string
  alertId: string
  serverId?: string
  serviceId?: string
  type: string
  severity: string
  title: string
  message: string
  channels: string[]
  timestamp: Date
  metadata?: Record<string, any>
}

export interface NotificationTemplate {
  subject: string
  body: string
  html?: string
}

export class NotificationService {
  private notificationQueue: Bull.Queue
  private channels: Map<string, NotificationChannel> = new Map()
  private templates: Map<string, NotificationTemplate> = new Map()

  constructor(redis: Redis) {
    this.notificationQueue = new Bull('notifications', {
      redis: {
        port: redis.options.port,
        host: redis.options.host,
        password: redis.options.password
      }
    })

    this.setupChannels()
    this.setupTemplates()
    this.processQueue()
  }

  private setupChannels() {
    // Email channel
    if (config.email.host && config.email.user) {
      this.channels.set('email', new EmailChannel())
      logger.info('Email notification channel enabled')
    }

    // Slack channel
    if (config.slack.webhookUrl) {
      this.channels.set('slack', new SlackChannel())
      logger.info('Slack notification channel enabled')
    }

    // Webhook channel (always enabled)
    this.channels.set('webhook', new WebhookChannel())
    logger.info('Webhook notification channel enabled')

    logger.info(`Notification service initialized with ${this.channels.size} channels`)
  }

  private setupTemplates() {
    // Server down template
    this.templates.set('SERVER_DOWN', {
      subject: '🚨 Server Down Alert - {{serverName}}',
      body: 'Server {{serverName}} ({{serverIp}}) is currently offline.',
      html: `
        <h3>🚨 Server Down Alert</h3>
        <p><strong>Server:</strong> {{serverName}} ({{serverIp}})</p>
        <p><strong>Status:</strong> Offline</p>
        <p><strong>Time:</strong> {{timestamp}}</p>
        <p>Please check the server immediately.</p>
      `
    })

    // Service down template
    this.templates.set('SERVICE_DOWN', {
      subject: '⚠️ Service Down Alert - {{serviceName}}',
      body: 'Service {{serviceName}} on server {{serverName}} is not responding.',
      html: `
        <h3>⚠️ Service Down Alert</h3>
        <p><strong>Service:</strong> {{serviceName}}</p>
        <p><strong>Server:</strong> {{serverName}}</p>
        <p><strong>Time:</strong> {{timestamp}}</p>
        <p>Service is not responding to health checks.</p>
      `
    })

    // High resource usage template
    this.templates.set('HIGH_RESOURCE', {
      subject: '📊 High Resource Usage - {{serverName}}',
      body: 'Server {{serverName}} has high {{resourceType}} usage: {{value}}%',
      html: `
        <h3>📊 High Resource Usage Alert</h3>
        <p><strong>Server:</strong> {{serverName}}</p>
        <p><strong>Resource:</strong> {{resourceType}}</p>
        <p><strong>Usage:</strong> {{value}}%</p>
        <p><strong>Time:</strong> {{timestamp}}</p>
        <p>Please investigate the resource usage.</p>
      `
    })

    // Deployment failed template
    this.templates.set('DEPLOYMENT_FAILED', {
      subject: '❌ Deployment Failed - {{serviceName}}',
      body: 'Deployment of {{serviceName}} on {{serverName}} has failed.',
      html: `
        <h3>❌ Deployment Failed</h3>
        <p><strong>Service:</strong> {{serviceName}}</p>
        <p><strong>Server:</strong> {{serverName}}</p>
        <p><strong>Time:</strong> {{timestamp}}</p>
        <p><strong>Error:</strong> {{error}}</p>
        <p>Please check the deployment logs for more details.</p>
      `
    })
  }

  async sendNotification(alert: Alert, metadata?: Record<string, any>): Promise<void> {
    const server = alert.serverId ? await prisma.server.findUnique({
      where: { id: alert.serverId }
    }) : null

    const service = alert.serviceId ? await prisma.service.findUnique({
      where: { id: alert.serviceId }
    }) : null

    const notification: NotificationPayload = {
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      alertId: alert.id,
      serverId: alert.serverId || undefined,
      serviceId: alert.serviceId || undefined,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      channels: alert.channels,
      timestamp: alert.createdAt,
      metadata: {
        ...metadata,
        serverName: server?.name,
        serverIp: server?.ipAddress,
        serviceName: service?.name
      }
    }

    // Add to queue for processing
    await this.notificationQueue.add('send', notification, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: 100,
      removeOnFail: 50
    })

    logger.info(`Notification queued for alert ${alert.id}`)
  }

  private processQueue() {
    this.notificationQueue.process('send', async (job) => {
      const notification = job.data as NotificationPayload
      
      logger.info(`Processing notification ${notification.id} for alert ${notification.alertId}`)

      const results = await Promise.allSettled(
        notification.channels.map(async (channelType) => {
          const channel = this.channels.get(channelType)
          if (!channel) {
            throw new Error(`Channel ${channelType} not found`)
          }

          // Create notification record
          const notificationRecord = await prisma.notification.create({
            data: {
              alertId: notification.alertId,
              channel: channelType,
              status: 'PENDING'
            }
          })

          try {
            await channel.send(notification)
            
            // Update notification as sent
            await prisma.notification.update({
              where: { id: notificationRecord.id },
              data: {
                status: 'SENT',
                sentAt: new Date()
              }
            })

            logger.info(`Notification sent via ${channelType} for alert ${notification.alertId}`)
          } catch (error) {
            // Update notification as failed
            await prisma.notification.update({
              where: { id: notificationRecord.id },
              data: {
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'Unknown error',
                attempts: notificationRecord.attempts + 1
              }
            })

            logger.error(`Failed to send notification via ${channelType}:`, error)
            throw error
          }
        })
      )

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      logger.info(`Notification ${notification.id} processed: ${successful} successful, ${failed} failed`)
    })

    // Queue event handlers
    this.notificationQueue.on('completed', (job) => {
      logger.debug(`Notification job ${job.id} completed`)
    })

    this.notificationQueue.on('failed', (job, err) => {
      logger.error(`Notification job ${job.id} failed:`, err)
    })
  }

  private renderTemplate(templateKey: string, variables: Record<string, any>): NotificationTemplate {
    const template = this.templates.get(templateKey)
    if (!template) {
      return {
        subject: variables.title || 'Alert Notification',
        body: variables.message || 'An alert has been triggered.'
      }
    }

    const render = (text: string) => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] || match
      })
    }

    return {
      subject: render(template.subject),
      body: render(template.body),
      html: template.html ? render(template.html) : undefined
    }
  }

  async getNotificationHistory(filters: {
    alertId?: string
    channel?: string
    status?: NotificationStatus
    limit?: number
    offset?: number
  }) {
    const {
      alertId,
      channel,
      status,
      limit = 50,
      offset = 0
    } = filters

    const where: any = {}
    if (alertId) where.alertId = alertId
    if (channel) where.channel = channel
    if (status) where.status = status

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          alert: {
            include: {
              server: {
                select: { name: true }
              },
              service: {
                select: { name: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.notification.count({ where })
    ])

    return {
      notifications,
      total,
      hasMore: offset + limit < total
    }
  }

  async getNotificationStats(days = 7) {
    const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000))

    const [
      totalSent,
      totalFailed,
      byChannel,
      byStatus
    ] = await Promise.all([
      prisma.notification.count({
        where: {
          status: 'SENT',
          createdAt: { gte: since }
        }
      }),
      prisma.notification.count({
        where: {
          status: 'FAILED',
          createdAt: { gte: since }
        }
      }),
      prisma.notification.groupBy({
        by: ['channel'],
        where: { createdAt: { gte: since } },
        _count: { id: true }
      }),
      prisma.notification.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: { id: true }
      })
    ])

    return {
      period: `${days} days`,
      total: totalSent + totalFailed,
      sent: totalSent,
      failed: totalFailed,
      successRate: totalSent + totalFailed > 0 ? (totalSent / (totalSent + totalFailed)) * 100 : 0,
      byChannel: byChannel.map(item => ({
        channel: item.channel,
        count: item._count.id
      })),
      byStatus: byStatus.map(item => ({
        status: item.status,
        count: item._count.id
      }))
    }
  }

  async retryFailedNotifications(hours = 1) {
    const since = new Date(Date.now() - (hours * 60 * 60 * 1000))
    
    const failedNotifications = await prisma.notification.findMany({
      where: {
        status: 'FAILED',
        attempts: { lt: 3 },
        createdAt: { gte: since }
      },
      include: {
        alert: true
      }
    })

    let retried = 0
    for (const notification of failedNotifications) {
      try {
        await this.sendNotification(notification.alert)
        retried++
      } catch (error) {
        logger.error(`Failed to retry notification ${notification.id}:`, error)
      }
    }

    logger.info(`Retried ${retried} failed notifications`)
    return retried
  }

  shutdown() {
    this.notificationQueue.close()
    logger.info('Notification service shutdown')
  }
}

class EmailChannel implements NotificationChannel {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass
      }
    })
  }

  async send(notification: NotificationPayload): Promise<void> {
    const template = this.renderTemplate(notification.type, {
      ...notification.metadata,
      title: notification.title,
      message: notification.message,
      timestamp: notification.timestamp.toISOString(),
      severity: notification.severity
    })

    const mailOptions = {
      from: config.email.user,
      to: process.env.ALERT_EMAIL_TO || config.email.user,
      subject: template.subject,
      text: template.body,
      html: template.html
    }

    await this.transporter.sendMail(mailOptions)
  }

  private renderTemplate(type: string, variables: Record<string, any>) {
    const templates: Record<string, any> = {
      SERVER_DOWN: {
        subject: `🚨 Server Down Alert - ${variables.serverName}`,
        body: `Server ${variables.serverName} (${variables.serverIp}) is currently offline.\n\nTime: ${variables.timestamp}`,
        html: `
          <h3>🚨 Server Down Alert</h3>
          <p><strong>Server:</strong> ${variables.serverName} (${variables.serverIp})</p>
          <p><strong>Status:</strong> Offline</p>
          <p><strong>Time:</strong> ${variables.timestamp}</p>
        `
      }
    }

    return templates[type] || {
      subject: variables.title,
      body: variables.message,
      html: `<p>${variables.message}</p>`
    }
  }
}

class SlackChannel implements NotificationChannel {
  async send(notification: NotificationPayload): Promise<void> {
    const webhookUrl = config.slack.webhookUrl
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured')
    }

    const color = this.getSeverityColor(notification.severity)
    const emoji = this.getSeverityEmoji(notification.type)

    const payload = {
      text: `${emoji} ${notification.title}`,
      attachments: [{
        color,
        fields: [
          {
            title: 'Message',
            value: notification.message,
            short: false
          },
          {
            title: 'Server',
            value: notification.metadata?.serverName || 'Unknown',
            short: true
          },
          {
            title: 'Service',
            value: notification.metadata?.serviceName || 'N/A',
            short: true
          },
          {
            title: 'Severity',
            value: notification.severity,
            short: true
          },
          {
            title: 'Time',
            value: notification.timestamp.toISOString(),
            short: true
          }
        ],
        footer: 'Synology Dashboard',
        ts: Math.floor(notification.timestamp.getTime() / 1000)
      }]
    }

    await axios.post(webhookUrl, payload)
  }

  private getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      CRITICAL: 'danger',
      HIGH: 'warning',
      MEDIUM: 'good',
      LOW: '#36a64f'
    }
    return colors[severity] || 'warning'
  }

  private getSeverityEmoji(type: string): string {
    const emojis: Record<string, string> = {
      SERVER_DOWN: '🚨',
      SERVICE_DOWN: '⚠️',
      HIGH_CPU: '📊',
      HIGH_MEMORY: '📊',
      HIGH_DISK: '📊',
      DEPLOYMENT_FAILED: '❌',
      HEALTH_CHECK_FAILED: '🔍'
    }
    return emojis[type] || '📢'
  }
}

class WebhookChannel implements NotificationChannel {
  async send(notification: NotificationPayload): Promise<void> {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL
    if (!webhookUrl) {
      // Silent skip if no webhook configured
      return
    }

    const payload = {
      id: notification.id,
      alert: {
        id: notification.alertId,
        type: notification.type,
        severity: notification.severity,
        title: notification.title,
        message: notification.message,
        timestamp: notification.timestamp
      },
      server: notification.metadata?.serverName ? {
        id: notification.serverId,
        name: notification.metadata.serverName,
        ip: notification.metadata.serverIp
      } : null,
      service: notification.metadata?.serviceName ? {
        id: notification.serviceId,
        name: notification.metadata.serviceName
      } : null
    }

    await axios.post(webhookUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Synology-Dashboard/1.0'
      }
    })
  }
}