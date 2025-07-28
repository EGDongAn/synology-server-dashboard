import { Request, Response, NextFunction } from 'express'
import compression from 'compression'
import { createHash } from 'crypto'
import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
})

// Compression middleware
export const compressionMiddleware = compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false
    }
    return compression.filter(req, res)
  }
})

// Response caching middleware
export const cacheMiddleware = (duration: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next()
    }

    const key = createCacheKey(req)
    
    try {
      const cached = await redis.get(key)
      if (cached) {
        const data = JSON.parse(cached)
        res.set({
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'Cache-Control': `public, max-age=${duration}`
        })
        return res.json(data)
      }
    } catch (error) {
      console.error('Cache read error:', error)
    }

    // Store original send function
    const originalSend = res.json
    
    res.json = function(body: any) {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redis.setex(key, duration, JSON.stringify(body)).catch(err => {
          console.error('Cache write error:', err)
        })
      }
      
      res.set({
        'X-Cache': 'MISS',
        'Cache-Control': `public, max-age=${duration}`
      })
      
      return originalSend.call(this, body)
    }

    next()
  }
}

// Cache invalidation
export const invalidateCache = (pattern: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
    next()
  }
}

// Request timeout middleware
export const timeoutMiddleware = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout'
        })
      }
    }, timeout)

    const originalSend = res.send
    res.send = function(body: any) {
      clearTimeout(timer)
      return originalSend.call(this, body)
    }

    next()
  }
}

// Request size limiting
export const requestSizeLimit = (limit: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length']
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength)
      const limitInBytes = parseSize(limit)
      
      if (sizeInBytes > limitInBytes) {
        return res.status(413).json({
          success: false,
          error: 'Request entity too large'
        })
      }
    }
    
    next()
  }
}

// Performance monitoring
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()
  
  const originalSend = res.send
  res.send = function(body: any) {
    const duration = Date.now() - startTime
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`)
    }
    
    // Add performance headers
    res.set({
      'X-Response-Time': `${duration}ms`,
      'X-Timestamp': new Date().toISOString()
    })
    
    return originalSend.call(this, body)
  }
  
  next()
}

// Memory usage monitoring
export const memoryMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const memUsage = process.memoryUsage()
  
  // Alert if memory usage is high
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
    console.warn('High memory usage detected:', {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
    })
  }
  
  res.set('X-Memory-Usage', `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`)
  next()
}

// Helper functions
function createCacheKey(req: Request): string {
  const url = req.originalUrl || req.url
  const query = JSON.stringify(req.query)
  const userId = (req as any).user?.id || 'anonymous'
  
  return createHash('md5')
    .update(`${req.method}:${url}:${query}:${userId}`)
    .digest('hex')
}

function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  }
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/)
  if (!match) {
    throw new Error(`Invalid size format: ${size}`)
  }
  
  const value = parseFloat(match[1])
  const unit = match[2] || 'b'
  
  return value * units[unit]
}

// Database connection pooling optimization
export const optimizeDBConnections = () => {
  // This would be implemented based on your database choice
  // For Prisma, you can configure connection pooling in schema.prisma
  return (req: Request, res: Response, next: NextFunction) => {
    // Add connection pool monitoring
    const poolSize = process.env.DATABASE_CONNECTION_LIMIT || '10'
    res.set('X-DB-Pool-Size', poolSize)
    next()
  }
}