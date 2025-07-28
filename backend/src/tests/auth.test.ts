import request from 'supertest'
import { app } from '../app'
import { PrismaClient } from '@prisma/client'
import { SecurityService } from '../services/security.service'

const prisma = new PrismaClient()
const securityService = new SecurityService()

describe('Authentication API', () => {
  beforeAll(async () => {
    // Setup test database
    await prisma.$connect()
  })

  afterAll(async () => {
    // Cleanup test database
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clear test data
    await prisma.user.deleteMany()
  })

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create test user
      const hashedPassword = await securityService.hashPassword('testpassword123')
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          name: 'Test User',
          role: 'USER'
        }
      })
    })

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.refreshToken).toBeDefined()
      expect(response.body.data.user.email).toBe('test@example.com')
    })

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'testpassword123'
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid credentials')
    })

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid credentials')
    })

    it('should validate input fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: ''
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('should rate limit login attempts', async () => {
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/v1/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrongpassword'
            })
        )
      }

      const responses = await Promise.all(promises)
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string

    beforeEach(async () => {
      // Create test user and get refresh token
      const hashedPassword = await securityService.hashPassword('testpassword123')
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          name: 'Test User',
          role: 'USER'
        }
      })

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })

      refreshToken = loginResponse.body.data.refreshToken
    })

    it('should refresh token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.accessToken).toBeDefined()
    })

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/auth/profile', () => {
    let accessToken: string

    beforeEach(async () => {
      // Create test user and get access token
      const hashedPassword = await securityService.hashPassword('testpassword123')
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          name: 'Test User',
          role: 'USER'
        }
      })

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })

      accessToken = loginResponse.body.data.accessToken
    })

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.email).toBe('test@example.com')
    })

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/v1/auth/logout', () => {
    let accessToken: string

    beforeEach(async () => {
      // Create test user and get access token
      const hashedPassword = await securityService.hashPassword('testpassword123')
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          name: 'Test User',
          role: 'USER'
        }
      })

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })

      accessToken = loginResponse.body.data.accessToken
    })

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })
})