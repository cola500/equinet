import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createGhostUser, GhostUserError } from './ghost-user'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    security: vi.fn(),
  },
}))

describe('createGhostUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockImplementation(async (args: never) => ({
      id: 'new-ghost-id',
      ...args.data,
    }))
  })

  it('should create a user with correct fields', async () => {
    const userId = await createGhostUser({ firstName: 'Anna', lastName: 'Svensson' })

    expect(userId).toBe('new-ghost-id')
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Anna',
        lastName: 'Svensson',
        userType: 'customer',
        isManualCustomer: true,
        emailVerified: false,
      }),
    })
  })

  it('should handle empty lastName (optional)', async () => {
    await createGhostUser({ firstName: 'Anna' })

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Anna',
        lastName: '',
      }),
    })
  })

  it('should pass phone when provided', async () => {
    await createGhostUser({ firstName: 'Anna', phone: '070-1234567' })

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '070-1234567',
      }),
    })
  })

  it('should reuse existing user when email matches and target is a manual customer', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'existing-user-id',
      isManualCustomer: true,
    } as never)

    const userId = await createGhostUser({
      firstName: 'Anna',
      email: 'anna@test.com',
    })

    expect(userId).toBe('existing-user-id')
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  // C1 invariant: ghost-user reuse must NOT silently link a registered user
  // to a provider. Only manual-customer rows may be reused; everything else
  // must fail closed (EMAIL_BELONGS_TO_REGISTERED_USER) to prevent the
  // account-takeover vector described in fixes.txt C1.
  it('should throw EMAIL_BELONGS_TO_REGISTERED_USER when email matches a registered user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'registered-user-id',
      isManualCustomer: false,
    } as never)

    await expect(
      createGhostUser({ firstName: 'Anna', email: 'real@user.com' })
    ).rejects.toBeInstanceOf(GhostUserError)

    await expect(
      createGhostUser({ firstName: 'Anna', email: 'real@user.com' })
    ).rejects.toMatchObject({ code: 'EMAIL_BELONGS_TO_REGISTERED_USER' })

    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('should generate sentinel email when none provided', async () => {
    await createGhostUser({ firstName: 'Anna' })

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: expect.stringContaining('@ghost.equinet.se'),
      }),
    })
  })

  it('should use provided email when given', async () => {
    await createGhostUser({
      firstName: 'Anna',
      email: 'anna@test.com',
    })

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'anna@test.com',
      }),
    })
  })
})
