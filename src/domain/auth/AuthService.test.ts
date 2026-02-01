import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService, type AuthServiceDeps } from './AuthService'
import { MockAuthRepository } from '@/infrastructure/persistence/auth/MockAuthRepository'

describe('AuthService', () => {
  let authRepo: MockAuthRepository
  let service: AuthService
  let sentEmails: Array<{ email: string; firstName: string; token: string }>
  let tokenCounter: number

  beforeEach(() => {
    authRepo = new MockAuthRepository()
    sentEmails = []
    tokenCounter = 0

    const deps: AuthServiceDeps = {
      authRepository: authRepo,
      hashPassword: async (pw) => `hashed:${pw}`,
      comparePassword: async (pw, hash) => hash === `hashed:${pw}`,
      generateToken: () => `test-token-${++tokenCounter}`,
      emailService: {
        sendVerification: async (email, firstName, token) => {
          sentEmails.push({ email, firstName, token })
        },
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

    it('should register a customer successfully', async () => {
      const result = await service.register(customerInput)

      expect(result.isSuccess).toBe(true)
      expect(result.value.user.email).toBe('test@example.com')
      expect(result.value.user.firstName).toBe('Test')
      expect(result.value.user.userType).toBe('customer')
    })

    it('should register a provider with business info', async () => {
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

    it('should fail if email already exists', async () => {
      authRepo.seedUser({
        id: 'existing-user',
        email: 'test@example.com',
        firstName: 'Existing',
        lastName: 'User',
        userType: 'customer',
        passwordHash: 'hashed:old',
        emailVerified: true,
      })

      const result = await service.register(customerInput)

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('EMAIL_ALREADY_EXISTS')
    })

    it('should hash the password', async () => {
      await service.register(customerInput)

      const users = authRepo.getUsers()
      expect(users[0].passwordHash).toBe('hashed:Password123!')
    })

    it('should create a verification token', async () => {
      await service.register(customerInput)

      const tokens = authRepo.getTokens()
      expect(tokens).toHaveLength(1)
      expect(tokens[0].token).toBe('test-token-1')
      expect(tokens[0].expiresAt.getTime()).toBeGreaterThan(Date.now())
    })

    it('should send a verification email', async () => {
      await service.register(customerInput)

      expect(sentEmails).toHaveLength(1)
      expect(sentEmails[0].email).toBe('test@example.com')
      expect(sentEmails[0].firstName).toBe('Test')
      expect(sentEmails[0].token).toBe('test-token-1')
    })

    it('should never return passwordHash in user object', async () => {
      const result = await service.register(customerInput)

      expect(result.isSuccess).toBe(true)
      expect('passwordHash' in result.value.user).toBe(false)
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
        passwordHash: 'hashed:pw',
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
        passwordHash: 'hashed:pw',
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
        passwordHash: 'hashed:pw',
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
        passwordHash: 'hashed:pw',
        emailVerified: true,
      })

      const result = await service.resendVerification('verified@example.com')

      // Same response shape regardless -- enumeration prevention
      expect(result.isSuccess).toBe(true)
    })
  })

  // ===========================================================
  // verifyCredentials
  // ===========================================================

  describe('verifyCredentials', () => {
    beforeEach(() => {
      authRepo.seedUser({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userType: 'customer',
        passwordHash: 'hashed:Password123!',
        emailVerified: true,
      })
    })

    it('should return user info on valid credentials', async () => {
      const result = await service.verifyCredentials('test@example.com', 'Password123!')

      expect(result.isSuccess).toBe(true)
      expect(result.value.id).toBe('user-1')
      expect(result.value.email).toBe('test@example.com')
      expect(result.value.name).toBe('Test User')
      expect(result.value.userType).toBe('customer')
      expect(result.value.providerId).toBeNull()
    })

    it('should fail if email does not exist', async () => {
      const result = await service.verifyCredentials('unknown@example.com', 'Password123!')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_CREDENTIALS')
    })

    it('should fail if password is wrong', async () => {
      const result = await service.verifyCredentials('test@example.com', 'WrongPassword!')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('INVALID_CREDENTIALS')
    })

    it('should fail if email is not verified', async () => {
      authRepo.seedUser({
        id: 'user-2',
        email: 'unverified@example.com',
        firstName: 'Unverified',
        lastName: 'User',
        userType: 'customer',
        passwordHash: 'hashed:Password123!',
        emailVerified: false,
      })

      const result = await service.verifyCredentials('unverified@example.com', 'Password123!')

      expect(result.isFailure).toBe(true)
      expect(result.error.type).toBe('EMAIL_NOT_VERIFIED')
    })

    it('should include providerId for providers', async () => {
      authRepo.seedUser({
        id: 'user-3',
        email: 'provider@example.com',
        firstName: 'Provider',
        lastName: 'User',
        userType: 'provider',
        passwordHash: 'hashed:Password123!',
        emailVerified: true,
      })
      authRepo.seedProvider({
        id: 'provider-1',
        userId: 'user-3',
        businessName: 'Test Business',
      })

      const result = await service.verifyCredentials('provider@example.com', 'Password123!')

      expect(result.isSuccess).toBe(true)
      expect(result.value.providerId).toBe('provider-1')
    })
  })
})
