import { Router } from 'express'
import { NotificationController } from '../controllers/notification.controller'
import { authenticateToken, authorize } from '../middleware/auth'
import rateLimit from 'express-rate-limit'

const router = Router()
const notificationController = new NotificationController()

// Rate limiting
const notificationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
})

const notificationActionsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 actions per minute (to prevent spam)
  standardHeaders: true,
  legacyHeaders: false,
})

// All routes require authentication
router.use(authenticateToken)

// Get notification history
router.get('/history',
  notificationRateLimit,
  notificationController.getNotificationHistory.bind(notificationController)
)

// Get notification statistics
router.get('/stats',
  notificationRateLimit,
  notificationController.getNotificationStats.bind(notificationController)
)

// Get available notification channels
router.get('/channels',
  notificationRateLimit,
  notificationController.getNotificationChannels.bind(notificationController)
)

// Get active alerts
router.get('/alerts/active',
  notificationRateLimit,
  notificationController.getActiveAlerts.bind(notificationController)
)

// Update notification settings
router.put('/settings',
  authorize(['ADMIN', 'OPERATOR']),
  notificationRateLimit,
  notificationController.updateNotificationSettings.bind(notificationController)
)

// Retry failed notifications
router.post('/retry',
  authorize(['ADMIN']),
  notificationActionsRateLimit,
  notificationController.retryFailedNotifications.bind(notificationController)
)

// Send test notification
router.post('/test',
  authorize(['ADMIN', 'OPERATOR']),
  notificationActionsRateLimit,
  notificationController.testNotification.bind(notificationController)
)

// Create manual alert
router.post('/alerts',
  authorize(['ADMIN', 'OPERATOR']),
  notificationActionsRateLimit,
  notificationController.createManualAlert.bind(notificationController)
)

export default router