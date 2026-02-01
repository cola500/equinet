/**
 * AuthService - Domain service for Auth
 *
 * Contains business rules for registration, email verification,
 * resend verification, and credential verification.
 * Uses Result pattern for explicit error handling.
 */
import { Result } from '@/domain/shared'
import type { IAuthRepository, AuthUser } from '@/infrastructure/persistence/auth/IAuthRepository'
import { PrismaAuthRepository } from '@/infrastructure/persistence/auth/PrismaAuthRepository'
import bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { sendEmailVerificationNotification } from '@/lib/email'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface AuthServiceDeps {
  authRepository: IAuthRepository
  hashPassword: (password: string) => Promise<string>
  comparePassword: (password: string, hash: string) => Promise<boolean>
  generateToken?: () => string
  emailService?: {
    sendVerification: (email: string, firstName: string, token: string) => Promise<unknown>
  }
}

export interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  userType: string
  businessName?: string
  description?: string
  city?: string
}

export interface RegisterResult {
  user: AuthUser
}

export interface VerifyEmailResult {
  email: string
}

export interface ResendResult {
  sent: boolean
}

export interface VerifyCredentialsResult {
  id: string
  email: string
  name: string
  userType: string
  providerId: string | null
}

// Error types
export type AuthErrorType =
  | 'EMAIL_ALREADY_EXISTS'
  | 'TOKEN_NOT_FOUND'
  | 'TOKEN_ALREADY_USED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'

export interface AuthError {
  type: AuthErrorType
  message: string
}

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class AuthService {
  private readonly repo: IAuthRepository
  private readonly hashPassword: AuthServiceDeps['hashPassword']
  private readonly comparePassword: AuthServiceDeps['comparePassword']
  private readonly generateToken: () => string
  private readonly emailService?: AuthServiceDeps['emailService']

  constructor(deps: AuthServiceDeps) {
    this.repo = deps.authRepository
    this.hashPassword = deps.hashPassword
    this.comparePassword = deps.comparePassword
    this.generateToken = deps.generateToken || (() => randomBytes(32).toString('hex'))
    this.emailService = deps.emailService
  }

  // -----------------------------------------------------------
  // register
  // -----------------------------------------------------------

  async register(input: RegisterInput): Promise<Result<RegisterResult, AuthError>> {
    // 1. Check for duplicate email
    const existing = await this.repo.findUserByEmail(input.email)
    if (existing) {
      return Result.fail({
        type: 'EMAIL_ALREADY_EXISTS',
        message: 'En anvandare med denna email finns redan',
      })
    }

    // 2. Hash password
    const passwordHash = await this.hashPassword(input.password)

    // 3. Create user
    const user = await this.repo.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      userType: input.userType,
    })

    // 4. Create provider profile if applicable
    if (input.userType === 'provider' && input.businessName) {
      await this.repo.createProvider({
        userId: user.id,
        businessName: input.businessName,
        description: input.description,
        city: input.city,
      })
    }

    // 5. Create verification token
    const token = this.generateToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await this.repo.createVerificationToken({
      token,
      userId: user.id,
      expiresAt,
    })

    // 6. Send verification email (fire-and-forget)
    if (this.emailService) {
      this.emailService.sendVerification(input.email, input.firstName, token).catch(() => {
        // Logged at infrastructure level
      })
    }

    return Result.ok({ user })
  }

  // -----------------------------------------------------------
  // verifyEmail
  // -----------------------------------------------------------

  async verifyEmail(token: string): Promise<Result<VerifyEmailResult, AuthError>> {
    // 1. Find token
    const verificationToken = await this.repo.findVerificationToken(token)
    if (!verificationToken) {
      return Result.fail({
        type: 'TOKEN_NOT_FOUND',
        message: 'Ogiltig eller utgangen verifieringslank',
      })
    }

    // 2. Check if already used
    if (verificationToken.usedAt) {
      return Result.fail({
        type: 'TOKEN_ALREADY_USED',
        message: 'Denna verifieringslank har redan anvants',
      })
    }

    // 3. Check if expired
    if (new Date() > verificationToken.expiresAt) {
      return Result.fail({
        type: 'TOKEN_EXPIRED',
        message: 'Verifieringslanken har gatt ut. Begar en ny.',
      })
    }

    // 4. Atomic verify (user + token)
    await this.repo.verifyEmail(verificationToken.userId, verificationToken.id)

    return Result.ok({ email: verificationToken.userEmail })
  }

  // -----------------------------------------------------------
  // resendVerification
  // -----------------------------------------------------------

  async resendVerification(email: string): Promise<Result<ResendResult, AuthError>> {
    const user = await this.repo.findUserForResend(email)

    // Only send if user exists AND not verified
    if (user && !user.emailVerified) {
      const token = this.generateToken()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      await this.repo.createVerificationToken({
        token,
        userId: user.id,
        expiresAt,
      })

      if (this.emailService) {
        this.emailService.sendVerification(user.email, user.firstName, token).catch(() => {
          // Logged at infrastructure level
        })
      }

      return Result.ok({ sent: true })
    }

    // Always return success (enumeration prevention)
    return Result.ok({ sent: false })
  }

  // -----------------------------------------------------------
  // verifyCredentials
  // -----------------------------------------------------------

  async verifyCredentials(
    email: string,
    password: string
  ): Promise<Result<VerifyCredentialsResult, AuthError>> {
    // 1. Find user with credentials
    const user = await this.repo.findUserWithCredentials(email)
    if (!user) {
      return Result.fail({
        type: 'INVALID_CREDENTIALS',
        message: 'Ogiltig email eller lösenord',
      })
    }

    // 2. Verify password
    const isValid = await this.comparePassword(password, user.passwordHash)
    if (!isValid) {
      return Result.fail({
        type: 'INVALID_CREDENTIALS',
        message: 'Ogiltig email eller lösenord',
      })
    }

    // 3. Check email verification
    if (!user.emailVerified) {
      return Result.fail({
        type: 'EMAIL_NOT_VERIFIED',
        message: 'EMAIL_NOT_VERIFIED',
      })
    }

    // 4. Return safe user info
    return Result.ok({
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      userType: user.userType,
      providerId: user.provider?.id || null,
    })
  }
}

// -----------------------------------------------------------
// Factory
// -----------------------------------------------------------

export function createAuthService(): AuthService {
  return new AuthService({
    authRepository: new PrismaAuthRepository(),
    hashPassword: (pw) => bcrypt.hash(pw, 10),
    comparePassword: (pw, hash) => bcrypt.compare(pw, hash),
    emailService: {
      sendVerification: sendEmailVerificationNotification,
    },
  })
}
