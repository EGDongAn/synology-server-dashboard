import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables
dotenv.config()

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

// Initialize Prisma
const prisma = new PrismaClient()

// Middleware
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
    database: 'connected',
    message: 'Synology Dashboard API is running!'
  })
})

// Basic API endpoint
app.get('/api/v1/test', (_req, res) => {
  res.json({
    success: true,
    message: 'API is working!',
    timestamp: new Date().toISOString()
  })
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  })
})

// Start server
const PORT = Number(process.env.PORT) || 3000
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
  console.log(`🔗 API test: http://localhost:${PORT}/api/v1/test`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...')
  httpServer.close()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...')
  httpServer.close()
  await prisma.$disconnect()
  process.exit(0)
})

export { app, io, prisma }