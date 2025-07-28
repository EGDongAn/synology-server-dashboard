import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Simple API endpoint
app.get('/api/v1/test', (req, res) => {
  res.json({ message: 'Backend is running!', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📋 Health check: http://localhost:${PORT}/health`)
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/v1/test`)
})