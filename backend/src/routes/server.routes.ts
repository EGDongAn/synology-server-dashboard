import { Router } from 'express'
import { ServerController } from '../controllers/server.controller'
import { authenticateToken, authorize } from '../middleware/auth'
import rateLimit from 'express-rate-limit'

const router = Router()
const serverController = new ServerController()

// Rate limiting
const serverActionsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
})

const commandExecutionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 command executions per minute
  standardHeaders: true,
  legacyHeaders: false,
})

// All routes require authentication
router.use(authenticateToken)

// GET routes (read operations)
router.get('/', serverController.getServers.bind(serverController))
router.get('/stats/connections', 
  authorize(['ADMIN']), 
  serverController.getConnectionStats.bind(serverController)
)
router.get('/:id', serverController.getServerById.bind(serverController))
router.get('/:id/system-info', 
  serverActionsRateLimit,
  serverController.getSystemInfo.bind(serverController)
)

// POST routes (create and action operations)
router.post('/', 
  authorize(['ADMIN', 'OPERATOR']),
  serverActionsRateLimit,
  serverController.createServer.bind(serverController)
)

router.post('/bulk/update-resources',
  authorize(['ADMIN', 'OPERATOR']),
  serverActionsRateLimit,
  serverController.bulkUpdateResources.bind(serverController)
)

router.post('/:id/test-connection',
  serverActionsRateLimit,
  serverController.testConnection.bind(serverController)
)

router.post('/:id/update-resources',
  serverActionsRateLimit,
  serverController.updateResources.bind(serverController)
)

router.post('/:id/execute',
  authorize(['ADMIN', 'OPERATOR']),
  commandExecutionRateLimit,
  serverController.executeCommand.bind(serverController)
)

// PUT routes (update operations)
router.put('/:id',
  authorize(['ADMIN', 'OPERATOR']),
  serverActionsRateLimit,
  serverController.updateServer.bind(serverController)
)

// DELETE routes (delete operations)
router.delete('/:id',
  authorize(['ADMIN']),
  serverActionsRateLimit,
  serverController.deleteServer.bind(serverController)
)

export default router