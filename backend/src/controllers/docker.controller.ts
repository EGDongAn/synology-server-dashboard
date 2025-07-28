import { Response } from 'express'
import { DockerService } from '../services/docker.service'
import { AuditService } from '../services/audit.service'
import { AuthenticatedRequest } from '../middleware/auth'
import Joi from 'joi'
import { logger } from '../index'

const dockerService = new DockerService()
const auditService = new AuditService()

// Validation schemas
const createContainerSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  image: Joi.string().min(1).required(),
  ports: Joi.array().items(
    Joi.object({
      host: Joi.number().min(1).max(65535).required(),
      container: Joi.number().min(1).max(65535).required(),
      protocol: Joi.string().valid('tcp', 'udp').default('tcp')
    })
  ).optional(),
  environment: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  volumes: Joi.array().items(
    Joi.object({
      host: Joi.string().required(),
      container: Joi.string().required(),
      mode: Joi.string().valid('ro', 'rw').default('rw')
    })
  ).optional(),
  restart: Joi.string().valid('no', 'always', 'unless-stopped', 'on-failure').default('unless-stopped'),
  workdir: Joi.string().optional(),
  command: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
  labels: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  memory: Joi.number().min(4).optional(),
  cpus: Joi.number().min(0.1).max(32).optional()
})

const executeCommandSchema = Joi.object({
  command: Joi.array().items(Joi.string().min(1)).min(1).required()
})

export class DockerController {
  async getContainers(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId } = req.params
      const { all } = req.query

      const containers = await dockerService.getContainers(serverId, all === 'true')

