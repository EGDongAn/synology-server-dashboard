import { PrismaClient, Server, ServerStatus } from '@prisma/client'
import { encrypt, decrypt } from '../utils/encryption'
import { SSHService } from './ssh.service'
import { logger } from '../index'

const prisma = new PrismaClient()

export interface CreateServerData {
  name: string
  description?: string
  ipAddress: string
  sshPort?: number
  dockerPort?: number
  username: string
  password?: string
  privateKey?: string
  tags?: string[]
}

export interface UpdateServerData {
  name?: string
  description?: string
  ipAddress?: string
  sshPort?: number
  dockerPort?: number
  username?: string
  password?: string
  privateKey?: string
  tags?: string[]
}

export interface ServerWithDecryptedCredentials extends Omit<Server, 'password' | 'privateKey'> {
  password?: string
  privateKey?: string
}

export class ServerService {
  private sshService: SSHService

  constructor() {
    this.sshService = new SSHService()
  }

  async createServer(data: CreateServerData): Promise<Server> {
    const {
      name,
      description,
      ipAddress,
      sshPort = 22,
      dockerPort,
      username,
      password,
      privateKey,
      tags = []
    } = data

    // Validate that either password or privateKey is provided
    if (!password && !privateKey) {
      throw new Error('Either password or private key must be provided')
    }

    // Check if server with same IP already exists
    const existingServer = await prisma.server.findFirst({
      where: { ipAddress }
    })

    if (existingServer) {
      throw new Error('Server with this IP address already exists')
    }

    try {
      // Create server with encrypted credentials
      const serverData: any = {
        name,
        description,
        ipAddress,
        sshPort,
        dockerPort,
        username,
        tags,
        status: 'OFFLINE' as ServerStatus
      }

      if (password) {
        serverData.password = encrypt(password)
      }

      if (privateKey) {
        serverData.privateKey = encrypt(privateKey)
      }

      const server = await prisma.server.create({
        data: serverData
      })

      // Test connection in background
      this.testServerConnection(server.id).catch(error => {
        logger.error(`Initial connection test failed for server ${server.id}:`, error)
      })

      logger.info(`Server created: ${server.name} (${server.id})`)
      return server
    } catch (error) {
      logger.error('Failed to create server:', error)
      throw error
    }
  }

  async updateServer(id: string, data: UpdateServerData): Promise<Server> {
    const server = await this.getServerById(id)
    if (!server) {
      throw new Error('Server not found')
    }

    const updateData: any = {}
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.ipAddress !== undefined) updateData.ipAddress = data.ipAddress
    if (data.sshPort !== undefined) updateData.sshPort = data.sshPort
    if (data.dockerPort !== undefined) updateData.dockerPort = data.dockerPort
    if (data.username !== undefined) updateData.username = data.username
    if (data.tags !== undefined) updateData.tags = data.tags

    if (data.password !== undefined) {
      updateData.password = data.password ? encrypt(data.password) : null
    }

    if (data.privateKey !== undefined) {
      updateData.privateKey = data.privateKey ? encrypt(data.privateKey) : null
    }

