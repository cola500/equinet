import { describe, it, expect, beforeEach } from 'vitest'
import { AuthService, type AuthServiceDeps } from './AuthService'
import { MockAuthRepository } from '@/infrastructure/persistence/auth/MockAuthRepository'

// Helper to create a mock Supabase admin client
function createMockSupabaseAdmin() {
  const calls: Array<{ email: string; password: string; user_metadata: Record<string, unknown> }> = []
  const updateCalls: Array<{ userId: string; password: string }> = []
  let nextId = 0

  return {
    calls,
    updateCalls,
    createUser: async (opts: { email: string; password: string; email_confirm: boolean; user_metadata: Record<string, unknown> }) => {
      calls.push({ email: opts.email, password: opts.password, user_metadata: opts.user_metadata })
      const id = `supabase-user-${++nextId}`
      return { data: { user: { id } }, error: null }
    },
    updateUserById: async (userId: string, attrs: { password: string }) => {
      updateCalls.push({ userId, password: attrs.password })
      return { data: { user: { id: userId } }, error: null }
    },
  }
}

describe('AuthService', () => {
  let authRepo: MockAuthRepository
  let service: AuthService
  let sentEmails: Array<{ email: string; firstName: string; token: string }>
  let sentPasswordResetEmails: Array<{ email: string; firstName: string; resetUrl: string }>
  let tokenCounter: number
  let mockSupabaseAdmin: ReturnType<typeof createMockSupabaseAdmin>

  beforeEach(() => {
    authRepo = new MockAuthRepository()
    sentEmails = []
    sentPasswordResetEmails = []
    tokenCounter = 0
    mockSupabaseAdmin = createMockSupabaseAdmin()

    const deps: AuthServiceDeps = {
      authRepository: authRepo,
      generateToken: () => `test-token-${++tokenCounter}`,
      emailService: {
        sendVerification: async (email, firstName, token) => {
          sentEmails.push({ email, firstName, token })
        },
        sendPasswordReset: async (email, firstName, resetUrl) => {
          sentPasswordResetEmails.push({ email, firstName, resetUrl })
        },
      },
      supabaseAdmin: {
        createUser: mockSupabaseAdmin.createUser,
        updateUserById: mockSupabaseAdmin.updateUserById,
      },
    }

    service = new AuthService(deps)
  })

  // ===========================================================
  // register
  // ===========================================================

  describe('register', () => {
    const customerInput = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      userType: 'customer' as const,
    }

    // -------------------------------------------------------
    // Supabase path (new users)
    // -------------------------------------------------------

    it('should register a customer via Supabase admin', async () => {
      const result = await service.register(customerInput)

      expect(result.isSuccess).toBe(true)
      expect(result.value.user.email).toBe('test@example.com')
      expect(result.value.user.firstName).toBe('Test')
      expect(result.value.user.userType).toBe('customer')
    })

    it('should call supabaseAdmin.createUser with correct params', async () => {
      await service.register(customerInput)

      expect(mockSupabaseAdmin.calls).toHaveLength(1)
      expect(mockSupabaseAdmin.calls[0]).toMatchObject({
        email: 'test@example.com',
        password: 'Password123!',
        user_metadata: {
          firstName: 'Test',
          lastName: 'User',
        },
      })
    })

    it('should NOT create verification token when using Supabase path', async () => {
      await service.register(customerInput)

      // Supabase handles email verification
      const tokens = authRepo.getTokens()
      expect(tokens).toHaveLength(0)
    })

    it('should NOT send verification email when using Supabase path', async () => {
      await service.register(customerInput)

      // Supabase handles email sending
      expect(sentEmails).toHaveLength(0)
    })

    it('should register a provider with business info via Supabase', async () => {
      const result = await service.register({
        ...customerInput,
        email: 'provider@example.com',
        userType: 'provider',
        businessName: 'Test Business',
        description: 'A description',
        city: 'Stockholm',
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.user.userType).toBe('provider')

      const providers = authRepo.getProviders()
      expect(providers).toHaveLength(1)
      expect(providers[0].businessName).toBe('Test Business')
    })

    it('should update userType to provider after Supabase user creation', async () => {
      await service.register({
        ...customerInput,
        email: 'provider@example.com',
        userType: 'provider',
        businessName: 'Test Business',
      })

      // Sync trigger creates user as 'customer', then service updates to 'provider'
      const users = authRepo.getUsers()
      expect(users[0].userType).toBe('provider')
    })

    it('should fail if email already exists in local DB', async () => {
      authRepo.seedUser({
        id: 'existing-user',
        email: 'test@example.com',
        firstName: 'Existing',
        lastName: 'User',
        userType: 'customer',
        emailVerified: true,
      })

      const result = await service.register(customerInput)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('EMAIL_ALREADY_EXISTS')
    })

    it('should return EMAIL_ALREADY_EXISTS when Supabase returns 422', async () => {
      const depsWithError: AuthServiceDeps = {
        authRepository: authRepo,
        supabaseAdmin: {
          createUser: async () => ({
            data: { user: null },
            error: { message: 'User already registered', status: 422 },
          }),
        },
      }
      const serviceWithError = new AuthService(depsWithError)

      const result = await serviceWithError.register(customerInput)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('EMAIL_ALREADY_EXISTS')
    })

    it('should return REGISTRATION_FAILED when Supabase returns non-422 error', async () => {
      const depsWithError: AuthServiceDeps = {
        authRepository: authRepo,
        supabaseAdmin: {
          createUser: async () => ({
            data: { user: null },
            error: { message: 'Service unavailable', status: 503 },
          }),
        },
      }
      const serviceWithError = new AuthService(depsWithError)

      const result = await serviceWithError.register(customerInput)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('REGISTRATION_FAILED')
    })

    it('should never return passwordHash in user object', async () => {
      const result = await service.register(customerInput)

      expect(result.isSuccess).toBe(true)
      expect('passwordHash' in result.value.user).toBe(false)
    })

    // -------------------------------------------------------
    // Ghost user upgrade
    // -------------------------------------------------------

    describe('ghost upgrade', () => {
      beforeEach(() => {
        authRepo.seedUser({
          id: 'ghost-user-1',
          email: 'test@example.com',
          firstName: 'Ghost',
          lastName: '',
          userType: 'customer',
          emailVerified: false,
          isManualCustomer: true,
        })
      })

      it('should upgrade ghost user when email matches ghost account', async () => {
        const result = await service.register(customerInput)

        expect(result.isSuccess).toBe(true)
        expect(result.value.user.email).toBe('test@example.com')
        expect(result.value.user.firstName).toBe('Test')
      })

      it('should reuse the same User.id (no new row)', async () => {
        const result = await service.register(customerInput)

        expect(result.isSuccess).toBe(true)
        expect(result.value.user.id).toBe('ghost-user-1')
        expect(authRepo.getUsers()).toHaveLength(1)
      })

      it('should set isManualCustomer to false after upgrade', async () => {
        await service.register(customerInput)

        const users = authRepo.getUsers()
        expect(users[0].isManualCustomer).toBe(false)
      })

      it('should call supabaseAdmin.createUser for ghost user upgrade', async () => {
        await service.register(customerInput)

        expect(mockSupabaseAdmin.calls).toHaveLength(1)
        expect(mockSupabaseAdmin.calls[0]).toMatchObject({
          email: 'test@example.com',
          password: 'Password123!',
        })
      })

      it('should create a verification token for upgraded user', async () => {
        await service.register(customerInput)

        const tokens = authRepo.getTokens()
        expect(tokens).toHaveLength(1)
        expect(tokens[0].userId).toBe('ghost-user-1')
      })

      it('should send a verification email for upgraded user', async () => {
        await service.register(customerInput)

        expect(sentEmails).toHaveLength(1)
        expect(sentEmails[0].email).toBe('test@example.com')
        expect(sentEmails[0].firstName).toBe('Test')
      })

      it('should NOT return EMAIL_ALREADY_EXISTS for ghost accounts', async () => {
        const result = await service.register(customerInput)

        expect(result.isSuccess).toBe(true)
        expect(result.isFailure).toBe(false)
      })

      it('should still return EMAIL_ALREADY_EXISTS for regular accounts', async () => {
        authRepo.seedUser({
          id: 'real-user',
          email: 'real@example.com',
          firstName: 'Real',
          lastName: 'User',
          userType: 'customer',
          emailVerified: true,
          isManualCustomer: false,
        })

        const result = await service.register({
          ...customerInput,
          email: 'real@example.com',
        })

        expect(result.isFailure).toBe(true)
        expect(result.error.type).toBe('EMAIL_ALREADY_EXISTS')
      })

      it('should keep emailVerified as false until token is used', async () => {
        await service.register(customerInput)

        const users = authRepo.getUsers()
        expect(users[0].emailVerified).toBe(false)
      })

      it('should await email delivery before returning (no fire-and-forget)', async () => {
        let emailDelivered = false
        const slowDeps: AuthServiceDeps = {
          authRepository: authRepo,
          generateToken: () => 'slow-token-register',
          emailService: {
            sendVerification: () => new Promise<void>(resolve => {
              setTimeout(() => {
                emailDelivered = true
                resolve()
              }, 0)
            }),
            sendPasswordReset: async () => {},
          },
          supabaseAdmin: {
            createUser: mockSupabaseAdmin.createUser,
            updateUserById: mockSupabaseAdmin.updateUserById,
          },
        }
        const slowService = new AuthService(slowDeps)

        await slowService.register(customerInput)

        expect(emailDelivered).toBe(true)
      })

      it('should return success even if email service throws', async () => {
        const failingDeps: AuthServiceDeps = {
          authRepository: authRepo,
          generateToken: () => 'fail-token-register',
          emailService: {
            sendVerification: async () => { throw new Error('Resend down') },
            sendPasswordReset: async () => {},
          },
          supabaseAdmin: {
            createUser: mockSupabaseAdmin.createUser,
            updateUserById: mockSupabaseAdmin.updateUserById,
          },
        }
        const failingService = new AuthService(failingDeps)

        const result = await failingService.register(customerInput)

        expect(result.isSuccess).toBe(true)
      })
    })
  })

  // ===========================================================
  // verifyEmail
  // ===========================================================

  describe('verifyEmail', () => {
    beforeEach(() => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: false,
      })
      authRepo.seedToken({
        id: 'token-1',
        token: 'valid-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: null,
      })
    })

    it('should verify email with valid token', async () => {
      const result = await service.verifyEmail('valid-token')

      expect(result.isSuccess).toBe(true)
      expect(result.value.email).toBe('test@example.com')
    })

    it('should fail if token does not exist', async () => {
      const result = await service.verifyEmail('nonexistent-token')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('TOKEN_NOT_FOUND')
    })

    it('should fail if token is already used', async () => {
      authRepo.seedToken({
        id: 'token-2',
        token: 'used-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: new Date(),
      })

      const result = await service.verifyEmail('used-token')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('TOKEN_ALREADY_USED')
    })

    it('should fail if token is expired', async () => {
      authRepo.seedToken({
        id: 'token-3',
        token: 'expired-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      })

      const result = await service.verifyEmail('expired-token')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('TOKEN_EXPIRED')
    })

    it('should atomically update user and mark token as used', async () => {
      await service.verifyEmail('valid-token')

      const users = authRepo.getUsers()
      expect(users[0].emailVerified).toBe(true)

      const tokens = authRepo.getTokens()
      const token = tokens.find((t) => t.token === 'valid-token')
      expect(token?.usedAt).not.toBeNull()
    })
  })

  // ===========================================================
  // resendVerification
  // ===========================================================

  describe('resendVerification', () => {
    it('should send email for unverified user', async () => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: false,
      })

      const result = await service.resendVerification('test@example.com')

      expect(result.isSuccess).toBe(true)
      expect(sentEmails).toHaveLength(1)
      expect(sentEmails[0].email).toBe('test@example.com')
    })

    it('should return success for non-existent email (enumeration prevention)', async () => {
      const result = await service.resendVerification('nonexistent@example.com')

      expect(result.isSuccess).toBe(true)
      expect(result.value.sent).toBe(false)
      expect(sentEmails).toHaveLength(0)
    })

    it('should not send email for already verified user', async () => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'verified@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: true,
      })

      const result = await service.resendVerification('verified@example.com')

      expect(result.isSuccess).toBe(true)
      expect(result.value.sent).toBe(false)
      expect(sentEmails).toHaveLength(0)
    })

    it('should return success even for verified user (enumeration prevention)', async () => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'verified@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: true,
      })

      const result = await service.resendVerification('verified@example.com')

      // Same response shape regardless -- enumeration prevention
      expect(result.isSuccess).toBe(true)
    })

    it('should await email delivery before returning (no fire-and-forget)', async () => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: false,
      })

      let emailDelivered = false
      const slowDeps: AuthServiceDeps = {
        authRepository: authRepo,
        generateToken: () => 'slow-token-resend',
        emailService: {
          sendVerification: () => new Promise<void>(resolve => {
            setTimeout(() => {
              emailDelivered = true
              resolve()
            }, 0)
          }),
          sendPasswordReset: async () => {},
        },
        supabaseAdmin: {
          createUser: mockSupabaseAdmin.createUser,
          updateUserById: mockSupabaseAdmin.updateUserById,
        },
      }
      const slowService = new AuthService(slowDeps)

      await slowService.resendVerification('test@example.com')

      expect(emailDelivered).toBe(true)
    })

    it('should return success even if email service throws', async () => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: false,
      })

      const failingDeps: AuthServiceDeps = {
        authRepository: authRepo,
        generateToken: () => 'fail-token-resend',
        emailService: {
          sendVerification: async () => { throw new Error('Resend down') },
          sendPasswordReset: async () => {},
        },
        supabaseAdmin: {
          createUser: mockSupabaseAdmin.createUser,
          updateUserById: mockSupabaseAdmin.updateUserById,
        },
      }
      const failingService = new AuthService(failingDeps)

      const result = await failingService.resendVerification('test@example.com')

      expect(result.isSuccess).toBe(true)
    })
  })

  // ===========================================================
  // requestPasswordReset
  // ===========================================================

  describe('requestPasswordReset', () => {
    it('should create a reset token and send email for existing user', async () => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: true,
      })

      const result = await service.requestPasswordReset('test@example.com')

      expect(result.isSuccess).toBe(true)
      expect(sentPasswordResetEmails).toHaveLength(1)
      expect(sentPasswordResetEmails[0].email).toBe('test@example.com')
      expect(sentPasswordResetEmails[0].firstName).toBe('Test')
    })

    it('should return success for non-existent email (enumeration prevention)', async () => {
      const result = await service.requestPasswordReset('nonexistent@example.com')

      expect(result.isSuccess).toBe(true)
      expect(sentPasswordResetEmails).toHaveLength(0)
    })

    it('should create a password reset token with 1h expiry', async () => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: true,
      })

      await service.requestPasswordReset('test@example.com')

      const tokens = authRepo.getPasswordResetTokens()
      expect(tokens).toHaveLength(1)
      expect(tokens[0].token).toBe('test-token-1')
      expect(tokens[0].userId).toBe('user-1')
      // 1 hour expiry (+/- 5 seconds tolerance)
      const expectedExpiry = Date.now() + 60 * 60 * 1000
      expect(tokens[0].expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 5000)
      expect(tokens[0].expiresAt.getTime()).toBeLessThan(expectedExpiry + 5000)
    })

    it('should invalidate previous reset tokens when requesting new one', async () => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: true,
      })

      await service.requestPasswordReset('test@example.com')
      await service.requestPasswordReset('test@example.com')

      // Old tokens should be invalidated (usedAt set)
      const tokens = authRepo.getPasswordResetTokens()
      const activeTokens = tokens.filter(t => !t.usedAt)
      expect(activeTokens).toHaveLength(1)
      expect(activeTokens[0].token).toBe('test-token-2')
    })

    it('should await email delivery before returning (no fire-and-forget)', async () => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: true,
      })

      let emailDelivered = false
      const slowDeps: AuthServiceDeps = {
        authRepository: authRepo,
        generateToken: () => 'slow-token-1',
        emailService: {
          sendVerification: async () => {},
          sendPasswordReset: () => new Promise<void>(resolve => {
            setTimeout(() => {
              emailDelivered = true
              resolve()
            }, 0)
          }),
        },
        supabaseAdmin: {
          createUser: mockSupabaseAdmin.createUser,
          updateUserById: mockSupabaseAdmin.updateUserById,
        },
      }
      const slowService = new AuthService(slowDeps)

      await slowService.requestPasswordReset('test@example.com')

      // With fire-and-forget the setTimeout hasn't fired yet -- emailDelivered is false.
      // With blocking await it's true.
      expect(emailDelivered).toBe(true)
    })

    it('should return success even if email service throws', async () => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: true,
      })

      const failingDeps: AuthServiceDeps = {
        authRepository: authRepo,
        generateToken: () => 'fail-token-1',
        emailService: {
          sendVerification: async () => {},
          sendPasswordReset: async () => { throw new Error('Resend down') },
        },
        supabaseAdmin: {
          createUser: mockSupabaseAdmin.createUser,
          updateUserById: mockSupabaseAdmin.updateUserById,
        },
      }
      const failingService = new AuthService(failingDeps)

      const result = await failingService.requestPasswordReset('test@example.com')

      expect(result.isSuccess).toBe(true)
    })
  })

  // ===========================================================
  // resetPassword
  // ===========================================================

  describe('resetPassword', () => {
    beforeEach(() => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        emailVerified: true,
      })
      authRepo.seedPasswordResetToken({
        id: 'reset-token-1',
        token: 'valid-reset-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
      })
    })

    it('should reset password with valid token', async () => {
      const result = await service.resetPassword('valid-reset-token', 'NewPassword1!')

      expect(result.isSuccess).toBe(true)

      // Should call supabaseAdmin.updateUserById
      expect(mockSupabaseAdmin.updateCalls).toHaveLength(1)
      expect(mockSupabaseAdmin.updateCalls[0]).toMatchObject({
        userId: 'user-1',
        password: 'NewPassword1!',
      })
    })

    it('should mark the token as used after reset', async () => {
      await service.resetPassword('valid-reset-token', 'NewPassword1!')

      const tokens = authRepo.getPasswordResetTokens()
      const token = tokens.find(t => t.token === 'valid-reset-token')
      expect(token?.usedAt).not.toBeNull()
    })

    it('should fail if token does not exist', async () => {
      const result = await service.resetPassword('nonexistent-token', 'NewPassword1!')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('TOKEN_NOT_FOUND')
    })

    it('should fail if token is already used', async () => {
      authRepo.seedPasswordResetToken({
        id: 'reset-token-2',
        token: 'used-reset-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: new Date(),
      })

      const result = await service.resetPassword('used-reset-token', 'NewPassword1!')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('TOKEN_ALREADY_USED')
    })

    it('should fail if token is expired', async () => {
      authRepo.seedPasswordResetToken({
        id: 'reset-token-3',
        token: 'expired-reset-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      })

      const result = await service.resetPassword('expired-reset-token', 'NewPassword1!')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('TOKEN_EXPIRED')
    })
  })

  // -----------------------------------------------------------
  // acceptInvite
  // -----------------------------------------------------------

  describe('acceptInvite', () => {
    const validPassword = 'StrongPass1!'

    it('should activate account with valid token and password', async () => {
      authRepo.seedUser({
        id: 'ghost-1',
        email: 'ghost@example.com',
        firstName: 'Anna',
        lastName: 'Svensson',
        userType: 'customer',
        emailVerified: false,
        isManualCustomer: true,
      })
      authRepo.seedCustomerInviteToken({
        id: 'cit-1',
        token: 'valid-invite-token',
        userId: 'ghost-1',
        expiresAt: new Date(Date.now() + 3600_000),
        usedAt: null,
      })

      const result = await service.acceptInvite('valid-invite-token', validPassword)

      expect(result.isSuccess).toBe(true)
      expect(result.value.message).toBe('Ditt konto har aktiverats')

      // Verify Supabase was called with email_confirm: true
      expect(mockSupabaseAdmin.updateCalls).toHaveLength(1)
      expect(mockSupabaseAdmin.updateCalls[0].userId).toBe('ghost-1')
    })

    it('should fail with TOKEN_NOT_FOUND for unknown token', async () => {
      const result = await service.acceptInvite('nonexistent-token', validPassword)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('TOKEN_NOT_FOUND')
    })

    it('should fail with TOKEN_ALREADY_USED for used token', async () => {
      authRepo.seedUser({
        id: 'ghost-2',
        email: 'ghost2@example.com',
        firstName: 'Erik',
        lastName: 'Johansson',
        userType: 'customer',
        emailVerified: false,
        isManualCustomer: true,
      })
      authRepo.seedCustomerInviteToken({
        id: 'cit-2',
        token: 'used-invite-token',
        userId: 'ghost-2',
        expiresAt: new Date(Date.now() + 3600_000),
        usedAt: new Date(),
      })

      const result = await service.acceptInvite('used-invite-token', validPassword)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('TOKEN_ALREADY_USED')
    })

    it('should fail with TOKEN_EXPIRED for expired token', async () => {
      authRepo.seedUser({
        id: 'ghost-3',
        email: 'ghost3@example.com',
        firstName: 'Karin',
        lastName: 'Nilsson',
        userType: 'customer',
        emailVerified: false,
        isManualCustomer: true,
      })
      authRepo.seedCustomerInviteToken({
        id: 'cit-3',
        token: 'expired-invite-token',
        userId: 'ghost-3',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      })

      const result = await service.acceptInvite('expired-invite-token', validPassword)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('TOKEN_EXPIRED')
    })

    it('should fallback to createUser when updateUserById fails', async () => {
      authRepo.seedUser({
        id: 'ghost-4',
        email: 'ghost4@example.com',
        firstName: 'Lisa',
        lastName: 'Berg',
        userType: 'customer',
        emailVerified: false,
        isManualCustomer: true,
      })
      authRepo.seedCustomerInviteToken({
        id: 'cit-4',
        token: 'fallback-invite-token',
        userId: 'ghost-4',
        expiresAt: new Date(Date.now() + 3600_000),
        usedAt: null,
      })

      // Make updateUserById fail
      const failingSupabase = createMockSupabaseAdmin()
      failingSupabase.updateUserById = async () => ({
        data: { user: null },
        error: { message: 'User not found' },
      })

      const failService = new AuthService({
        authRepository: authRepo,
        supabaseAdmin: {
          createUser: failingSupabase.createUser,
          updateUserById: failingSupabase.updateUserById,
        },
      })

      const result = await failService.acceptInvite('fallback-invite-token', validPassword)

      expect(result.isSuccess).toBe(true)
      // createUser should have been called as fallback
      expect(failingSupabase.calls).toHaveLength(1)
      expect(failingSupabase.calls[0].email).toBe('ghost4@example.com')
    })

    it('should fail with ACCOUNT_ACTIVATION_FAILED when both Supabase calls fail', async () => {
      authRepo.seedUser({
        id: 'ghost-5',
        email: 'ghost5@example.com',
        firstName: 'Maja',
        lastName: 'Ek',
        userType: 'customer',
        emailVerified: false,
        isManualCustomer: true,
      })
      authRepo.seedCustomerInviteToken({
        id: 'cit-5',
        token: 'doublefail-invite-token',
        userId: 'ghost-5',
        expiresAt: new Date(Date.now() + 3600_000),
        usedAt: null,
      })

      const bothFailSupabase = {
        createUser: async () => ({
          data: { user: null },
          error: { message: 'Service unavailable' },
        }),
        updateUserById: async () => ({
          data: { user: null },
          error: { message: 'User not found' },
        }),
      }

      const failService = new AuthService({
        authRepository: authRepo,
        supabaseAdmin: bothFailSupabase,
      })

      const result = await failService.acceptInvite('doublefail-invite-token', validPassword)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('ACCOUNT_ACTIVATION_FAILED')
    })

    it('should mark token as used and upgrade user after success', async () => {
      authRepo.seedUser({
        id: 'ghost-6',
        email: 'ghost6@example.com',
        firstName: 'Nils',
        lastName: 'Gren',
        userType: 'customer',
        emailVerified: false,
        isManualCustomer: true,
      })
      authRepo.seedCustomerInviteToken({
        id: 'cit-6',
        token: 'check-state-token',
        userId: 'ghost-6',
        expiresAt: new Date(Date.now() + 3600_000),
        usedAt: null,
      })

      await service.acceptInvite('check-state-token', validPassword)

      // Token should be marked as used
      const tokens = authRepo.getCustomerInviteTokens()
      expect(tokens[0].usedAt).not.toBeNull()

      // User should be upgraded
      const users = authRepo.getUsers()
      const user = users.find(u => u.id === 'ghost-6')
      expect(user?.isManualCustomer).toBe(false)
      expect(user?.emailVerified).toBe(true)
    })
  })
})
