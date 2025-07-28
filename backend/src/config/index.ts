import dotenv from 'dotenv'
import Joi from 'joi'

dotenv.config()

// Define validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  
  // Database
  DATABASE_URL: Joi.string().required(),
  
  // Redis
  REDIS_URL: Joi.string().required(),
  
  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  
  // Encryption
  ENCRYPTION_KEY: Joi.string().length(32).required(),
  
  // CORS
  CORS_ORIGIN: Joi.string().default('http://localhost:3001'),
  
  // Email
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  
  // Slack
  SLACK_WEBHOOK_URL: Joi.string().optional(),
  
  // Monitoring
  HEALTH_CHECK_INTERVAL: Joi.number().default(5000),
  METRICS_RETENTION_DAYS: Joi.number().default(30),
  
  // Security
  SESSION_SECRET: Joi.string().required(),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX: Joi.number().default(100),
}).unknown()

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env)
if (error) {
  throw new Error(`Config validation error: ${error.message}`)
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  database: {
    url: envVars.DATABASE_URL,
  },
  
  redis: {
    url: envVars.REDIS_URL,
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  },
  
  encryption: {
    key: envVars.ENCRYPTION_KEY,
  },
  
  cors: {
    origin: envVars.CORS_ORIGIN,
  },
  
  email: {
    host: envVars.SMTP_HOST,
    port: envVars.SMTP_PORT,
    user: envVars.SMTP_USER,
    pass: envVars.SMTP_PASS,
  },
  
  slack: {
    webhookUrl: envVars.SLACK_WEBHOOK_URL,
  },
  
  monitoring: {
    healthCheckInterval: envVars.HEALTH_CHECK_INTERVAL,
    metricsRetentionDays: envVars.METRICS_RETENTION_DAYS,
  },
  
  security: {
    sessionSecret: envVars.SESSION_SECRET,
    rateLimitWindowMs: envVars.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: envVars.RATE_LIMIT_MAX,
  },
}