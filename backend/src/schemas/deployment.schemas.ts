import Joi from 'joi'

export const createDeploymentSchema = Joi.object({
  serverId: Joi.string().uuid().required(),
  serviceId: Joi.string().uuid().required(),
  version: Joi.string().optional(),
  environment: Joi.string().valid('development', 'staging', 'production').optional(),
  config: Joi.object().optional(),
  description: Joi.string().optional(),
  healthCheckUrl: Joi.string().uri().optional(),
  healthCheckInterval: Joi.number().min(30).max(3600).optional()
})

export const updateDeploymentSchema = Joi.object({
  version: Joi.string().optional(),
  status: Joi.string().valid(
    'PENDING', 'DEPLOYING', 'RUNNING', 'FAILED', 
    'STOPPING', 'STOPPED', 'ROLLING_BACK', 'ROLLED_BACK', 'ROLLBACK_FAILED'
  ).optional(),
  environment: Joi.string().valid('development', 'staging', 'production').optional(),
  config: Joi.object().optional(),
  description: Joi.string().optional(),
  healthCheckUrl: Joi.string().uri().optional(),
  healthCheckInterval: Joi.number().min(30).max(3600).optional()
})

export const rollbackSchema = Joi.object({
  targetVersion: Joi.string().optional(),
  reason: Joi.string().optional()
})