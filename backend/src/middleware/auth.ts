import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient, UserRole } from '@prisma/client'
import { config } from '../config'

const prisma = new PrismaClient()

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    role: UserRole
    name: string
  }
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      })
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any
    
    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    })

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      })
    }

    req.user = user
    next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      })
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      })
    }

    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    })
  }
}

export const authorize = (roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role
      })
    }

    next()
  }
}

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as any
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      })

      if (user) {
        req.user = user
      }
    }

    next()
  } catch (error) {
    // For optional auth, we continue even if token is invalid
    next()
  }
}