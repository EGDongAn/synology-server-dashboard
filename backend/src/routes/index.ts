import { Router } from 'express'
import authRoutes from './auth.routes'
import serverRoutes from './server.routes'
import dockerRoutes from './docker.routes'
// import monitoringRoutes from './monitoring.routes' // Temporarily disabled
import notificationRoutes from './notification.routes'
import deploymentRoutes from './deployment.routes'

const router = Router()

// API version
router.use('/v1/auth', authRoutes)
router.use('/v1/servers', serverRoutes)
router.use('/v1/docker', dockerRoutes)
// router.use('/v1/monitoring', monitoringRoutes) // Temporarily disabled
router.use('/v1/notifications', notificationRoutes)
router.use('/v1/deployments', deploymentRoutes)

// Health check for API
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      api: 'healthy',
      database: 'healthy', // TODO: Add actual DB health check
      redis: 'healthy'     // TODO: Add actual Redis health check
    }
  })
})

// API documentation placeholder
router.get('/docs', (_req, res) => {
  res.json({
    message: 'API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: {
        login: 'POST /api/v1/auth/login',
        logout: 'POST /api/v1/auth/logout',
        refresh: 'POST /api/v1/auth/refresh',
        profile: 'GET /api/v1/auth/profile',
        changePassword: 'POST /api/v1/auth/change-password',
        validate: 'POST /api/v1/auth/validate'
      },
      servers: {
        list: 'GET /api/v1/servers',
        create: 'POST /api/v1/servers',
        get: 'GET /api/v1/servers/:id',
        update: 'PUT /api/v1/servers/:id',
        delete: 'DELETE /api/v1/servers/:id',
        testConnection: 'POST /api/v1/servers/:id/test-connection',
        systemInfo: 'GET /api/v1/servers/:id/system-info',
        updateResources: 'POST /api/v1/servers/:id/update-resources',
        executeCommand: 'POST /api/v1/servers/:id/execute'
      },
      docker: {
        containers: 'GET /api/v1/docker/:serverId/containers',
        createContainer: 'POST /api/v1/docker/:serverId/containers',
        containerDetails: 'GET /api/v1/docker/:serverId/containers/:containerId',
        startContainer: 'POST /api/v1/docker/:serverId/containers/:containerId/start',
        stopContainer: 'POST /api/v1/docker/:serverId/containers/:containerId/stop',
        restartContainer: 'POST /api/v1/docker/:serverId/containers/:containerId/restart',
        removeContainer: 'DELETE /api/v1/docker/:serverId/containers/:containerId',
        containerLogs: 'GET /api/v1/docker/:serverId/containers/:containerId/logs',
        executeInContainer: 'POST /api/v1/docker/:serverId/containers/:containerId/exec',
        images: 'GET /api/v1/docker/:serverId/images',
        pullImage: 'POST /api/v1/docker/:serverId/images/pull',
        dockerInfo: 'GET /api/v1/docker/:serverId/info'
      },
      monitoring: {
        serverMetrics: 'GET /api/v1/monitoring/servers/:serverId/metrics',
        startMonitoring: 'POST /api/v1/monitoring/servers/:serverId/start',
        stopMonitoring: 'POST /api/v1/monitoring/servers/:serverId/stop',
        collectMetrics: 'POST /api/v1/monitoring/servers/:serverId/collect',
        startHealthCheck: 'POST /api/v1/monitoring/services/:serviceId/healthcheck/start',
        stopHealthCheck: 'POST /api/v1/monitoring/services/:serviceId/healthcheck/stop',
        healthChecks: 'GET /api/v1/monitoring/services/:serviceId/healthcheck',
        alerts: 'GET /api/v1/monitoring/alerts',
        acknowledgeAlert: 'POST /api/v1/monitoring/alerts/:alertId/acknowledge',
        resolveAlert: 'POST /api/v1/monitoring/alerts/:alertId/resolve'
      },
      notifications: {
        history: 'GET /api/v1/notifications/history',
        stats: 'GET /api/v1/notifications/stats',
        channels: 'GET /api/v1/notifications/channels',
        activeAlerts: 'GET /api/v1/notifications/alerts/active',
        settings: 'PUT /api/v1/notifications/settings',
        retry: 'POST /api/v1/notifications/retry',
        test: 'POST /api/v1/notifications/test',
        createAlert: 'POST /api/v1/notifications/alerts'
      },
      deployments: {
        list: 'GET /api/v1/deployments',
        create: 'POST /api/v1/deployments',
        get: 'GET /api/v1/deployments/:id',
        update: 'PUT /api/v1/deployments/:id',
        delete: 'DELETE /api/v1/deployments/:id',
        deploy: 'POST /api/v1/deployments/:id/deploy',
        rollback: 'POST /api/v1/deployments/:id/rollback',
        stop: 'POST /api/v1/deployments/:id/stop',
        restart: 'POST /api/v1/deployments/:id/restart',
        logs: 'GET /api/v1/deployments/:id/logs',
        stats: 'GET /api/v1/deployments/stats'
      }
    }
  })
})

export default router