      res.json({
        success: true,
        data: containers
      })
    } catch (error) {
      logger.error('Get containers error:', error)
      res.status(500).json({
        error: 'Failed to fetch containers'
      })
    }
  }

  async getContainerDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId, containerId } = req.params

      const details = await dockerService.getContainerDetails(serverId, containerId)

      res.json({
        success: true,
        data: details
      })
    } catch (error) {
      logger.error('Get container details error:', error)
      res.status(500).json({
        error: 'Failed to fetch container details'
      })
    }
  }

  async createContainer(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId } = req.params
      const { error, value } = createContainerSchema.validate(req.body)
      
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        })
      }

      const containerId = await dockerService.createContainer(serverId, value)

      await auditService.logFromRequest(
        req,
        'CREATE_CONTAINER',
        'container',
        containerId,
        { serverId, config: value }
      )

      res.status(201).json({
        success: true,
        data: { id: containerId }
      })
    } catch (error) {
      logger.error('Create container error:', error)
      
      await auditService.logFromRequest(
        req,
        'CREATE_CONTAINER',
        'container',
        undefined,
        { serverId: req.params.serverId, config: req.body },
        'FAILURE'
      )

      res.status(500).json({
        error: 'Failed to create container'
      })
    }
  }

  async startContainer(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId, containerId } = req.params

      await dockerService.startContainer(serverId, containerId)

      await auditService.logFromRequest(
        req,
        'START_CONTAINER',
        'container',
        containerId,
        { serverId }
      )

      res.json({
        success: true,
        message: 'Container started successfully'
      })
    } catch (error) {
      logger.error('Start container error:', error)
      
      await auditService.logFromRequest(
        req,
        'START_CONTAINER',
        'container',
        req.params.containerId,
        { serverId: req.params.serverId },
        'FAILURE'
      )

      res.status(500).json({
        error: 'Failed to start container'
      })
    }
  }

  async stopContainer(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId, containerId } = req.params
      const { timeout } = req.query

      await dockerService.stopContainer(
        serverId, 
        containerId, 
        timeout ? parseInt(timeout as string) : undefined
      )

      await auditService.logFromRequest(
        req,
        'STOP_CONTAINER',
        'container',
        containerId,
        { serverId, timeout }
      )

      res.json({
        success: true,
        message: 'Container stopped successfully'
      })
    } catch (error) {
      logger.error('Stop container error:', error)
      
      await auditService.logFromRequest(
        req,
        'STOP_CONTAINER',
        'container',
        req.params.containerId,
        { serverId: req.params.serverId },
        'FAILURE'
      )

      res.status(500).json({
        error: 'Failed to stop container'
      })
    }
  }

  async restartContainer(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId, containerId } = req.params

      await dockerService.restartContainer(serverId, containerId)

      await auditService.logFromRequest(
        req,
        'RESTART_CONTAINER',
        'container',
        containerId,
        { serverId }
      )

      res.json({
        success: true,
        message: 'Container restarted successfully'
      })
    } catch (error) {
      logger.error('Restart container error:', error)
      
      await auditService.logFromRequest(
        req,
        'RESTART_CONTAINER',
        'container',
        req.params.containerId,
        { serverId: req.params.serverId },
        'FAILURE'
      )

      res.status(500).json({
        error: 'Failed to restart container'
      })
    }
  }

  async removeContainer(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId, containerId } = req.params
      const { force } = req.query

      await dockerService.removeContainer(serverId, containerId, force === 'true')

      await auditService.logFromRequest(
        req,
        'REMOVE_CONTAINER',
        'container',
        containerId,
        { serverId, force: force === 'true' }
      )

      res.json({
        success: true,
        message: 'Container removed successfully'
      })
    } catch (error) {
      logger.error('Remove container error:', error)
      
      await auditService.logFromRequest(
        req,
        'REMOVE_CONTAINER',
        'container',
        req.params.containerId,
        { serverId: req.params.serverId },
        'FAILURE'
      )

      res.status(500).json({
        error: 'Failed to remove container'
      })
    }
  }

  async getContainerLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId, containerId } = req.params
      const { tail, since, timestamps } = req.query

      const options: any = {}
      if (tail) options.tail = parseInt(tail as string)
      if (since) options.since = since as string
      if (timestamps) options.timestamps = timestamps === 'true'

      const logs = await dockerService.getContainerLogs(serverId, containerId, options)

      res.json({
        success: true,
        data: { logs }
      })
    } catch (error) {
      logger.error('Get container logs error:', error)
      res.status(500).json({
        error: 'Failed to fetch container logs'
      })
    }
  }

  async streamContainerLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId, containerId } = req.params

      const stream = await dockerService.streamContainerLogs(serverId, containerId)
      
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      
      stream.pipe(res)

      req.on('close', () => {
        try {
          (stream as any).destroy?.()
        } catch (e) {
          // Ignore errors on stream cleanup
        }
      })
    } catch (error) {
      logger.error('Stream container logs error:', error)
      res.status(500).json({
        error: 'Failed to stream container logs'
      })
    }
  }

  async executeInContainer(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId, containerId } = req.params
      const { error, value } = executeCommandSchema.validate(req.body)
      
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        })
      }

      const result = await dockerService.executeInContainer(serverId, containerId, value.command)

      await auditService.logFromRequest(
        req,
        'EXECUTE_IN_CONTAINER',
        'container',
        containerId,
        { serverId, command: value.command, exitCode: result.exitCode }
      )

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('Execute in container error:', error)
      
      await auditService.logFromRequest(
        req,
        'EXECUTE_IN_CONTAINER',
        'container',
        req.params.containerId,
        { serverId: req.params.serverId, command: req.body.command },
        'FAILURE'
      )

      res.status(500).json({
        error: 'Failed to execute command in container'
      })
    }
  }

  async getContainerStats(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId, containerId } = req.params

      const stats = await dockerService.getContainerStats(serverId, containerId)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('Get container stats error:', error)
      res.status(500).json({
        error: 'Failed to fetch container statistics'
      })
    }
  }

  async getImages(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId } = req.params

      const images = await dockerService.getImages(serverId)

      res.json({
        success: true,
        data: images
      })
    } catch (error) {
      logger.error('Get images error:', error)
      res.status(500).json({
        error: 'Failed to fetch images'
      })
    }
  }

  async pullImage(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId } = req.params
      const { image } = req.body

      if (!image) {
        return res.status(400).json({
          error: 'Image name is required'
        })
      }

      await dockerService.pullImage(serverId, image)

      await auditService.logFromRequest(
        req,
        'PULL_IMAGE',
        'image',
        image,
        { serverId }
      )

      res.json({
        success: true,
        message: 'Image pulled successfully'
      })
    } catch (error) {
      logger.error('Pull image error:', error)
      
      await auditService.logFromRequest(
        req,
        'PULL_IMAGE',
        'image',
        req.body.image,
        { serverId: req.params.serverId },
        'FAILURE'
      )

      res.status(500).json({
        error: 'Failed to pull image'
      })
    }
  }

  async removeImage(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId, imageId } = req.params
      const { force } = req.query

      await dockerService.removeImage(serverId, imageId, force === 'true')

      await auditService.logFromRequest(
        req,
        'REMOVE_IMAGE',
        'image',
        imageId,
        { serverId, force: force === 'true' }
      )

      res.json({
        success: true,
        message: 'Image removed successfully'
      })
    } catch (error) {
      logger.error('Remove image error:', error)
      
      await auditService.logFromRequest(
        req,
        'REMOVE_IMAGE',
        'image',
        req.params.imageId,
        { serverId: req.params.serverId },
        'FAILURE'
      )

      res.status(500).json({
        error: 'Failed to remove image'
      })
    }
  }

  async getDockerInfo(req: AuthenticatedRequest, res: Response) {
    try {
      const { serverId } = req.params

      const info = await dockerService.getDockerInfo(serverId)

      res.json({
        success: true,
        data: info
      })
    } catch (error) {
      logger.error('Get Docker info error:', error)
      res.status(500).json({
        error: 'Failed to fetch Docker information'
      })
    }
  }
}