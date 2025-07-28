import { Response } from 'express'
import { ServerService } from '../services/server.service'
import { AuditService } from '../services/audit.service'
import { AuthenticatedRequest } from '../middleware/auth'
import Joi from 'joi'
import { logger } from '../index'

const serverService = new ServerService()
const auditService = new AuditService()

// Validation schemas
const createServerSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  ipAddress: Joi.string().ip().required(),
  sshPort: Joi.number().min(1).max(65535).default(22),
  dockerPort: Joi.number().min(1).max(65535).optional(),
  username: Joi.string().min(1).max(50).required(),
  password: Joi.string().min(1).optional(),
  privateKey: Joi.string().optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional()
}).custom((value, helpers) => {
  if (!value.password && !value.privateKey) {
    return helpers.error('any.required', { message: 'Either password or privateKey must be provided' })
  }
  return value
})

const updateServerSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).allow('').optional(),
  ipAddress: Joi.string().ip().optional(),
  sshPort: Joi.number().min(1).max(65535).optional(),
  dockerPort: Joi.number().min(1).max(65535).allow(null).optional(),
  username: Joi.string().min(1).max(50).optional(),
  password: Joi.string().min(1).allow('').optional(),
  privateKey: Joi.string().allow('').optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional()
})

const executeCommandSchema = Joi.object({
  command: Joi.string().min(1).max(1000).required()
})

