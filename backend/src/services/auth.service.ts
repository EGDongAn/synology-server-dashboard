import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { config } from '../config'

const prisma = new PrismaClient()

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    role: string
  }
}

export class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const { email, password } = credentials

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) {
      throw new Error('Invalid credentials')
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      throw new Error('Invalid credentials')
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id)
    const refreshToken = this.generateRefreshToken(user.id)

    // Store refresh token in database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    })

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any
      
      // Find user with matching refresh token
      const user = await prisma.user.findFirst({
        where: {
          id: decoded.userId,
          refreshToken
        }
      })

      if (!user) {
        throw new Error('Invalid refresh token')
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user.id)

      return { accessToken }
    } catch (error) {
      throw new Error('Invalid refresh token')
    }
  }

  async logout(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null }
    })
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect')
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    // Update password and invalidate refresh token
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        refreshToken: null
      }
    })
  }

  async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    return user
  }

  private generateAccessToken(userId: string): string {
    return jwt.sign(
      { userId },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    )
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    )
  }

  async validateToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any
      return { valid: true, userId: decoded.userId }
    } catch (error) {
      return { valid: false }
    }
  }
}