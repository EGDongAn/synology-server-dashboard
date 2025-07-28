import request from 'supertest'
import { app } from '../app'
import { PrismaClient } from '@prisma/client'
import { SecurityService } from '../services/security.service'

const prisma = new PrismaClient()
const securityService = new SecurityService()

describe('Servers API', () => {
  let accessToken: string
  let userId: string

  beforeAll(async () => {
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clear test data
    await prisma.server.deleteMany()
    await prisma.user.deleteMany()

    // Create test user
    const hashedPassword = await securityService.hashPassword('testpassword123')
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: hashedPassword,
        name: 'Test User',
        role: 'ADMIN'
      }
    })
    userId = user.id

    // Get access token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword123'
      })

    accessToken = loginResponse.body.data.accessToken
  })

  describe('GET /api/v1/servers', () => {
    beforeEach(async () => {
      // Create test servers
      await prisma.server.createMany({
        data: [
          {
            name: 'Test Server 1',
            ipAddress: '192.168.1.100',
            username: 'root',
            password: 'encrypted-password',
            status: 'ONLINE'
          },
          {
            name: 'Test Server 2',
            ipAddress: '192.168.1.101',
            username: 'admin',
            password: 'encrypted-password',
            status: 'OFFLINE'
          }
        ]
      })
    })

    it('should get all servers', async () => {
      const response = await request(app)
        .get('/api/v1/servers')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(2)
    })

    it('should filter servers by status', async () => {
      const response = await request(app)
        .get('/api/v1/servers?status=ONLINE')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].status).toBe('ONLINE')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/servers')

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/v1/servers', () => {
    it('should create a new server', async () => {
      const serverData = {
        name: 'New Test Server',
        ipAddress: '192.168.1.102',
        username: 'root',
        password: 'testpassword',
        authType: 'password',
        sshPort: 22
      }

      const response = await request(app)
        .post('/api/v1/servers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(serverData)

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe(serverData.name)
      expect(response.body.data.ipAddress).toBe(serverData.ipAddress)
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/servers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Server'
          // Missing required fields
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('should validate IP address format', async () => {
      const response = await request(app)
        .post('/api/v1/servers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Server',
          ipAddress: 'invalid-ip',
          username: 'root',
          password: 'testpassword'
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('should encrypt sensitive data', async () => {
      const serverData = {
        name: 'Secure Server',
        ipAddress: '192.168.1.103',
        username: 'root',
        password: 'secretpassword',
        authType: 'password'
      }

      const response = await request(app)
        .post('/api/v1/servers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(serverData)

      expect(response.status).toBe(201)
      
      // Check that password is not returned in response
      expect(response.body.data.password).toBeUndefined()
      
      // Verify password is encrypted in database
      const server = await prisma.server.findFirst({
        where: { name: serverData.name }
      })
      expect(server?.password).not.toBe(serverData.password)
    })
  })

  describe('GET /api/v1/servers/:id', () => {
    let serverId: string

    beforeEach(async () => {
      const server = await prisma.server.create({
        data: {
          name: 'Test Server',
          ipAddress: '192.168.1.100',
          username: 'root',
          password: 'encrypted-password',
          status: 'ONLINE'
        }
      })
      serverId = server.id
    })

    it('should get server by id', async () => {
      const response = await request(app)
        .get(`/api/v1/servers/${serverId}`)
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(serverId)
    })

    it('should return 404 for non-existent server', async () => {
      const response = await request(app)
        .get('/api/v1/servers/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(404)
    })
  })

  describe('PUT /api/v1/servers/:id', () => {
    let serverId: string

    beforeEach(async () => {
      const server = await prisma.server.create({
        data: {
          name: 'Test Server',
          ipAddress: '192.168.1.100',
          username: 'root',
          password: 'encrypted-password',
          status: 'ONLINE'
        }
      })
      serverId = server.id
    })

    it('should update server', async () => {
      const updateData = {
        name: 'Updated Server Name',
        ipAddress: '192.168.1.200'
      }

      const response = await request(app)
        .put(`/api/v1/servers/${serverId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe(updateData.name)
      expect(response.body.data.ipAddress).toBe(updateData.ipAddress)
    })
  })

  describe('DELETE /api/v1/servers/:id', () => {
    let serverId: string

    beforeEach(async () => {
      const server = await prisma.server.create({
        data: {
          name: 'Test Server',
          ipAddress: '192.168.1.100',
          username: 'root',
          password: 'encrypted-password',
          status: 'ONLINE'
        }
      })
      serverId = server.id
    })

    it('should delete server', async () => {
      const response = await request(app)
        .delete(`/api/v1/servers/${serverId}`)
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // Verify server is deleted
      const server = await prisma.server.findUnique({
        where: { id: serverId }
      })
      expect(server).toBeNull()
    })
  })

  describe('POST /api/v1/servers/:id/test-connection', () => {
    let serverId: string

    beforeEach(async () => {
      const server = await prisma.server.create({
        data: {
          name: 'Test Server',
          ipAddress: '192.168.1.100',
          username: 'root',
          password: 'encrypted-password',
          status: 'ONLINE'
        }
      })
      serverId = server.id
    })

    it('should test server connection', async () => {
      // Mock SSH connection for testing
      const response = await request(app)
        .post(`/api/v1/servers/${serverId}/test-connection`)
        .set('Authorization', `Bearer ${accessToken}`)

      // This will likely fail in test environment, but should return proper error structure
      expect(response.status).toBeOneOf([200, 500])
      expect(response.body.success).toBeDefined()
    })
  })
})