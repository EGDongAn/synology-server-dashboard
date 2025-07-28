import Docker from 'dockerode'
import { PrismaClient } from '@prisma/client'
import { SSHService } from './ssh.service'
import { logger } from '../index'

const prisma = new PrismaClient()

export interface DockerConnectionConfig {
  serverId: string
  host: string
  port?: number
  protocol?: string
}

export interface ContainerConfig {
  name: string
  image: string
  ports?: Array<{ host: number; container: number; protocol?: string }>
  environment?: Record<string, string>
  volumes?: Array<{ host: string; container: string; mode?: string }>
  restart?: string
  workdir?: string
  command?: string | string[]
  labels?: Record<string, string>
  networks?: string[]
  memory?: number
  cpus?: number
}

export interface ContainerInfo {
  id: string
  name: string
  image: string
  status: string
  state: string
  created: Date
  ports: Array<{ host?: number; container: number; type: string }>
  labels: Record<string, string>
  networks: string[]
}

export class DockerService {
  private dockerClients = new Map<string, Docker>()
  private sshService: SSHService

  constructor() {
    this.sshService = new SSHService()
  }

  async getDockerClient(serverId: string): Promise<Docker> {
    const existingClient = this.dockerClients.get(serverId)
    if (existingClient) {
      try {
        // Test connection
        await existingClient.ping()
        return existingClient
      } catch (error) {
        this.dockerClients.delete(serverId)
      }
    }

    const server = await prisma.server.findUnique({
      where: { id: serverId }
    })

    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    const dockerPort = server.dockerPort || 2376
    const dockerClient = new Docker({
      host: server.ipAddress,
      port: dockerPort,
      protocol: 'http',
      timeout: 30000
    })

    try {
      await dockerClient.ping()
      this.dockerClients.set(serverId, dockerClient)
      return dockerClient
    } catch (error) {
      // Fallback to SSH-based Docker commands
      logger.warn(`Direct Docker connection failed for server ${serverId}, using SSH fallback`)
      throw new Error('Docker daemon not accessible. Ensure Docker API is enabled.')
    }
  }

  async createContainer(serverId: string, config: ContainerConfig): Promise<string> {
    try {
      const docker = await this.getDockerClient(serverId)
      
      // Pull image if not exists
      await this.pullImage(serverId, config.image)

      const createOptions: any = {
        name: config.name,
        Image: config.image,
        Env: config.environment ? Object.entries(config.environment).map(([k, v]) => `${k}=${v}`) : [],
        Labels: {
          'synology.dashboard.managed': 'true',
          ...config.labels
        },
        HostConfig: {
          RestartPolicy: { Name: config.restart || 'unless-stopped' }
        }
      }

      // Port mappings
      if (config.ports && config.ports.length > 0) {
        createOptions.HostConfig.PortBindings = {}
        createOptions.ExposedPorts = {}
        
        config.ports.forEach(port => {
          const containerPort = `${port.container}/${port.protocol || 'tcp'}`
          createOptions.ExposedPorts[containerPort] = {}
          createOptions.HostConfig.PortBindings[containerPort] = [{
            HostPort: port.host.toString()
          }]
        })
      }

      // Volume mappings
      if (config.volumes && config.volumes.length > 0) {
        createOptions.HostConfig.Binds = config.volumes.map(vol => 
          `${vol.host}:${vol.container}${vol.mode ? ':' + vol.mode : ''}`
        )
      }

      // Working directory
      if (config.workdir) {
        createOptions.WorkingDir = config.workdir
      }

      // Command
      if (config.command) {
        createOptions.Cmd = Array.isArray(config.command) ? config.command : config.command.split(' ')
      }

      // Resource limits
      if (config.memory) {
        createOptions.HostConfig.Memory = config.memory * 1024 * 1024 // Convert MB to bytes
      }

      if (config.cpus) {
        createOptions.HostConfig.CpuShares = Math.floor(config.cpus * 1024)
      }

      const container = await docker.createContainer(createOptions)
      return container.id
    } catch (error) {
      logger.error(`Failed to create container on server ${serverId}:`, error)
      throw error
    }
  }

  async startContainer(serverId: string, containerId: string): Promise<void> {
    try {
      const docker = await this.getDockerClient(serverId)
      const container = docker.getContainer(containerId)
      await container.start()
      logger.info(`Container ${containerId} started on server ${serverId}`)
    } catch (error) {
      logger.error(`Failed to start container ${containerId} on server ${serverId}:`, error)
      throw error
    }
  }

