import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GhostMergeService, type GhostMergeServiceDeps } from './GhostMergeService'

describe('GhostMergeService', () => {
  let service: GhostMergeService
  let mockDeps: GhostMergeServiceDeps

  beforeEach(() => {
    mockDeps = {
      findProviderCustomerLink: vi.fn(),
      findUserById: vi.fn(),
      findUserByEmail: vi.fn(),
      executeMergeTransaction: vi.fn(),
    }
    service = new GhostMergeService(mockDeps)
  })

  const ghostUserId = 'ghost-1'
  const realUserId = 'real-1'
  const providerId = 'provider-1'
  const targetEmail = 'real@example.com'

  it('returns error when ghost user is not in provider register', async () => {
    vi.mocked(mockDeps.findProviderCustomerLink).mockResolvedValue(null)

    const result = await service.merge(ghostUserId, targetEmail, providerId)

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe('GHOST_NOT_IN_REGISTER')
  })

  it('returns error when ghost user is not actually a ghost', async () => {
    vi.mocked(mockDeps.findProviderCustomerLink).mockResolvedValue({ id: 'link-1' })
    vi.mocked(mockDeps.findUserById).mockResolvedValue({
      id: ghostUserId,
      isManualCustomer: false,
      email: 'ghost@ghost.equinet.se',
    })

    const result = await service.merge(ghostUserId, targetEmail, providerId)

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe('NOT_A_GHOST')
  })

  it('returns error when target user does not exist', async () => {
    vi.mocked(mockDeps.findProviderCustomerLink).mockResolvedValue({ id: 'link-1' })
    vi.mocked(mockDeps.findUserById).mockResolvedValue({
      id: ghostUserId,
      isManualCustomer: true,
      email: 'ghost@ghost.equinet.se',
    })
    vi.mocked(mockDeps.findUserByEmail).mockResolvedValue(null)

    const result = await service.merge(ghostUserId, targetEmail, providerId)

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe('TARGET_NOT_FOUND')
  })

  it('returns error when target user is also a ghost', async () => {
    vi.mocked(mockDeps.findProviderCustomerLink).mockResolvedValue({ id: 'link-1' })
    vi.mocked(mockDeps.findUserById).mockResolvedValue({
      id: ghostUserId,
      isManualCustomer: true,
      email: 'ghost@ghost.equinet.se',
    })
    vi.mocked(mockDeps.findUserByEmail).mockResolvedValue({
      id: realUserId,
      isManualCustomer: true,
      email: targetEmail,
    })

    const result = await service.merge(ghostUserId, targetEmail, providerId)

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe('TARGET_IS_GHOST')
  })

  it('returns error when trying to merge user with themselves', async () => {
    vi.mocked(mockDeps.findProviderCustomerLink).mockResolvedValue({ id: 'link-1' })
    vi.mocked(mockDeps.findUserById).mockResolvedValue({
      id: ghostUserId,
      isManualCustomer: true,
      email: targetEmail,
    })
    vi.mocked(mockDeps.findUserByEmail).mockResolvedValue({
      id: ghostUserId,
      isManualCustomer: false,
      email: targetEmail,
    })

    const result = await service.merge(ghostUserId, targetEmail, providerId)

    expect(result.isFailure).toBe(true)
    expect(result.error.type).toBe('SAME_USER')
  })

  it('calls executeMergeTransaction on valid merge', async () => {
    vi.mocked(mockDeps.findProviderCustomerLink).mockResolvedValue({ id: 'link-1' })
    vi.mocked(mockDeps.findUserById).mockResolvedValue({
      id: ghostUserId,
      isManualCustomer: true,
      email: 'ghost@ghost.equinet.se',
    })
    vi.mocked(mockDeps.findUserByEmail).mockResolvedValue({
      id: realUserId,
      isManualCustomer: false,
      email: targetEmail,
    })
    vi.mocked(mockDeps.executeMergeTransaction).mockResolvedValue(undefined)

    const result = await service.merge(ghostUserId, targetEmail, providerId)

    expect(result.isSuccess).toBe(true)
    expect(result.value.mergedInto).toBe(realUserId)
    expect(mockDeps.executeMergeTransaction).toHaveBeenCalledWith(ghostUserId, realUserId)
  })
})
