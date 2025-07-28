import { PrismaClient } from '@prisma/client'
import { SSHService } from './ssh.service'
import { DockerService } from './docker.service'
import { NotificationService } from './notification.service'
import { CreateDeploymentDto, UpdateDeploymentDto, DeploymentFilters } from '../types/deployment.types'
import { AppError } from '../middleware/error.middleware'

export class DeploymentService {
  private prisma: PrismaClient
  private sshService: SSHService
  private dockerService: DockerService
  private notificationService: NotificationService

  constructor() {
    this.prisma = new PrismaClient()
    this.sshService = new SSHService()
    this.dockerService = new DockerService()
    this.notificationService = new NotificationService()
  }

  async getDeployments(filters: DeploymentFilters) {
    const { serverId, status, limit = 20, offset = 0 } = filters

    const where: any = {}
    if (serverId) where.serverId = serverId
    if (status) where.status = status

    const [deployments, total] = await Promise.all([
      this.prisma.deployment.findMany({
        where,
        include: {
          server: {
            select: { id: true, name: true, ipAddress: true }
          },
          service: {
            select: { id: true, name: true, type: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.deployment.count({ where })
    ])

    return {
      deployments,
      total,
      hasMore: offset + limit < total
    }
  }

  async getDeploymentById(id: string) {
    return await this.prisma.deployment.findUnique({
      where: { id },
      include: {
        server: {
          select: { id: true, name: true, ipAddress: true, status: true }
        },
        service: {
          select: { id: true, name: true, type: true, config: true }
        },
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 50
        }
      }
    })
  }

  async createDeployment(data: CreateDeploymentDto) {
    // Validate server and service exist
    const [server, service] = await Promise.all([
      this.prisma.server.findUnique({ where: { id: data.serverId } }),
      this.prisma.service.findUnique({ where: { id: data.serviceId } })
    ])

    if (!server) {
      throw new AppError('Server not found', 404)
    }

    if (!service) {
      throw new AppError('Service not found', 404)
    }

    if (server.status !== 'ONLINE') {
      throw new AppError('Server is not online', 400)
    }

    const deployment = await this.prisma.deployment.create({
      data: {
        ...data,
        status: 'PENDING',
        version: data.version || '1.0.0',
        config: data.config || {}
      },
      include: {
        server: true,
        service: true
      }
    })

    // Create initial log entry
    await this.createDeploymentLog(deployment.id, 'INFO', 'Deployment created')

    return deployment
  }

  async updateDeployment(id: string, data: UpdateDeploymentDto) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id }
    })

    if (!deployment) {
      throw new AppError('Deployment not found', 404)
    }

    const updated = await this.prisma.deployment.update({
      where: { id },
      data,
      include: {
        server: true,
        service: true
      }
    })

    await this.createDeploymentLog(id, 'INFO', `Deployment updated: ${JSON.stringify(data)}`)

    return updated
  }

