import { Router } from 'express'
import { MonitoringController } from '../controllers/monitoring.controller'
import { authenticateToken, authorize } from '../middleware/auth'
import rateLimit from 'express-rate-limit'

const router = Router()
const monitoringController = new MonitoringController()

// Rate limiting
const monitoringRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
})

const monitoringActionsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 actions per minute
  standardHeaders: true,
  legacyHeaders: false,
})

// All routes require authentication
router.use(authenticateToken)

// Server metrics routes
router.get('/servers/:serverId/metrics',
  monitoringRateLimit,
  monitoringController.getServerMetrics.bind(monitoringController)
)

router.post('/servers/:serverId/start',
  authorize(['ADMIN', 'OPERATOR']),
  monitoringActionsRateLimit,
  monitoringController.startServerMonitoring.bind(monitoringController)
)

router.post('/servers/:serverId/stop',
  authorize(['ADMIN', 'OPERATOR']),
  monitoringActionsRateLimit,
  monitoringController.stopServerMonitoring.bind(monitoringController)
)

router.post('/servers/:serverId/collect',
  monitoringActionsRateLimit,
  monitoringController.collectMetrics.bind(monitoringController)
)

// Health check routes
router.post('/services/:serviceId/healthcheck/start',
  authorize(['ADMIN', 'OPERATOR']),
  monitoringActionsRateLimit,
  monitoringController.startHealthCheck.bind(monitoringController)
)

router.post('/services/:serviceId/healthcheck/stop',
  authorize(['ADMIN', 'OPERATOR']),
  monitoringActionsRateLimit,
  monitoringController.stopHealthCheck.bind(monitoringController)
)

router.get('/services/:serviceId/healthcheck',
  monitoringRateLimit,
  monitoringController.getHealthChecks.bind(monitoringController)
)

// Alert routes
router.get('/alerts',
  monitoringRateLimit,
  monitoringController.getAlerts.bind(monitoringController)
)

router.post('/alerts/:alertId/acknowledge',
  authorize(['ADMIN', 'OPERATOR']),
  monitoringActionsRateLimit,
  monitoringController.acknowledgeAlert.bind(monitoringController)
)

router.post('/alerts/:alertId/resolve',
  authorize(['ADMIN', 'OPERATOR']),
  monitoringActionsRateLimit,
  monitoringController.resolveAlert.bind(monitoringController)
)

// System stats
router.get('/stats',
  authorize(['ADMIN']),
  monitoringRateLimit,
  monitoringController.getMonitoringStats.bind(monitoringController)
)

export default router