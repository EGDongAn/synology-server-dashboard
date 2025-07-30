import { Request, Response, NextFunction } from 'express'
import { AppError } from './error.middleware'

export const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Simple validation middleware
      // TODO: Implement proper validation logic based on schema
      next()
    } catch (error) {
      next(new AppError('Validation error', 400))
    }
  }
}
