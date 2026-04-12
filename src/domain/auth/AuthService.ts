/**
 * @domain auth
 * @routes POST /api/auth/register, /api/auth/verify-email, /api/auth/resend-verification, /api/auth/forgot-password, /api/auth/reset-password
 * @repository IAuthRepository
 * @consumers (auth)/register, login, verify-email, forgot-password, reset-password
 */

/**
 * AuthService - Domain service for Auth
 *
 * Contains business rules for registration, email verification,
 * resend verification, and password reset.
 * Uses Result pattern for explicit error handling.
 * Passwords are handled by Supabase Auth -- never stored in public.User.
 */
import { Result } from '@/domain/shared'
import type { IAuthRepository, AuthUser } from '@/infrastructure/persistence/auth/IAuthRepository'
import { PrismaAuthRepository } from '@/infrastructure/persistence/auth/PrismaAuthRepository'
import { randomBytes } from 'crypto'
import { sendEmailVerificationNotification, sendPasswordResetNotification } from '@/lib/email'
import { logger } from '@/lib/logger'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface SupabaseAdminAuth {
  createUser: (opts: {
    email: string
    password: string
    email_confirm: boolean
    user_metadata: Record<string, unknown>
  }) => Promise<{
    data: { user: { id: string } | null }
    error: { message: string; status?: number } | null
  }>
  deleteUser?: (userId: string) => Promise<unknown>
  updateUserById?: (userId: string, attributes: { password: string }) => Promise<{
    data: { user: { id: string } | null }
    error: { message: string } | null
  }>
}