export class ServerController {
  async createServer(req: AuthenticatedRequest, res: Response) {
    try {
      const { error, value } = createServerSchema.validate(req.body)
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        })
      }

      const server = await serverService.createServer(value)
      
      await auditService.logFromRequest(
        req,
        'CREATE_SERVER',
        'server',
        server.id,
        { name: server.name, ipAddress: server.ipAddress }
      )

      res.status(201).json({
        success: true,
        data: {
          ...server,
          password: undefined,
          privateKey: undefined
        }
      })
    } catch (error) {
      logger.error('Create server error:', error)
      
      await auditService.logFromRequest(
        req,
        'CREATE_SERVER',
        'server',
        undefined,
        req.body,
        'FAILURE'
      )

      if (error instanceof Error) {
        return res.status(400).json({
          error: error.message
        })
      }

      res.status(500).json({
        error: 'Failed to create server'
      })
    }
  }

  async getServers(req: AuthenticatedRequest, res: Response) {
    try {
      const { status, tags, search } = req.query

      const filters: any = {}
      if (status) filters.status = status
      if (tags) filters.tags = Array.isArray(tags) ? tags : [tags]
      if (search) filters.search = search as string

      const servers = await serverService.getServers(filters)
      
      // Remove sensitive data
      const sanitizedServers = servers.map(server => ({
        ...server,
        password: undefined,
        privateKey: undefined
      }))

      res.json({
        success: true,
        data: sanitizedServers
      })
    } catch (error) {
      logger.error('Get servers error:', error)
      res.status(500).json({
        error: 'Failed to fetch servers'
      })
    }
  }

  async getServerById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      const server = await serverService.getServerWithDetails(id)

      if (!server) {
        return res.status(404).json({
          error: 'Server not found'
        })
      }

      res.json({
        success: true,
        data: {
          ...server,
          password: undefined,
          privateKey: undefined
        }
      })
    } catch (error) {
      logger.error('Get server by ID error:', error)
      res.status(500).json({
        error: 'Failed to fetch server'
      })
    }
  }

  async updateServer(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      const { error, value } = updateServerSchema.validate(req.body)
      
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        })
      }

      const originalServer = await serverService.getServerById(id)
      if (!originalServer) {
        return res.status(404).json({
          error: 'Server not found'
        })
      }

      const updatedServer = await serverService.updateServer(id, value)
      
      await auditService.logFromRequest(
        req,
        'UPDATE_SERVER',
        'server',
        id,
        {
          before: { name: originalServer.name, ipAddress: originalServer.ipAddress },
          after: { name: updatedServer.name, ipAddress: updatedServer.ipAddress },
          changes: value
        }
      )

      res.json({
        success: true,
        data: {
          ...updatedServer,
          password: undefined,
          privateKey: undefined
        }
      })
    } catch (error) {
      logger.error('Update server error:', error)
      
      await auditService.logFromRequest(
        req,
        'UPDATE_SERVER',
        'server',
        req.params.id,
        req.body,
        'FAILURE'
      )

      if (error instanceof Error) {
        return res.status(400).json({
          error: error.message
        })
      }

      res.status(500).json({
        error: 'Failed to update server'
      })
    }
  }

  async deleteServer(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      
      const server = await serverService.getServerById(id)
      if (!server) {
        return res.status(404).json({
          error: 'Server not found'
        })
      }

      await serverService.deleteServer(id)
      
      await auditService.logFromRequest(
        req,
        'DELETE_SERVER',
        'server',
        id,
        { name: server.name, ipAddress: server.ipAddress }
      )

      res.json({
        success: true,
        message: 'Server deleted successfully'
      })
    } catch (error) {
      logger.error('Delete server error:', error)
      
      await auditService.logFromRequest(
        req,
        'DELETE_SERVER',
        'server',
        req.params.id,
        undefined,
        'FAILURE'
      )

      res.status(500).json({
        error: 'Failed to delete server'
      })
    }
  }

  async testConnection(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      
      const server = await serverService.getServerById(id)
      if (!server) {
        return res.status(404).json({
          error: 'Server not found'
        })
      }

      const isConnected = await serverService.testServerConnection(id)
      
      await auditService.logFromRequest(
        req,
        'TEST_CONNECTION',
        'server',
        id,
        { result: isConnected }
      )

      res.json({
        success: true,
        data: {
          connected: isConnected,
          timestamp: new Date()
        }
      })
    } catch (error) {
      logger.error('Test connection error:', error)
      res.status(500).json({
        error: 'Failed to test connection'
      })
    }
  }

  async getSystemInfo(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      
      const server = await serverService.getServerById(id)
      if (!server) {
        return res.status(404).json({
          error: 'Server not found'
        })
      }

      const systemInfo = await serverService.getServerSystemInfo(id)

      res.json({
        success: true,
        data: systemInfo
      })
    } catch (error) {
      logger.error('Get system info error:', error)
      res.status(500).json({
        error: 'Failed to get system information'
      })
    }
  }

  async updateResources(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      
      const server = await serverService.getServerById(id)
      if (!server) {
        return res.status(404).json({
          error: 'Server not found'
        })
      }

      const resources = await serverService.updateServerResources(id)

      res.json({
        success: true,
        data: resources
      })
    } catch (error) {
      logger.error('Update resources error:', error)
      res.status(500).json({
        error: 'Failed to update server resources'
      })
    }
  }

  async bulkUpdateResources(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverIds } = req.body
      
      const result = await serverService.bulkUpdateResources(serverIds)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('Bulk update resources error:', error)
      res.status(500).json({
        error: 'Failed to update server resources'
      })
    }
  }

  async executeCommand(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params
      const { error, value } = executeCommandSchema.validate(req.body)
      
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        })
      }

      const server = await serverService.getServerById(id)
      if (!server) {
        return res.status(404).json({
          error: 'Server not found'
        })
      }

      const result = await serverService.executeCommand(id, value.command)
      
      await auditService.logFromRequest(
        req,
        'EXECUTE_COMMAND',
        'server',
        id,
        {
          command: value.command,
          exitCode: result.exitCode,
          duration: result.duration
        }
      )

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('Execute command error:', error)
      
      await auditService.logFromRequest(
        req,
        'EXECUTE_COMMAND',
        'server',
        req.params.id,
        { command: req.body.command },
        'FAILURE'
      )

      res.status(500).json({
        error: 'Failed to execute command'
      })
    }
  }

  async getConnectionStats(req: AuthenticatedRequest, res: Response) {
    try {
      const stats = serverService.getSSHConnectionStats()

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('Get connection stats error:', error)
      res.status(500).json({
        error: 'Failed to get connection statistics'
      })
    }
  }
}