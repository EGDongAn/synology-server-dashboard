import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Add custom Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R
    }
  }
}

expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received)
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      }
    }
  },
})

beforeAll(async () => {
  // Setup test database connection
  await prisma.$connect()
})

afterAll(async () => {
  // Clean up database connection
  await prisma.$disconnect()
})

// Global test configuration
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret'
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.DATABASE_URL = 'file:./test.db'