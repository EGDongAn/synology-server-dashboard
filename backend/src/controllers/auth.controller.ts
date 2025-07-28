import { Request, Response } from 'express'
import { AuthService } from '../services/auth.service'
import { AuthenticatedRequest } from '../middleware/auth'
import Joi from 'joi'
import { logger } from '../index'

const authService = new AuthService()

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
})

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
})

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
})

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { error, value } = loginSchema.validate(req.body)
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        })
      }

      const result = await authService.login(value)
      
      logger.info(`User logged in: ${value.email}`)
      
      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('Login error:', error)
      
      if (error instanceof Error && error.message === 'Invalid credentials') {
        return res.status(401).json({
          error: 'Invalid email or password'
        })
      }

      res.status(500).json({
        error: 'Login failed'
      })
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const { error, value } = refreshTokenSchema.validate(req.body)
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        })
      }

      const result = await authService.refreshToken(value.refreshToken)
      
      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('Refresh token error:', error)
      res.status(401).json({
        error: 'Invalid or expired refresh token'
      })
    }
  }

  async logout(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required'
        })
      }

      await authService.logout(req.user.id)
      
      logger.info(`User logged out: ${req.user.email}`)
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      })
    } catch (error) {
      logger.error('Logout error:', error)
      res.status(500).json({
        error: 'Logout failed'
      })
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required'
        })
      }

      const profile = await authService.getUserProfile(req.user.id)
      
      res.json({
        success: true,
        data: profile
      })
    } catch (error) {
      logger.error('Get profile error:', error)
      res.status(500).json({
        error: 'Failed to fetch profile'
      })
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required'
        })
      }

      const { error, value } = changePasswordSchema.validate(req.body)
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        })
      }

      await authService.changePassword(
        req.user.id,
        value.currentPassword,
        value.newPassword
      )
      
      logger.info(`Password changed for user: ${req.user.email}`)
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      })
    } catch (error) {
      logger.error('Change password error:', error)
      
      if (error instanceof Error && error.message === 'Current password is incorrect') {
        return res.status(400).json({
          error: 'Current password is incorrect'
        })
      }

      res.status(500).json({
        error: 'Failed to change password'
      })
    }
  }

  async validateToken(req: Request, res: Response) {
    try {
      const authHeader = req.headers['authorization']
      const token = authHeader && authHeader.split(' ')[1]

      if (!token) {
        return res.json({
          valid: false,
          error: 'No token provided'
        })
      }

      const result = await authService.validateToken(token)
      
      res.json(result)
    } catch (error) {
      logger.error('Token validation error:', error)
      res.json({
        valid: false,
        error: 'Token validation failed'
      })
    }
  }
}