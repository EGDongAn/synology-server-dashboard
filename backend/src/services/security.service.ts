import bcrypt from 'bcrypt'
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { PrismaClient } from '@prisma/client'

export class SecurityService {
  private prisma: PrismaClient
  private encryptionKey: string

  constructor() {
    this.prisma = new PrismaClient()
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateEncryptionKey()
  }

  // Password security
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12
    return await bcrypt.hash(password, saltRounds)
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash)
  }

  // Encryption for sensitive data
  encrypt(text: string): { encrypted: string; iv: string } {
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'), iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return {
      encrypted: encrypted + ':' + authTag.toString('hex'),
      iv: iv.toString('hex')
    }
  }

  decrypt(encryptedData: string, iv: string): string {
    const [encrypted, authTag] = encryptedData.split(':')
    
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'), Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  // SSH key encryption for server credentials
  encryptSSHCredentials(credentials: any): any {
    const encryptedCreds = { ...credentials }
    
    if (credentials.password) {
      const encrypted = this.encrypt(credentials.password)
      encryptedCreds.password = encrypted.encrypted
      encryptedCreds.passwordIv = encrypted.iv
    }
    
    if (credentials.privateKey) {
      const encrypted = this.encrypt(credentials.privateKey)
      encryptedCreds.privateKey = encrypted.encrypted
      encryptedCreds.privateKeyIv = encrypted.iv
    }
    
    return encryptedCreds
  }

  decryptSSHCredentials(encryptedCreds: any): any {
    const credentials = { ...encryptedCreds }
    
    if (encryptedCreds.password && encryptedCreds.passwordIv) {
      credentials.password = this.decrypt(encryptedCreds.password, encryptedCreds.passwordIv)
      delete credentials.passwordIv
    }
    
    if (encryptedCreds.privateKey && encryptedCreds.privateKeyIv) {
      credentials.privateKey = this.decrypt(encryptedCreds.privateKey, encryptedCreds.privateKeyIv)
      delete credentials.privateKeyIv
    }
    
    return credentials
  }

  // Audit logging
  async logSecurityEvent(event: {
    type: 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN' | 'ACCESS_DENIED' | 'DATA_ACCESS' | 'PRIVILEGE_ESCALATION'
    userId?: string
    ipAddress: string
    userAgent: string
    resource?: string
    details?: any
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          type: event.type,
          userId: event.userId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          resource: event.resource,
          details: event.details ? JSON.stringify(event.details) : null,
          timestamp: new Date()
        }
      })
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  // Session security
  generateSecureToken(): string {
    return randomBytes(32).toString('hex')
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  // Input validation
  validateServerConnection(serverData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    // Validate IP address
    if (!this.isValidIP(serverData.ipAddress) && !this.isValidHostname(serverData.ipAddress)) {
      errors.push('Invalid IP address or hostname')
    }
    
    // Validate SSH port
    if (serverData.sshPort && (serverData.sshPort < 1 || serverData.sshPort > 65535)) {
      errors.push('Invalid SSH port')
    }
    
    // Validate credentials
    if (!serverData.username || serverData.username.length < 1) {
      errors.push('Username is required')
    }
    
    if (serverData.authType === 'password' && !serverData.password) {
      errors.push('Password is required for password authentication')
    }
    
    if (serverData.authType === 'key' && !serverData.privateKey) {
      errors.push('Private key is required for key authentication')
    }
    
    // Check for SSH key format
    if (serverData.privateKey && !this.isValidSSHKey(serverData.privateKey)) {
      errors.push('Invalid SSH private key format')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Access control
  async checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { role: { include: { permissions: true } } }
      })
      
      if (!user || !user.role) {
        return false
      }
      
      return user.role.permissions.some(permission => 
        permission.resource === resource && permission.action === action
      )
    } catch (error) {
      console.error('Permission check failed:', error)
      return false
    }
  }

  // Rate limiting helpers
  async isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
    // This would integrate with Redis for distributed rate limiting
    // Implementation depends on your Redis setup
    return false
  }

  // Security headers validation
  validateSecurityHeaders(req: any): boolean {
    const requiredHeaders = ['user-agent', 'accept']
    
    for (const header of requiredHeaders) {
      if (!req.headers[header]) {
        return false
      }
    }
    
    // Check for suspicious user agents
    const userAgent = req.headers['user-agent']
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i
    ]
    
    return !suspiciousPatterns.some(pattern => pattern.test(userAgent))
  }

  // Private helper methods
  private generateEncryptionKey(): string {
    const key = randomBytes(32).toString('hex')
    console.warn('Generated new encryption key. Set ENCRYPTION_KEY environment variable.')
    return key
  }

  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip)
  }

  private isValidHostname(hostname: string): boolean {
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    return hostnameRegex.test(hostname)
  }

  private isValidSSHKey(key: string): boolean {
    return key.includes('-----BEGIN') && key.includes('-----END')
  }

  // Threat detection
  async detectSuspiciousActivity(userId: string, ipAddress: string): Promise<boolean> {
    try {
      const recentLogs = await this.prisma.auditLog.findMany({
        where: {
          userId,
          timestamp: {
            gte: new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
          }
        }
      })
      
      // Check for rapid requests
      if (recentLogs.length > 100) {
        return true
      }
      
      // Check for multiple IP addresses
      const uniqueIPs = new Set(recentLogs.map(log => log.ipAddress))
      if (uniqueIPs.size > 3) {
        return true
      }
      
      // Check for failed login attempts
      const failedLogins = recentLogs.filter(log => log.type === 'FAILED_LOGIN')
      if (failedLogins.length > 5) {
        return true
      }
      
      return false
    } catch (error) {
      console.error('Threat detection failed:', error)
      return false
    }
  }
}