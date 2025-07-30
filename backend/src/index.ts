import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import dotenv from 'dotenv'
import pino from 'pino'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import routes from './routes'
import { MonitoringService } from './services/monitoring.service' // Re-enabled with stub
// import { MonitoringController } from './controllers/monitoring.controller' // Still disabled
import { NotificationService } from './services/notification.service'
import { NotificationController } from './controllers/notification.controller'

// Load environment variables
dotenv.config()

// Initialize logger
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard',
    },
  },
})

// Initialize Prisma
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
})

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// Create Express app
const app = express()
const httpServer = createServer(app)

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  },
})

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // We'll configure this properly later
}))
app.use(compression())
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Initialize services
// Temporarily disabled monitoring service due to dependency issues
const monitoringService = new MonitoringService(io, redis)
const notificationService = new NotificationService(redis)

// Set services for controllers
// MonitoringController.setMonitoringService(monitoringService)
NotificationController.setNotificationService(notificationService)

// API routes
app.use('/api', routes)

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`)

  socket.on('subscribe:server', (serverId: string) => {
    socket.join(`server:${serverId}`)
    logger.info(`Client ${socket.id} subscribed to server ${serverId}`)
  })

  socket.on('unsubscribe:server', (serverId: string) => {
    socket.leave(`server:${serverId}`)
    logger.info(`Client ${socket.id} unsubscribed from server ${serverId}`)
  })

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`)
  })
})

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err)
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  })
})

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Shutting down gracefully...')
  
  // Shutdown services
  monitoringService.shutdown() // Re-enabled with stub
  notificationService.shutdown()
  
  httpServer.close(() => {
    logger.info('HTTP server closed')
  })

  await prisma.$disconnect()
  logger.info('Database connection closed')

  redis.disconnect()
  logger.info('Redis connection closed')

  process.exit(0)
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// Start server
const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV}`)
})

// Export for testing
export { app, io, prisma, redis, logger, notificationService }