import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { authenticateToken } from '../middleware/auth'
import rateLimit from 'express-rate-limit'

const router = Router()
const authController = new AuthController()

// Rate limiting for auth endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  standardHeaders: true,
  legacyHeaders: false,
})

// Public routes (with stricter rate limiting)
router.post('/login', authRateLimit, authController.login.bind(authController))
router.post('/refresh', authRateLimit, authController.refreshToken.bind(authController))
router.post('/validate', generalRateLimit, authController.validateToken.bind(authController))

// Protected routes
router.post('/logout', authenticateToken, authController.logout.bind(authController))
router.get('/profile', authenticateToken, authController.getProfile.bind(authController))
router.post('/change-password', authenticateToken, authController.changePassword.bind(authController))

export default router