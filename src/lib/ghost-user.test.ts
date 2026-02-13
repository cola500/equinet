import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createGhostUser } from './ghost-user'
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
    vi.mocked(prisma.user.create).mockImplementation(async (args: any) => ({
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

  it('should reuse existing user when email matches', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'existing-user-id',
    } as any)

    const userId = await createGhostUser({
      firstName: 'Anna',
      email: 'anna@test.com',
    })

    expect(userId).toBe('existing-user-id')
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