    try {
      const updatedServer = await prisma.server.update({
        where: { id },
        data: updateData
      })

      // Close existing SSH connection to force reconnection with new credentials
      this.sshService.closeConnection(id)

      // Test connection with new credentials
      if (data.ipAddress || data.sshPort || data.username || data.password || data.privateKey) {
        this.testServerConnection(id).catch(error => {
          logger.error(`Connection test failed after update for server ${id}:`, error)
        })
      }

      logger.info(`Server updated: ${updatedServer.name} (${id})`)
      return updatedServer
    } catch (error) {
      logger.error('Failed to update server:', error)
      throw error
    }
  }

  async deleteServer(id: string): Promise<void> {
    const server = await this.getServerById(id)
    if (!server) {
      throw new Error('Server not found')
    }

    try {
      // Close SSH connection
      this.sshService.closeConnection(id)

      // Delete server (this will cascade delete related records)
      await prisma.server.delete({
        where: { id }
      })

      logger.info(`Server deleted: ${server.name} (${id})`)
    } catch (error) {
      logger.error('Failed to delete server:', error)
      throw error
    }
  }

  async getServers(filters?: {
    status?: ServerStatus
    tags?: string[]
    search?: string
  }) {
    const where: any = {}

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags
      }
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { ipAddress: { contains: filters.search } }
      ]
    }

    const servers = await prisma.server.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        services: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        _count: {
          select: {
            services: true,
            deployments: true,
            alerts: {
              where: {
                status: 'ACTIVE'
              }
            }
          }
        }
      }
    })

    return servers
  }

  async getServerById(id: string): Promise<Server | null> {
    return await prisma.server.findUnique({
      where: { id }
    })
  }

  async getServerWithDetails(id: string) {
    const server = await prisma.server.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            deployments: {
              take: 5,
              orderBy: { startedAt: 'desc' }
            },
            alerts: {
              where: { status: 'ACTIVE' }
            }
          }
        },
        alerts: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 100
        }
      }
    })

    return server
  }

  async getServerCredentials(id: string): Promise<ServerWithDecryptedCredentials | null> {
    const server = await this.getServerById(id)
    if (!server) return null

    return {
      ...server,
      password: server.password ? decrypt(server.password) : undefined,
      privateKey: server.privateKey ? decrypt(server.privateKey) : undefined
    }
  }

  async testServerConnection(id: string): Promise<boolean> {
    try {
      const isConnected = await this.sshService.testConnection(id)
      
      // Update server status
      await prisma.server.update({
        where: { id },
        data: {
          status: isConnected ? 'ONLINE' : 'OFFLINE'
        }
      })

      return isConnected
    } catch (error) {
      // Update server status to error
      await prisma.server.update({
        where: { id },
        data: { status: 'ERROR' }
      })

      logger.error(`Connection test failed for server ${id}:`, error)
      return false
    }
  }

  async getServerSystemInfo(id: string) {
    try {
      const systemInfo = await this.sshService.getSystemInfo(id)
      return systemInfo
    } catch (error) {
      logger.error(`Failed to get system info for server ${id}:`, error)
      throw error
    }
  }

  async updateServerResources(id: string) {
    try {
      const resources = await this.sshService.getResourceUsage(id)
      
      // Update server with latest resource usage
      await prisma.server.update({
        where: { id },
        data: {
          cpuUsage: resources.cpuUsage,
          memoryUsage: resources.memoryUsage,
          diskUsage: resources.diskUsage
        }
      })

      // Store metrics for time-series data
      await prisma.serverMetric.create({
        data: {
          serverId: id,
          cpuUsage: resources.cpuUsage,
          memoryUsage: resources.memoryUsage,
          diskUsage: resources.diskUsage
        }
      })

      return resources
    } catch (error) {
      logger.error(`Failed to update resources for server ${id}:`, error)
      throw error
    }
  }

  async executeCommand(id: string, command: string) {
    try {
      const result = await this.sshService.executeCommand(id, command)
      return result
    } catch (error) {
      logger.error(`Command execution failed for server ${id}:`, error)
      throw error
    }
  }

  async bulkUpdateResources(serverIds?: string[]) {
    const servers = serverIds 
      ? await prisma.server.findMany({ where: { id: { in: serverIds } } })
      : await prisma.server.findMany({ where: { status: 'ONLINE' } })

    const results = await Promise.allSettled(
      servers.map(server => this.updateServerResources(server.id))
    )

    const successful = results.filter(result => result.status === 'fulfilled').length
    const failed = results.filter(result => result.status === 'rejected').length

    logger.info(`Bulk resource update completed: ${successful} successful, ${failed} failed`)

    return { successful, failed, total: servers.length }
  }

  getSSHConnectionStats() {
    return this.sshService.getConnectionStats()
  }
}