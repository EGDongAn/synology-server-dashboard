import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
})

// General API rate limiting
export const apiLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Strict rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
})

// Rate limiting for deployment operations
export const deploymentLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 deployment operations per 5 minutes
  message: {
    error: 'Too many deployment operations, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Rate limiting for monitoring endpoints
export const monitoringLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 monitoring requests per minute
  message: {
    error: 'Too many monitoring requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})