export interface AuthServiceDeps {
  authRepository: IAuthRepository
  generateToken?: () => string
  emailService?: {
    sendVerification: (email: string, firstName: string, token: string) => Promise<unknown>
    sendPasswordReset?: (email: string, firstName: string, resetUrl: string) => Promise<unknown>
  }
  supabaseAdmin?: SupabaseAdminAuth
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

export interface RequestPasswordResetResult {
  sent: boolean
}

export interface ResetPasswordResult {
  email: string
}

// Error types
export type AuthErrorType =
  | 'EMAIL_ALREADY_EXISTS'
  | 'TOKEN_NOT_FOUND'
  | 'TOKEN_ALREADY_USED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_BLOCKED'
  | 'REGISTRATION_FAILED'

export interface AuthError {
  type: AuthErrorType
  message: string
}

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class AuthService {
  private readonly repo: IAuthRepository
  private readonly generateToken: () => string
  private readonly emailService?: AuthServiceDeps['emailService']
  private readonly supabaseAdmin?: SupabaseAdminAuth

  constructor(deps: AuthServiceDeps) {
    this.repo = deps.authRepository
    this.generateToken = deps.generateToken || (() => randomBytes(32).toString('hex'))
    this.emailService = deps.emailService
    this.supabaseAdmin = deps.supabaseAdmin
  }

  // -----------------------------------------------------------
  // register
  // -----------------------------------------------------------

  async register(input: RegisterInput): Promise<Result<RegisterResult, AuthError>> {
    // 1. Check for duplicate email in local DB
    const existing = await this.repo.findUserByEmail(input.email)
    if (existing) {
      // Ghost user upgrade: in-place upgrade instead of blocking registration
      if (existing.isManualCustomer) {
        return this.upgradeGhostUser(existing.id, input)
      }

      return Result.fail({
        type: 'EMAIL_ALREADY_EXISTS',
        message: 'En användare med denna email finns redan',
      })
    }

    // 2. Supabase is required for registration
    if (!this.supabaseAdmin) {
      logger.error('Supabase admin client not available for registration')
      return Result.fail({
        type: 'REGISTRATION_FAILED',
        message: 'Kunde inte skapa konto',
      })
    }

    return this.registerViaSupabase(input)
  }

  /**
   * Register via Supabase Auth admin API.
   * Supabase handles password hashing and email verification.
   * Sync trigger (handle_new_user) creates public.User automatically.
   */
  private async registerViaSupabase(input: RegisterInput): Promise<Result<RegisterResult, AuthError>> {
    // 1. Create user in Supabase Auth
    const { data, error } = await this.supabaseAdmin!.createUser({
      email: input.email,
      password: input.password,
      email_confirm: false,
      user_metadata: {
        firstName: input.firstName,
        lastName: input.lastName,
        ...(input.phone ? { phone: input.phone } : {}),
      },
    })

    if (error || !data.user) {
      // 422 = user already registered, map to EMAIL_ALREADY_EXISTS
      if (error?.status === 422) {
        return Result.fail({
          type: 'EMAIL_ALREADY_EXISTS',
          message: error.message,
        })
      }
      // Other Supabase errors (rate limit, service down, etc.)
      logger.error('Supabase createUser failed', { message: error?.message, status: error?.status })
      return Result.fail({
        type: 'REGISTRATION_FAILED',
        message: 'Kunde inte skapa konto',
      })
    }

    const supabaseUserId = data.user.id

    try {
      // 2. Ensure public.User exists (sync trigger creates it, but as fallback
      //    we create it here if the trigger hasn't fired yet)
      await this.repo.createUser({
        id: supabaseUserId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        userType: input.userType,
      }).catch((err: unknown) => {
        // P2002 = unique constraint -- expected when sync trigger already created the row
        const prismaCode = (err as { code?: string })?.code
        if (prismaCode === 'P2002') {
          logger.info('User already exists from sync trigger, skipping createUser', { id: supabaseUserId })
        } else {
          throw err // Re-throw non-P2002 errors to trigger rollback
        }
      })

      // 3. Create provider profile if applicable
      if (input.userType === 'provider' && input.businessName) {
        await this.repo.createProvider({
          userId: supabaseUserId,
          businessName: input.businessName,
          description: input.description,
          city: input.city,
        })
        // Sync trigger hardcodes 'customer', so update to 'provider' after provider creation
        await this.repo.updateUserType(supabaseUserId, 'provider')
      }
    } catch (err) {
      // Rollback: delete the Supabase user to avoid zombie accounts
      logger.error('Post-signup setup failed, rolling back Supabase user', { supabaseUserId })
      await this.supabaseAdmin!.deleteUser?.(supabaseUserId).catch((cleanupErr: unknown) => {
        logger.error('Failed to cleanup orphaned Supabase user', cleanupErr instanceof Error ? cleanupErr : new Error(String(cleanupErr)))
      })
      return Result.fail({
        type: 'REGISTRATION_FAILED',
        message: 'Kunde inte skapa konto',
      })
    }

    // 4. Return user info (no verification token, no email -- Supabase handles it)
    return Result.ok({
      user: {
        id: supabaseUserId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        userType: input.userType,
      },
    })
  }

  /**
   * Upgrade a ghost user (isManualCustomer=true) to a real account.
   * Creates a Supabase Auth user and updates the existing public.User row.
   */
  private async upgradeGhostUser(
    ghostUserId: string,
    input: RegisterInput
  ): Promise<Result<RegisterResult, AuthError>> {
    // 1. Create Supabase Auth user for the ghost user
    if (this.supabaseAdmin) {
      const { error } = await this.supabaseAdmin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: false,
        user_metadata: {
          firstName: input.firstName,
          lastName: input.lastName,
          ...(input.phone ? { phone: input.phone } : {}),
        },
      })

      if (error) {
        // 422 = user already exists in Supabase (e.g., was created via another path)
        if (error.status !== 422) {
          logger.error('Supabase createUser failed during ghost upgrade', { message: error.message })
          return Result.fail({
            type: 'REGISTRATION_FAILED',
            message: 'Kunde inte skapa konto',
          })
        }
      }
    }

    // 2. Upgrade in place (profile fields only, no password)
    const user = await this.repo.upgradeGhostUser({
      userId: ghostUserId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
    })

