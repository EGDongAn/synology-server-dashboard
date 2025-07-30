import { Router } from 'express'

const router = Router()

// Temporarily disabled monitoring routes due to dependency issues
router.all('*', (req, res) => {
  res.status(503).json({
    success: false,
    error: 'Monitoring service temporarily unavailable'
  })
})

export default router