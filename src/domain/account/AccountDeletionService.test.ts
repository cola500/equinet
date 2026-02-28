import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AccountDeletionService,
  type AccountDeletionServiceDeps,
  type UserForDeletion,
} from './AccountDeletionService'

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function makeUser(overrides: Partial<UserForDeletion> = {}): UserForDeletion {
  return {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Johan',
    passwordHash: 'hashed-password',
    isAdmin: false,
    ...overrides,
  }
}

function makeDeps(overrides: Partial<AccountDeletionServiceDeps> = {}): AccountDeletionServiceDeps {
  return {
    findUserById: vi.fn().mockResolvedValue(makeUser()),
    findProviderByUserId: vi.fn().mockResolvedValue(null),
    findUploadPaths: vi.fn().mockResolvedValue([]),
    anonymizeUser: vi.fn().mockResolvedValue(undefined),
    anonymizeProvider: vi.fn().mockResolvedValue(undefined),
    deletePersonalRecords: vi.fn().mockResolvedValue(undefined),
    anonymizeBookings: vi.fn().mockResolvedValue(undefined),
    anonymizeReviews: vi.fn().mockResolvedValue(undefined),
    deleteUploads: vi.fn().mockResolvedValue(undefined),
    deleteStorageFiles: vi.fn().mockResolvedValue(undefined),
    sendDeletionEmail: vi.fn().mockResolvedValue(undefined),
    comparePassword: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

// -----------------------------------------------------------
// Tests
// -----------------------------------------------------------

describe('AccountDeletionService', () => {
  let deps: AccountDeletionServiceDeps
  let service: AccountDeletionService

  beforeEach(() => {
    vi.clearAllMocks()
    deps = makeDeps()
    service = new AccountDeletionService(deps)
  })

  it('returns USER_NOT_FOUND when user does not exist', async () => {
    deps = makeDeps({ findUserById: vi.fn().mockResolvedValue(null) })
    service = new AccountDeletionService(deps)

    const result = await service.deleteAccount('unknown-id', 'password', 'RADERA')

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe('USER_NOT_FOUND')
  })

  it('returns ADMIN_ACCOUNT when user is admin', async () => {
    deps = makeDeps({ findUserById: vi.fn().mockResolvedValue(makeUser({ isAdmin: true })) })
    service = new AccountDeletionService(deps)

    const result = await service.deleteAccount('user-1', 'password', 'RADERA')

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe('ADMIN_ACCOUNT')
  })

  it('returns INVALID_PASSWORD when password is wrong', async () => {
    deps = makeDeps({ comparePassword: vi.fn().mockResolvedValue(false) })
    service = new AccountDeletionService(deps)

    const result = await service.deleteAccount('user-1', 'wrong-password', 'RADERA')

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe('INVALID_PASSWORD')
  })

  it('returns INVALID_CONFIRMATION when confirmation text is wrong', async () => {
    const result = await service.deleteAccount('user-1', 'password', 'DELETE')

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe('INVALID_CONFIRMATION')
  })

  it('executes all deletion steps in correct order on success', async () => {
    const callOrder: string[] = []

    deps = makeDeps({
      sendDeletionEmail: vi.fn().mockImplementation(async () => { callOrder.push('sendEmail') }),
      deleteStorageFiles: vi.fn().mockImplementation(async () => { callOrder.push('deleteStorage') }),
      deleteUploads: vi.fn().mockImplementation(async () => { callOrder.push('deleteUploads') }),
      deletePersonalRecords: vi.fn().mockImplementation(async () => { callOrder.push('deletePersonal') }),
      anonymizeBookings: vi.fn().mockImplementation(async () => { callOrder.push('anonymizeBookings') }),
      anonymizeReviews: vi.fn().mockImplementation(async () => { callOrder.push('anonymizeReviews') }),
      anonymizeUser: vi.fn().mockImplementation(async () => { callOrder.push('anonymizeUser') }),
    })
    service = new AccountDeletionService(deps)

    const result = await service.deleteAccount('user-1', 'password', 'RADERA')

    expect(result.isSuccess).toBe(true)
    expect(callOrder).toEqual([
      'sendEmail',
      'deleteStorage',
      'deleteUploads',
      'deletePersonal',
      'anonymizeBookings',
      'anonymizeReviews',
      'anonymizeUser',
    ])
  })

  it('sends deletion email BEFORE anonymization', async () => {
    const callOrder: string[] = []

    deps = makeDeps({
      sendDeletionEmail: vi.fn().mockImplementation(async () => { callOrder.push('email') }),
      anonymizeUser: vi.fn().mockImplementation(async () => { callOrder.push('anonymize') }),
    })
    service = new AccountDeletionService(deps)

    await service.deleteAccount('user-1', 'password', 'RADERA')

    const emailIndex = callOrder.indexOf('email')
    const anonymizeIndex = callOrder.indexOf('anonymize')
    expect(emailIndex).toBeLessThan(anonymizeIndex)
  })

  it('also anonymizes provider when user is a provider', async () => {
    deps = makeDeps({
      findProviderByUserId: vi.fn().mockResolvedValue({ id: 'provider-1' }),
    })
    service = new AccountDeletionService(deps)

    const result = await service.deleteAccount('user-1', 'password', 'RADERA')

    expect(result.isSuccess).toBe(true)
    expect(deps.anonymizeProvider).toHaveBeenCalledWith('provider-1')
  })

  it('handles user with no uploads gracefully', async () => {
    deps = makeDeps({
      findUploadPaths: vi.fn().mockResolvedValue([]),
    })
    service = new AccountDeletionService(deps)

    const result = await service.deleteAccount('user-1', 'password', 'RADERA')

    expect(result.isSuccess).toBe(true)
    expect(deps.deleteStorageFiles).toHaveBeenCalledWith([])
  })

  it('returns deleted: true on success', async () => {
    const result = await service.deleteAccount('user-1', 'password', 'RADERA')

    expect(result.isSuccess).toBe(true)
    expect(result.value).toEqual({ deleted: true })
  })
})
