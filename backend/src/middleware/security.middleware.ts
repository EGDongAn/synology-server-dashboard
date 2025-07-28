import { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import { body, validationResult } from 'express-validator'
import DOMPurify from 'isomorphic-dompurify'

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
})

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = sanitizeObject(req.body)
  }
  if (req.query) {
    req.query = sanitizeObject(req.query)
  }
  if (req.params) {
    req.params = sanitizeObject(req.params)
  }
  next()
}

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj, { ALLOWED_TAGS: [] })
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key])
      }
    }
    return sanitized
  }
  
  return obj
}

// SQL injection prevention (additional validation)
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/i,
    /(\b(OR|AND)\b.*=.*)/i
  ]

  const checkString = (str: string): boolean => {
    return sqlPatterns.some(pattern => pattern.test(str))
  }

  const checkObject = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return checkString(obj)
    }
    
    if (Array.isArray(obj)) {
      return obj.some(checkObject)
    }
    
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkObject)
    }
    
    return false
  }

  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input detected'
    })
  }

  next()
}

// Request validation middleware
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    })
  }
  next()
}

// File upload security
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file && !req.files) {
    return next()
  }

  const allowedMimeTypes = [
    'application/json',
    'text/plain',
    'application/x-yaml',
    'text/yaml'
  ]

  const maxFileSize = 5 * 1024 * 1024 // 5MB

  const files = req.files ? (Array.isArray(req.files) ? req.files : [req.file]) : [req.file]

  for (const file of files) {
    if (!file) continue

    // Check file size
    if (file.size > maxFileSize) {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds limit (5MB)'
      })
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type'
      })
    }

    // Check for dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.sh']
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'))
    
    if (dangerousExtensions.includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        error: 'Dangerous file type detected'
      })
    }
  }

  next()
}

// API key validation for external integrations
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required'
    })
  }

  // In production, validate against database
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || []
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    })
  }

  next()
}

// Prevent NoSQL injection
export const preventNoSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeObj = (obj: any): any => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          // Remove MongoDB operators
          if (key.startsWith('$')) {
            delete obj[key]
          } else {
            sanitizeObj(obj[key])
          }
        }
      }
    }
    return obj
  }

  if (req.body) {
    req.body = sanitizeObj(req.body)
  }
  if (req.query) {
    req.query = sanitizeObj(req.query)
  }
  if (req.params) {
    req.params = sanitizeObj(req.params)
  }

  next()
}