  async stopContainer(serverId: string, containerId: string, timeout = 10): Promise<void> {
    try {
      const docker = await this.getDockerClient(serverId)
      const container = docker.getContainer(containerId)
      await container.stop({ t: timeout })
      logger.info(`Container ${containerId} stopped on server ${serverId}`)
    } catch (error) {
      logger.error(`Failed to stop container ${containerId} on server ${serverId}:`, error)
      throw error
    }
  }

  async restartContainer(serverId: string, containerId: string): Promise<void> {
    try {
      const docker = await this.getDockerClient(serverId)
      const container = docker.getContainer(containerId)
      await container.restart()
      logger.info(`Container ${containerId} restarted on server ${serverId}`)
    } catch (error) {
      logger.error(`Failed to restart container ${containerId} on server ${serverId}:`, error)
      throw error
    }
  }

  async removeContainer(serverId: string, containerId: string, force = false): Promise<void> {
    try {
      const docker = await this.getDockerClient(serverId)
      const container = docker.getContainer(containerId)
      await container.remove({ force })
      logger.info(`Container ${containerId} removed from server ${serverId}`)
    } catch (error) {
      logger.error(`Failed to remove container ${containerId} from server ${serverId}:`, error)
      throw error
    }
  }

  async getContainers(serverId: string, all = false): Promise<ContainerInfo[]> {
    try {
      const docker = await this.getDockerClient(serverId)
      const containers = await docker.listContainers({ all })
      
      return containers.map(container => ({
        id: container.Id,
        name: container.Names[0].replace('/', ''),
        image: container.Image,
        status: container.Status,
        state: container.State,
        created: new Date(container.Created * 1000),
        ports: container.Ports.map(port => ({
          host: port.PublicPort,
          container: port.PrivatePort,
          type: port.Type
        })),
        labels: container.Labels || {},
        networks: Object.keys(container.NetworkSettings?.Networks || {})
      }))
    } catch (error) {
      logger.error(`Failed to get containers from server ${serverId}:`, error)
      throw error
    }
  }

  async getContainerDetails(serverId: string, containerId: string) {
    try {
      const docker = await this.getDockerClient(serverId)
      const container = docker.getContainer(containerId)
      const details = await container.inspect()
      
      return {
        id: details.Id,
        name: details.Name.replace('/', ''),
        image: details.Config.Image,
        status: details.State.Status,
        running: details.State.Running,
        created: new Date(details.Created),
        started: details.State.StartedAt ? new Date(details.State.StartedAt) : null,
        finished: details.State.FinishedAt ? new Date(details.State.FinishedAt) : null,
        exitCode: details.State.ExitCode,
        config: {
          environment: details.Config.Env,
          command: details.Config.Cmd,
          workingDir: details.Config.WorkingDir,
          ports: details.Config.ExposedPorts ? Object.keys(details.Config.ExposedPorts) : [],
          volumes: details.Mounts.map((mount: any) => ({
            source: mount.Source,
            destination: mount.Destination,
            mode: mount.Mode,
            rw: mount.RW
          }))
        },
        resources: {
          memory: details.HostConfig.Memory,
          cpus: details.HostConfig.CpuShares
        },
        networks: details.NetworkSettings.Networks,
        labels: details.Config.Labels || {}
      }
    } catch (error) {
      logger.error(`Failed to get container details ${containerId} from server ${serverId}:`, error)
      throw error
    }
  }

  async getContainerLogs(
    serverId: string, 
    containerId: string, 
    options: { tail?: number; since?: string; timestamps?: boolean } = {}
  ): Promise<string> {
    try {
      const docker = await this.getDockerClient(serverId)
      const container = docker.getContainer(containerId)
      
      const logOptions = {
        stdout: true,
        stderr: true,
        tail: options.tail || 100,
        timestamps: options.timestamps || false,
        ...(options.since && { since: options.since })
      }
      
      const stream = await container.logs(logOptions)
      return stream.toString()
    } catch (error) {
      logger.error(`Failed to get logs for container ${containerId} from server ${serverId}:`, error)
      throw error
    }
  }

  async streamContainerLogs(serverId: string, containerId: string): Promise<NodeJS.ReadableStream> {
    try {
      const docker = await this.getDockerClient(serverId)
      const container = docker.getContainer(containerId)
      
      return await container.logs({
        stdout: true,
        stderr: true,
        follow: true,
        timestamps: true
      })
    } catch (error) {
      logger.error(`Failed to stream logs for container ${containerId} from server ${serverId}:`, error)
      throw error
    }
  }

