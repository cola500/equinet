import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuth } from './useAuth'
import { useSession } from 'next-auth/react'

// Mock next-auth
vi.mock('next-auth/react')

describe('useAuth', () => {
  it('should return unauthenticated state when no session', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    })

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeUndefined()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isProvider).toBe(false)
    expect(result.current.isCustomer).toBe(false)
  })

  it('should return loading state', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'loading',
      update: vi.fn(),
    })

    const { result } = renderHook(() => useAuth())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should return authenticated customer state', () => {
    const mockSession = {
      user: {
        id: '123',
        email: 'customer@example.com',
        name: 'Test Customer',
        userType: 'customer' as const,
      },
      expires: '2025-12-31',
    }

    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: vi.fn(),
    })

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toEqual(mockSession.user)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isCustomer).toBe(true)
    expect(result.current.isProvider).toBe(false)
  })

  it('should return authenticated provider state', () => {
    const mockSession = {
      user: {
        id: '456',
        email: 'provider@example.com',
        name: 'Test Provider',
        userType: 'provider' as const,
        providerId: 'p123',
      },
      expires: '2025-12-31',
    }

    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: vi.fn(),
    })

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toEqual(mockSession.user)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isProvider).toBe(true)
    expect(result.current.isCustomer).toBe(false)
  })
})
