import { Request, Response } from 'express'
import { DeploymentService } from '../services/deployment.service'
import { CreateDeploymentDto, UpdateDeploymentDto } from '../types/deployment.types'
import { AppError } from '../middleware/error.middleware'

export class DeploymentController {
  private deploymentService: DeploymentService

  constructor() {
    this.deploymentService = new DeploymentService()
  }

  async getDeployments(req: Request, res: Response) {
    try {
      const { serverId, status, limit = 20, offset = 0 } = req.query
      
      const deployments = await this.deploymentService.getDeployments({
        serverId: serverId as string,
        status: status as string,
        limit: Number(limit),
        offset: Number(offset)
      })

      res.json({
        success: true,
        data: deployments
      })
    } catch (error) {
      throw new AppError('Failed to fetch deployments', 500)
    }
  }

  async getDeployment(req: Request, res: Response) {
    try {
      const { id } = req.params
      const deployment = await this.deploymentService.getDeploymentById(id)

      if (!deployment) {
        throw new AppError('Deployment not found', 404)
      }

      res.json({
        success: true,
        data: deployment
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('Failed to fetch deployment', 500)
    }
  }

  async createDeployment(req: Request, res: Response) {
    try {
      const deploymentData: CreateDeploymentDto = req.body
      const deployment = await this.deploymentService.createDeployment(deploymentData)

      res.status(201).json({
        success: true,
        data: deployment
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('Failed to create deployment', 500)
    }
  }

  async updateDeployment(req: Request, res: Response) {
    try {
      const { id } = req.params
      const updateData: UpdateDeploymentDto = req.body
      
      const deployment = await this.deploymentService.updateDeployment(id, updateData)

      res.json({
        success: true,
        data: deployment
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('Failed to update deployment', 500)
    }
  }

  async deleteDeployment(req: Request, res: Response) {
    try {
      const { id } = req.params
      await this.deploymentService.deleteDeployment(id)

      res.json({
        success: true,
        message: 'Deployment deleted successfully'
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('Failed to delete deployment', 500)
    }
  }

  async deployService(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await this.deploymentService.deployService(id)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('Failed to deploy service', 500)
    }
  }

  async rollbackDeployment(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { targetVersion } = req.body
      
      const result = await this.deploymentService.rollbackDeployment(id, targetVersion)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('Failed to rollback deployment', 500)
    }
  }

  async getDeploymentLogs(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { limit = 100 } = req.query
      
      const logs = await this.deploymentService.getDeploymentLogs(id, Number(limit))

      res.json({
        success: true,
        data: logs
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('Failed to fetch deployment logs', 500)
    }
  }

  async stopDeployment(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await this.deploymentService.stopDeployment(id)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('Failed to stop deployment', 500)
    }
  }

  async restartService(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await this.deploymentService.restartService(id)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('Failed to restart service', 500)
    }
  }

  async getDeploymentStats(req: Request, res: Response) {
    try {
      const { serverId } = req.query
      const stats = await this.deploymentService.getDeploymentStats(serverId as string)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('Failed to fetch deployment stats', 500)
    }
  }
}