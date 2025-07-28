import { Client, ConnectConfig } from 'ssh2'
import { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from '../utils/encryption'
import { logger } from '../index'

const prisma = new PrismaClient()

export interface SSHConnection {
  serverId: string
  client: Client
  lastUsed: Date
  isConnected: boolean
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
}

export class SSHService {
  private connections = new Map<string, SSHConnection>()
  private readonly connectionTimeout = 30000 // 30 seconds
  private readonly maxConnections = 50
  private readonly idleTimeout = 300000 // 5 minutes

  constructor() {
    // Cleanup idle connections every minute
    setInterval(() => {
      this.cleanupIdleConnections()
    }, 60000)
  }

  async executeCommand(serverId: string, command: string): Promise<CommandResult> {
    const startTime = Date.now()
    
    try {
      const connection = await this.getConnection(serverId)
      
      return new Promise((resolve, reject) => {
        let stdout = ''
        let stderr = ''

        connection.client.exec(command, (err, stream) => {
          if (err) {
            logger.error(`SSH exec error for server ${serverId}:`, err)
            return reject(err)
          }

          stream.on('close', (code: number) => {
            const duration = Date.now() - startTime
            resolve({
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              exitCode: code,
              duration
            })
          })

          stream.on('data', (data: Buffer) => {
            stdout += data.toString()
          })

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString()
          })

          // Set command timeout
          setTimeout(() => {
            stream.close()
            reject(new Error('Command execution timeout'))
          }, this.connectionTimeout)
        })
      })
    } catch (error) {
      logger.error(`SSH command execution failed for server ${serverId}:`, error)
      throw error
    }
  }

  async executeCommands(serverId: string, commands: string[]): Promise<CommandResult[]> {
    const results: CommandResult[] = []
    
    for (const command of commands) {
      try {
        const result = await this.executeCommand(serverId, command)
        results.push(result)
        
        // If command failed, stop execution
        if (result.exitCode !== 0) {
          break
        }
      } catch (error) {
        results.push({
          stdout: '',
          stderr: error instanceof Error ? error.message : 'Unknown error',
          exitCode: 1,
          duration: 0
        })
        break
      }
    }
    
    return results
  }

  async testConnection(serverId: string): Promise<boolean> {
    try {
      const result = await this.executeCommand(serverId, 'echo "connection_test"')
      return result.exitCode === 0 && result.stdout.includes('connection_test')
    } catch (error) {
      logger.error(`SSH connection test failed for server ${serverId}:`, error)
      return false
    }
  }

  async getSystemInfo(serverId: string) {
    try {
      const commands = [
        'uname -a',
        'cat /etc/os-release',
        'uptime',
        'free -m',
        'df -h',
        'docker --version 2>/dev/null || echo "Docker not installed"'
      ]

      const results = await this.executeCommands(serverId, commands)
      
      return {
        kernel: results[0]?.stdout || 'Unknown',
        osRelease: results[1]?.stdout || 'Unknown',
        uptime: results[2]?.stdout || 'Unknown',
        memory: results[3]?.stdout || 'Unknown',
        disk: results[4]?.stdout || 'Unknown',
        docker: results[5]?.stdout || 'Not installed'
      }
    } catch (error) {
      logger.error(`Failed to get system info for server ${serverId}:`, error)
      throw error
    }
  }

  async getResourceUsage(serverId: string) {
    try {
      const commands = [
        "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1",
        "free | grep Mem | awk '{printf \"%.1f\", ($3/$2) * 100.0}'",
        "df -h / | awk 'NR==2 {print $5}' | cut -d'%' -f1"
      ]

      const results = await this.executeCommands(serverId, commands)
      
      return {
        cpuUsage: parseFloat(results[0]?.stdout) || 0,
        memoryUsage: parseFloat(results[1]?.stdout) || 0,
        diskUsage: parseFloat(results[2]?.stdout) || 0,
        timestamp: new Date()
      }
    } catch (error) {
      logger.error(`Failed to get resource usage for server ${serverId}:`, error)
      throw error
    }
  }

  async uploadFile(serverId: string, localPath: string, remotePath: string): Promise<void> {
    const connection = await this.getConnection(serverId)
    
    return new Promise((resolve, reject) => {
      connection.client.sftp((err, sftp) => {
        if (err) return reject(err)

        sftp.fastPut(localPath, remotePath, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })
  }

  async downloadFile(serverId: string, remotePath: string, localPath: string): Promise<void> {
    const connection = await this.getConnection(serverId)
    
    return new Promise((resolve, reject) => {
      connection.client.sftp((err, sftp) => {
        if (err) return reject(err)

        sftp.fastGet(remotePath, localPath, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })
  }

  private async getConnection(serverId: string): Promise<SSHConnection> {
    // Check if we have an active connection
    const existingConnection = this.connections.get(serverId)
    if (existingConnection && existingConnection.isConnected) {
      existingConnection.lastUsed = new Date()
      return existingConnection
    }

    // Clean up dead connection
    if (existingConnection) {
      existingConnection.client.end()
      this.connections.delete(serverId)
    }

    // Check connection pool size
    if (this.connections.size >= this.maxConnections) {
      this.cleanupOldestConnection()
    }

    // Get server details
    const server = await prisma.server.findUnique({
      where: { id: serverId }
    })

    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    // Create new connection
    const client = new Client()
    const connection: SSHConnection = {
      serverId,
      client,
      lastUsed: new Date(),
      isConnected: false
    }

    try {
      await this.connectClient(client, server)
      connection.isConnected = true
      this.connections.set(serverId, connection)
      
      // Handle client events
      client.on('error', (err) => {
        logger.error(`SSH client error for server ${serverId}:`, err)
        connection.isConnected = false
        this.connections.delete(serverId)
      })

      client.on('close', () => {
        logger.info(`SSH connection closed for server ${serverId}`)
        connection.isConnected = false
        this.connections.delete(serverId)
      })

      return connection
    } catch (error) {
      logger.error(`Failed to connect to server ${serverId}:`, error)
      throw error
    }
  }

  private async connectClient(client: Client, server: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectOptions: ConnectConfig = {
        host: server.ipAddress,
        port: server.sshPort,
        username: server.username,
        readyTimeout: this.connectionTimeout,
        keepaliveInterval: 30000
      }

      // Add authentication method
      if (server.privateKey) {
        connectOptions.privateKey = decrypt(server.privateKey)
      } else if (server.password) {
        connectOptions.password = decrypt(server.password)
      } else {
        return reject(new Error('No authentication method provided'))
      }

      client.on('ready', () => {
        logger.info(`SSH connection established to ${server.ipAddress}`)
        resolve()
      })

      client.on('error', (err) => {
        logger.error(`SSH connection error to ${server.ipAddress}:`, err)
        reject(err)
      })

      client.connect(connectOptions)
    })
  }

  private cleanupIdleConnections(): void {
    const now = new Date()
    const toRemove: string[] = []

    for (const [serverId, connection] of this.connections) {
      const idleTime = now.getTime() - connection.lastUsed.getTime()
      
      if (idleTime > this.idleTimeout) {
        logger.info(`Closing idle SSH connection to server ${serverId}`)
        connection.client.end()
        toRemove.push(serverId)
      }
    }

    toRemove.forEach(serverId => {
      this.connections.delete(serverId)
    })
  }

  private cleanupOldestConnection(): void {
    let oldestTime = Date.now()
    let oldestServerId = ''

    for (const [serverId, connection] of this.connections) {
      if (connection.lastUsed.getTime() < oldestTime) {
        oldestTime = connection.lastUsed.getTime()
        oldestServerId = serverId
      }
    }

    if (oldestServerId) {
      const connection = this.connections.get(oldestServerId)
      if (connection) {
        logger.info(`Closing oldest SSH connection to server ${oldestServerId}`)
        connection.client.end()
        this.connections.delete(oldestServerId)
      }
    }
  }

  public closeConnection(serverId: string): void {
    const connection = this.connections.get(serverId)
    if (connection) {
      connection.client.end()
      this.connections.delete(serverId)
      logger.info(`Manually closed SSH connection to server ${serverId}`)
    }
  }

  public closeAllConnections(): void {
    for (const [serverId, connection] of this.connections) {
      connection.client.end()
    }
    this.connections.clear()
    logger.info('All SSH connections closed')
  }

  public getConnectionStats() {
    return {
      activeConnections: this.connections.size,
      maxConnections: this.maxConnections,
      connections: Array.from(this.connections.entries()).map(([serverId, connection]) => ({
        serverId,
        lastUsed: connection.lastUsed,
        isConnected: connection.isConnected
      }))
    }
  }
}