import { Router } from 'express'
import { DockerController } from '../controllers/docker.controller'
import { authenticateToken, authorize } from '../middleware/auth'
import rateLimit from 'express-rate-limit'

const router = Router()
const dockerController = new DockerController()

// Rate limiting
const dockerActionsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
})

const containerOperationsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 container operations per minute
  standardHeaders: true,
  legacyHeaders: false,
})

// All routes require authentication
router.use(authenticateToken)

// Container routes
router.get('/:serverId/containers', 
  dockerActionsRateLimit,
  dockerController.getContainers.bind(dockerController)
)

router.post('/:serverId/containers',
  authorize(['ADMIN', 'OPERATOR']),
  containerOperationsRateLimit,
  dockerController.createContainer.bind(dockerController)
)

router.get('/:serverId/containers/:containerId',
  dockerActionsRateLimit,
  dockerController.getContainerDetails.bind(dockerController)
)

router.post('/:serverId/containers/:containerId/start',
  authorize(['ADMIN', 'OPERATOR']),
  containerOperationsRateLimit,
  dockerController.startContainer.bind(dockerController)
)

router.post('/:serverId/containers/:containerId/stop',
  authorize(['ADMIN', 'OPERATOR']),
  containerOperationsRateLimit,
  dockerController.stopContainer.bind(dockerController)
)

router.post('/:serverId/containers/:containerId/restart',
  authorize(['ADMIN', 'OPERATOR']),
  containerOperationsRateLimit,
  dockerController.restartContainer.bind(dockerController)
)

router.delete('/:serverId/containers/:containerId',
  authorize(['ADMIN', 'OPERATOR']),
  containerOperationsRateLimit,
  dockerController.removeContainer.bind(dockerController)
)

router.get('/:serverId/containers/:containerId/logs',
  dockerActionsRateLimit,
  dockerController.getContainerLogs.bind(dockerController)
)

router.get('/:serverId/containers/:containerId/logs/stream',
  dockerActionsRateLimit,
  dockerController.streamContainerLogs.bind(dockerController)
)

router.post('/:serverId/containers/:containerId/exec',
  authorize(['ADMIN', 'OPERATOR']),
  containerOperationsRateLimit,
  dockerController.executeInContainer.bind(dockerController)
)

router.get('/:serverId/containers/:containerId/stats',
  dockerActionsRateLimit,
  dockerController.getContainerStats.bind(dockerController)
)

// Image routes
router.get('/:serverId/images',
  dockerActionsRateLimit,
  dockerController.getImages.bind(dockerController)
)

router.post('/:serverId/images/pull',
  authorize(['ADMIN', 'OPERATOR']),
  containerOperationsRateLimit,
  dockerController.pullImage.bind(dockerController)
)

router.delete('/:serverId/images/:imageId',
  authorize(['ADMIN', 'OPERATOR']),
  containerOperationsRateLimit,
  dockerController.removeImage.bind(dockerController)
)

// Docker system info
router.get('/:serverId/info',
  dockerActionsRateLimit,
  dockerController.getDockerInfo.bind(dockerController)
)

export default router