  async deleteDeployment(id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id }
    })

    if (!deployment) {
      throw new AppError('Deployment not found', 404)
    }

    if (deployment.status === 'RUNNING') {
      throw new AppError('Cannot delete running deployment', 400)
    }

    // Delete logs first due to foreign key constraint
    await this.prisma.deploymentLog.deleteMany({
      where: { deploymentId: id }
    })

    await this.prisma.deployment.delete({
      where: { id }
    })
  }

  async deployService(id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: {
        server: true,
        service: true
      }
    })

    if (!deployment) {
      throw new AppError('Deployment not found', 404)
    }

    if (deployment.status === 'RUNNING') {
      throw new AppError('Deployment is already running', 400)
    }

    try {
      // Update status to deploying
      await this.updateDeploymentStatus(id, 'DEPLOYING')
      await this.createDeploymentLog(id, 'INFO', 'Starting deployment...')

      // Execute deployment based on service type
      let result: any
      
      if (deployment.service.type === 'DOCKER') {
        result = await this.deployDockerService(deployment)
      } else if (deployment.service.type === 'SYSTEMD') {
        result = await this.deploySystemdService(deployment)
      } else {
        result = await this.deployGenericService(deployment)
      }

      await this.updateDeploymentStatus(id, 'RUNNING')
      await this.createDeploymentLog(id, 'SUCCESS', 'Deployment completed successfully')

      // Send notification
      await this.notificationService.createAlert({
        serverId: deployment.serverId,
        serviceId: deployment.serviceId,
        type: 'DEPLOYMENT',
        severity: 'LOW',
        title: 'Deployment Successful',
        message: `Service ${deployment.service.name} deployed successfully`,
        channels: ['email']
      })

      return result

    } catch (error: any) {
      await this.updateDeploymentStatus(id, 'FAILED')
      await this.createDeploymentLog(id, 'ERROR', `Deployment failed: ${error.message}`)

      // Send failure notification
      await this.notificationService.createAlert({
        serverId: deployment.serverId,
        serviceId: deployment.serviceId,
        type: 'DEPLOYMENT',
        severity: 'HIGH',
        title: 'Deployment Failed',
        message: `Service ${deployment.service.name} deployment failed: ${error.message}`,
        channels: ['email', 'slack']
      })

      throw error
    }
  }

  async rollbackDeployment(id: string, targetVersion?: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: {
        server: true,
        service: true
      }
    })

    if (!deployment) {
      throw new AppError('Deployment not found', 404)
    }

    try {
      await this.updateDeploymentStatus(id, 'ROLLING_BACK')
      await this.createDeploymentLog(id, 'INFO', `Starting rollback${targetVersion ? ` to version ${targetVersion}` : ''}...`)

      // Find previous successful deployment if no target version specified
      let rollbackTarget = targetVersion
      if (!rollbackTarget) {
        const previousDeployment = await this.prisma.deployment.findFirst({
          where: {
            serviceId: deployment.serviceId,
            serverId: deployment.serverId,
            status: 'RUNNING',
            createdAt: { lt: deployment.createdAt }
          },
          orderBy: { createdAt: 'desc' }
        })

        if (previousDeployment) {
          rollbackTarget = previousDeployment.version
        } else {
          throw new AppError('No previous version found for rollback', 400)
        }
      }

      // Execute rollback based on service type
      let result: any
      
      if (deployment.service.type === 'DOCKER') {
        result = await this.rollbackDockerService(deployment, rollbackTarget)
      } else if (deployment.service.type === 'SYSTEMD') {
        result = await this.rollbackSystemdService(deployment, rollbackTarget)
      } else {
        result = await this.rollbackGenericService(deployment, rollbackTarget)
      }

      await this.updateDeploymentStatus(id, 'ROLLED_BACK')
      await this.createDeploymentLog(id, 'SUCCESS', `Rollback to version ${rollbackTarget} completed`)

      // Send notification
      await this.notificationService.createAlert({
        serverId: deployment.serverId,
        serviceId: deployment.serviceId,
        type: 'DEPLOYMENT',
        severity: 'MEDIUM',
        title: 'Deployment Rolled Back',
        message: `Service ${deployment.service.name} rolled back to version ${rollbackTarget}`,
        channels: ['email']
      })

      return result

    } catch (error: any) {
      await this.updateDeploymentStatus(id, 'ROLLBACK_FAILED')
      await this.createDeploymentLog(id, 'ERROR', `Rollback failed: ${error.message}`)

      throw error
    }
  }

  async stopDeployment(id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: { server: true, service: true }
    })

    if (!deployment) {
      throw new AppError('Deployment not found', 404)
    }

    try {
      await this.updateDeploymentStatus(id, 'STOPPING')
      await this.createDeploymentLog(id, 'INFO', 'Stopping service...')

      if (deployment.service.type === 'DOCKER') {
        await this.stopDockerService(deployment)
      } else if (deployment.service.type === 'SYSTEMD') {
        await this.stopSystemdService(deployment)
      }

      await this.updateDeploymentStatus(id, 'STOPPED')
      await this.createDeploymentLog(id, 'SUCCESS', 'Service stopped successfully')

      return { success: true }

    } catch (error: any) {
      await this.createDeploymentLog(id, 'ERROR', `Failed to stop service: ${error.message}`)
      throw error
    }
  }

  async restartService(id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: { server: true, service: true }
    })

    if (!deployment) {
      throw new AppError('Deployment not found', 404)
    }

    try {
      await this.createDeploymentLog(id, 'INFO', 'Restarting service...')

      if (deployment.service.type === 'DOCKER') {
        await this.restartDockerService(deployment)
      } else if (deployment.service.type === 'SYSTEMD') {
        await this.restartSystemdService(deployment)
      }

      await this.createDeploymentLog(id, 'SUCCESS', 'Service restarted successfully')

      return { success: true }

    } catch (error: any) {
      await this.createDeploymentLog(id, 'ERROR', `Failed to restart service: ${error.message}`)
      throw error
    }
  }

  async getDeploymentLogs(id: string, limit = 100) {
    return await this.prisma.deploymentLog.findMany({
      where: { deploymentId: id },
      orderBy: { timestamp: 'desc' },
      take: limit
    })
  }

  async getDeploymentStats(serverId?: string) {
    const where: any = {}
    if (serverId) where.serverId = serverId

    const [total, running, failed, successful] = await Promise.all([
      this.prisma.deployment.count({ where }),
      this.prisma.deployment.count({ where: { ...where, status: 'RUNNING' } }),
      this.prisma.deployment.count({ where: { ...where, status: 'FAILED' } }),
      this.prisma.deployment.count({ where: { ...where, status: 'RUNNING' } })
    ])

    const recentDeployments = await this.prisma.deployment.findMany({
      where,
      include: {
        server: { select: { name: true } },
        service: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    return {
      total,
      running,
      failed,
      successful,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      recentDeployments
    }
  }

  // Private helper methods
  private async updateDeploymentStatus(id: string, status: string) {
    await this.prisma.deployment.update({
      where: { id },
      data: { 
        status,
        updatedAt: new Date()
      }
    })
  }

  private async createDeploymentLog(deploymentId: string, level: string, message: string) {
    await this.prisma.deploymentLog.create({
      data: {
        deploymentId,
        level,
        message,
        timestamp: new Date()
      }
    })
  }

  // Docker deployment methods
  private async deployDockerService(deployment: any) {
    const config = deployment.service.config as any
    const containerName = config.containerName || deployment.service.name

    await this.createDeploymentLog(deployment.id, 'INFO', `Deploying Docker container: ${containerName}`)

    // Pull latest image
    if (config.image) {
      await this.dockerService.pullImage(deployment.serverId, config.image)
      await this.createDeploymentLog(deployment.id, 'INFO', `Pulled image: ${config.image}`)
    }

    // Stop and remove existing container if it exists
    try {
      await this.dockerService.stopContainer(deployment.serverId, containerName)
      await this.dockerService.removeContainer(deployment.serverId, containerName, true)
      await this.createDeploymentLog(deployment.id, 'INFO', 'Removed existing container')
    } catch (error) {
      // Container might not exist, continue
    }

    // Create and start new container
    const createResult = await this.dockerService.createContainer(deployment.serverId, {
      name: containerName,
      image: config.image,
      env: config.environment || [],
      ports: config.ports || [],
      volumes: config.volumes || [],
      ...config.dockerConfig
    })

    await this.dockerService.startContainer(deployment.serverId, createResult.id)
    await this.createDeploymentLog(deployment.id, 'INFO', `Started container: ${createResult.id}`)

    return { containerId: createResult.id, containerName }
  }

  private async rollbackDockerService(deployment: any, targetVersion: string) {
    const config = deployment.service.config as any
    const containerName = config.containerName || deployment.service.name
    const rollbackImage = `${config.image.split(':')[0]}:${targetVersion}`

    await this.createDeploymentLog(deployment.id, 'INFO', `Rolling back to image: ${rollbackImage}`)

    // Pull rollback image
    await this.dockerService.pullImage(deployment.serverId, rollbackImage)

    // Stop current container
    await this.dockerService.stopContainer(deployment.serverId, containerName)
    await this.dockerService.removeContainer(deployment.serverId, containerName, true)

    // Create container with rollback image
    const createResult = await this.dockerService.createContainer(deployment.serverId, {
      name: containerName,
      image: rollbackImage,
      env: config.environment || [],
      ports: config.ports || [],
      volumes: config.volumes || [],
      ...config.dockerConfig
    })

    await this.dockerService.startContainer(deployment.serverId, createResult.id)

    return { containerId: createResult.id, version: targetVersion }
  }

  private async stopDockerService(deployment: any) {
    const config = deployment.service.config as any
    const containerName = config.containerName || deployment.service.name
    
    await this.dockerService.stopContainer(deployment.serverId, containerName)
  }

  private async restartDockerService(deployment: any) {
    const config = deployment.service.config as any
    const containerName = config.containerName || deployment.service.name
    
    await this.dockerService.restartContainer(deployment.serverId, containerName)
  }

  // Systemd service methods
  private async deploySystemdService(deployment: any) {
    const config = deployment.service.config as any
    const serviceName = config.serviceName || deployment.service.name

    await this.createDeploymentLog(deployment.id, 'INFO', `Deploying systemd service: ${serviceName}`)

    // Copy service files if specified
    if (config.serviceFile) {
      const command = `sudo cp ${config.serviceFile} /etc/systemd/system/${serviceName}.service`
      await this.sshService.executeCommand(deployment.serverId, command)
      await this.createDeploymentLog(deployment.id, 'INFO', 'Copied service file')
    }

    // Reload systemd and start service
    await this.sshService.executeCommand(deployment.serverId, 'sudo systemctl daemon-reload')
    await this.sshService.executeCommand(deployment.serverId, `sudo systemctl enable ${serviceName}`)
    await this.sshService.executeCommand(deployment.serverId, `sudo systemctl start ${serviceName}`)

    await this.createDeploymentLog(deployment.id, 'INFO', `Started systemd service: ${serviceName}`)

    return { serviceName }
  }

  private async rollbackSystemdService(deployment: any, targetVersion: string) {
    // For systemd services, rollback might involve restoring previous binary/config
    const config = deployment.service.config as any
    const serviceName = config.serviceName || deployment.service.name

    await this.createDeploymentLog(deployment.id, 'INFO', `Rolling back systemd service: ${serviceName}`)

    // Stop service
    await this.sshService.executeCommand(deployment.serverId, `sudo systemctl stop ${serviceName}`)

    // Restore previous version if backup path is configured
    if (config.backupPath && config.binaryPath) {
      const restoreCommand = `sudo cp ${config.backupPath}/${targetVersion}/* ${config.binaryPath}/`
      await this.sshService.executeCommand(deployment.serverId, restoreCommand)
    }

    // Restart service
    await this.sshService.executeCommand(deployment.serverId, `sudo systemctl start ${serviceName}`)

    return { serviceName, version: targetVersion }
  }

  private async stopSystemdService(deployment: any) {
    const config = deployment.service.config as any
    const serviceName = config.serviceName || deployment.service.name
    
    await this.sshService.executeCommand(deployment.serverId, `sudo systemctl stop ${serviceName}`)
  }

  private async restartSystemdService(deployment: any) {
    const config = deployment.service.config as any
    const serviceName = config.serviceName || deployment.service.name
    
    await this.sshService.executeCommand(deployment.serverId, `sudo systemctl restart ${serviceName}`)
  }

  // Generic service methods
  private async deployGenericService(deployment: any) {
    const config = deployment.service.config as any
    
    if (config.deployCommand) {
      await this.sshService.executeCommand(deployment.serverId, config.deployCommand)
      await this.createDeploymentLog(deployment.id, 'INFO', 'Executed deploy command')
    }

    return { success: true }
  }

  private async rollbackGenericService(deployment: any, targetVersion: string) {
    const config = deployment.service.config as any
    
    if (config.rollbackCommand) {
      const command = config.rollbackCommand.replace('{{version}}', targetVersion)
      await this.sshService.executeCommand(deployment.serverId, command)
      await this.createDeploymentLog(deployment.id, 'INFO', 'Executed rollback command')
    }

    return { success: true, version: targetVersion }
  }
}