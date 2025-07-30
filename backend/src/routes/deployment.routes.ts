import { Router } from 'express'
import { DeploymentController } from '../controllers/deployment.controller'
import { authenticateToken as auth } from '../middleware/auth'
import { validate } from '../middleware/validation.middleware'
import { createDeploymentSchema, updateDeploymentSchema, rollbackSchema } from '../schemas/deployment.schemas'

const router = Router()
const deploymentController = new DeploymentController()

// Apply authentication to all routes
router.use(auth)

// GET /api/v1/deployments - Get all deployments
router.get('/', deploymentController.getDeployments.bind(deploymentController))

// GET /api/v1/deployments/stats - Get deployment statistics
router.get('/stats', deploymentController.getDeploymentStats.bind(deploymentController))

// GET /api/v1/deployments/:id - Get specific deployment
router.get('/:id', deploymentController.getDeployment.bind(deploymentController))

// POST /api/v1/deployments - Create new deployment
router.post('/', 
  validate(createDeploymentSchema),
  deploymentController.createDeployment.bind(deploymentController)
)

// PUT /api/v1/deployments/:id - Update deployment
router.put('/:id',
  validate(updateDeploymentSchema),
  deploymentController.updateDeployment.bind(deploymentController)
)

// DELETE /api/v1/deployments/:id - Delete deployment
router.delete('/:id', deploymentController.deleteDeployment.bind(deploymentController))

// POST /api/v1/deployments/:id/deploy - Deploy service
router.post('/:id/deploy', deploymentController.deployService.bind(deploymentController))

// POST /api/v1/deployments/:id/rollback - Rollback deployment
router.post('/:id/rollback',
  validate(rollbackSchema),
  deploymentController.rollbackDeployment.bind(deploymentController)
)

// POST /api/v1/deployments/:id/stop - Stop deployment
router.post('/:id/stop', deploymentController.stopDeployment.bind(deploymentController))

// POST /api/v1/deployments/:id/restart - Restart service
router.post('/:id/restart', deploymentController.restartService.bind(deploymentController))

// GET /api/v1/deployments/:id/logs - Get deployment logs
router.get('/:id/logs', deploymentController.getDeploymentLogs.bind(deploymentController))

export default router