    // 3. Create verification token (for legacy email verification flow)
    const token = this.generateToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await this.repo.createVerificationToken({
      token,
      userId: ghostUserId,
      expiresAt,
    })

    // 4. Send verification email (fire-and-forget)
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
  // requestPasswordReset
  // -----------------------------------------------------------

  async requestPasswordReset(email: string): Promise<Result<RequestPasswordResetResult, AuthError>> {
    const user = await this.repo.findUserForResend(email)

    if (user) {
      // Invalidate any existing reset tokens
      await this.repo.invalidatePasswordResetTokens(user.id)

      // Create new token (1 hour expiry)
      const token = this.generateToken()
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

      await this.repo.createPasswordResetToken({
        token,
        userId: user.id,
        expiresAt,
      })

      // Send password reset email (fire-and-forget)
      if (this.emailService?.sendPasswordReset) {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        const resetUrl = `${baseUrl}/reset-password?token=${token}`
        this.emailService.sendPasswordReset(user.email, user.firstName, resetUrl).catch(() => {
          // Logged at infrastructure level
        })
      }

      return Result.ok({ sent: true })
    }

    // Always return success (enumeration prevention)
    return Result.ok({ sent: false })
  }

  // -----------------------------------------------------------
  // resetPassword
  // -----------------------------------------------------------

  async resetPassword(token: string, newPassword: string): Promise<Result<ResetPasswordResult, AuthError>> {
    // 1. Find token
    const resetToken = await this.repo.findPasswordResetToken(token)
    if (!resetToken) {
      return Result.fail({
        type: 'TOKEN_NOT_FOUND',
        message: 'Ogiltig eller utgången återställningslänk',
      })
    }

    // 2. Check if already used
    if (resetToken.usedAt) {
      return Result.fail({
        type: 'TOKEN_ALREADY_USED',
        message: 'Denna återställningslänk har redan använts',
      })
    }

    // 3. Check if expired
    if (new Date() > resetToken.expiresAt) {
      return Result.fail({
        type: 'TOKEN_EXPIRED',
        message: 'Återställningslänken har gått ut. Begär en ny.',
      })
    }

    // 4. Update password via Supabase Auth admin API
    if (this.supabaseAdmin?.updateUserById) {
      const { error } = await this.supabaseAdmin.updateUserById(resetToken.userId, {
        password: newPassword,
      })
      if (error) {
        logger.error('Supabase updateUserById failed during password reset', { message: error.message })
        return Result.fail({
          type: 'REGISTRATION_FAILED',
          message: 'Kunde inte uppdatera lösenordet',
        })
      }
    }

    // 5. Mark token as used
    await this.repo.markResetTokenUsed(resetToken.id)

    return Result.ok({ email: resetToken.userEmail })
  }
}

// -----------------------------------------------------------
// Factory
// -----------------------------------------------------------

export function createAuthService(): AuthService {
  // Try to create Supabase admin client for registrations and password management.
  // Dynamic import: admin.ts has 'import "server-only"' which throws in test env.
  // DI via constructor handles testability; this factory is only called at runtime.
  let supabaseAdmin: SupabaseAdminAuth | undefined
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createSupabaseAdminClient } = require('@/lib/supabase/admin')
    const client = createSupabaseAdminClient()
    supabaseAdmin = {
      createUser: async (opts) => client.auth.admin.createUser(opts),
      deleteUser: async (userId) => client.auth.admin.deleteUser(userId),
      updateUserById: async (userId, attrs) => client.auth.admin.updateUserById(userId, attrs),
    }
  } catch {
    logger.warn('Supabase admin client not available')
  }

  return new AuthService({
    authRepository: new PrismaAuthRepository(),
    emailService: {
      sendVerification: sendEmailVerificationNotification,
      sendPasswordReset: sendPasswordResetNotification,
    },
    supabaseAdmin,
  })
}