  async pullImage(serverId: string, image: string): Promise<void> {
    try {
      const docker = await this.getDockerClient(serverId)
      
      return new Promise((resolve, reject) => {
        docker.pull(image, (err: any, stream: any) => {
          if (err) return reject(err)
          
          docker.modem.followProgress(stream, (err: any, output: any) => {
            if (err) return reject(err)
            logger.info(`Image ${image} pulled successfully on server ${serverId}`)
            resolve()
          })
        })
      })
    } catch (error) {
      logger.error(`Failed to pull image ${image} on server ${serverId}:`, error)
      throw error
    }
  }

  async getImages(serverId: string): Promise<any[]> {
    try {
      const docker = await this.getDockerClient(serverId)
      const images = await docker.listImages()
      
      return images.map(image => ({
        id: image.Id,
        tags: image.RepoTags || [],
        size: image.Size,
        created: new Date(image.Created * 1000),
        labels: image.Labels || {}
      }))
    } catch (error) {
      logger.error(`Failed to get images from server ${serverId}:`, error)
      throw error
    }
  }

  async removeImage(serverId: string, imageId: string, force = false): Promise<void> {
    try {
      const docker = await this.getDockerClient(serverId)
      await docker.getImage(imageId).remove({ force })
      logger.info(`Image ${imageId} removed from server ${serverId}`)
    } catch (error) {
      logger.error(`Failed to remove image ${imageId} from server ${serverId}:`, error)
      throw error
    }
  }

  async getDockerInfo(serverId: string): Promise<any> {
    try {
      const docker = await this.getDockerClient(serverId)
      const info = await docker.info()
      
      return {
        version: info.ServerVersion,
        apiVersion: info.ApiVersion,
        platform: info.OSType,
        architecture: info.Architecture,
        containers: {
          total: info.Containers,
          running: info.ContainersRunning,
          paused: info.ContainersPaused,
          stopped: info.ContainersStopped
        },
        images: info.Images,
        storage: {
          driver: info.Driver,
          total: info.DriverStatus
        },
        memory: {
          total: info.MemTotal,
          limit: info.MemoryLimit
        },
        cpu: {
          cores: info.NCPU
        },
        swarm: {
          enabled: info.Swarm?.LocalNodeState === 'active'
        }
      }
    } catch (error) {
      logger.error(`Failed to get Docker info from server ${serverId}:`, error)
      throw error
    }
  }

  async executeInContainer(
    serverId: string, 
    containerId: string, 
    command: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const docker = await this.getDockerClient(serverId)
      const container = docker.getContainer(containerId)
      
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true
      })
      
      const stream = await exec.start({ hijack: true, stdin: false })
      
      return new Promise((resolve, reject) => {
        let stdout = ''
        let stderr = ''
        
        stream.on('data', (data: Buffer) => {
          const output = data.toString()
          if (data[0] === 1) {
            stdout += output.slice(8)
          } else if (data[0] === 2) {
            stderr += output.slice(8)
          }
        })
        
        stream.on('end', async () => {
          try {
            const result = await exec.inspect()
            resolve({
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              exitCode: result.ExitCode || 0
            })
          } catch (error) {
            reject(error)
          }
        })
        
        stream.on('error', reject)
      })
    } catch (error) {
      logger.error(`Failed to execute command in container ${containerId} on server ${serverId}:`, error)
      throw error
    }
  }

  async getContainerStats(serverId: string, containerId: string): Promise<any> {
    try {
      const docker = await this.getDockerClient(serverId)
      const container = docker.getContainer(containerId)
      
      const stats = await container.stats({ stream: false })
      
      return {
        cpu: this.calculateCpuPercent(stats),
        memory: {
          usage: stats.memory_stats.usage,
          limit: stats.memory_stats.limit,
          percent: (stats.memory_stats.usage / stats.memory_stats.limit) * 100
        },
        network: stats.networks,
        io: stats.blkio_stats
      }
    } catch (error) {
      logger.error(`Failed to get stats for container ${containerId} from server ${serverId}:`, error)
      throw error
    }
  }

  private calculateCpuPercent(stats: any): number {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
    const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100
    return Math.round(cpuPercent * 100) / 100
  }

  closeConnection(serverId: string): void {
    this.dockerClients.delete(serverId)
    logger.info(`Docker connection closed for server ${serverId}`)
  }

  closeAllConnections(): void {
    this.dockerClients.clear()
    logger.info('All Docker connections closed')
  }
}