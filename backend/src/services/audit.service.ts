import { PrismaClient, AuditResult } from '@prisma/client'
import { Request } from 'express'
import { AuthenticatedRequest } from '../middleware/auth'

const prisma = new PrismaClient()

export interface AuditActivity {
  userId: string
  action: string
  resource: string
  resourceId?: string
  changes?: any
  ipAddress?: string
  userAgent?: string
  result: AuditResult
  metadata?: any
}

export class AuditService {
  async logActivity(activity: AuditActivity): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: activity.userId,
          action: activity.action,
          resource: activity.resource,
          resourceId: activity.resourceId,
          changes: activity.changes,
          ipAddress: activity.ipAddress,
          userAgent: activity.userAgent,
          result: activity.result,
        }
      })
    } catch (error) {
      console.error('Failed to log audit activity:', error)
    }
  }

  async logFromRequest(
    req: AuthenticatedRequest,
    action: string,
    resource: string,
    resourceId?: string,
    changes?: any,
    result: AuditResult = 'SUCCESS'
  ): Promise<void> {
    if (!req.user) return

    await this.logActivity({
      userId: req.user.id,
      action,
      resource,
      resourceId,
      changes,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      result
    })
  }

  async getAuditLogs(filters: {
    userId?: string
    resource?: string
    action?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }) {
    const {
      userId,
      resource,
      action,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = filters

    const where: any = {}

    if (userId) where.userId = userId
    if (resource) where.resource = resource
    if (action) where.action = action
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = startDate
      if (endDate) where.timestamp.lte = endDate
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.auditLog.count({ where })
    ])

    return {
      logs,
      total,
      hasMore: offset + limit < total
    }
  }

  private getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      'unknown'
    )
  }

  async getAuditStats(filters: {
    startDate?: Date
    endDate?: Date
    userId?: string
  }) {
    const { startDate, endDate, userId } = filters

    const where: any = {}
    if (userId) where.userId = userId
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) where.timestamp.gte = startDate
      if (endDate) where.timestamp.lte = endDate
    }

    const [
      totalActions,
      successfulActions,
      failedActions,
      actionsByResource,
      actionsByDay
    ] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({ 
        where: { ...where, result: 'SUCCESS' }
      }),
      prisma.auditLog.count({ 
        where: { ...where, result: 'FAILURE' }
      }),
      prisma.auditLog.groupBy({
        by: ['resource'],
        where,
        _count: { id: true }
      }),
      prisma.auditLog.groupBy({
        by: ['timestamp'],
        where,
        _count: { id: true }
      })
    ])

    return {
      total: totalActions,
      successful: successfulActions,
      failed: failedActions,
      successRate: totalActions > 0 ? (successfulActions / totalActions) * 100 : 0,
      byResource: actionsByResource.map(item => ({
        resource: item.resource,
        count: item._count.id
      })),
      byDay: actionsByDay.map(item => ({
        date: item.timestamp,
        count: item._count.id
      }))
    }
  }
}