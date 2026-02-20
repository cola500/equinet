import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuth } from './useAuth'
import { useSession } from 'next-auth/react'

// Mock next-auth
vi.mock('next-auth/react')

// Mock useOnlineStatus
vi.mock('./useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => true),
}))

import { useOnlineStatus } from './useOnlineStatus'

const SESSION_STORAGE_KEY = 'equinet-auth-cache'

const mockProviderSession = {
  user: {
    id: '456',
    email: 'provider@example.com',
    name: 'Test Provider',
    userType: 'provider' as const,
    providerId: 'p123',
  },
  expires: '2025-12-31',
}

const mockCustomerSession = {
  user: {
    id: '123',
    email: 'customer@example.com',
    name: 'Test Customer',
    userType: 'customer' as const,
  },
  expires: '2025-12-31',
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

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
    expect(result.current.providerId).toBeNull()
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
    vi.mocked(useSession).mockReturnValue({
      data: mockCustomerSession,
      status: 'authenticated',
      update: vi.fn(),
    })

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toEqual(mockCustomerSession.user)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isCustomer).toBe(true)
    expect(result.current.isProvider).toBe(false)
    expect(result.current.providerId).toBeNull()
  })

  it('should return authenticated provider state', () => {
    vi.mocked(useSession).mockReturnValue({
      data: mockProviderSession,
      status: 'authenticated',
      update: vi.fn(),
    })

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toEqual(mockProviderSession.user)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isProvider).toBe(true)
    expect(result.current.isCustomer).toBe(false)
    expect(result.current.providerId).toBe('p123')
  })

  describe('sessionStorage caching', () => {
    it('should write to sessionStorage when authenticated', () => {
      vi.mocked(useSession).mockReturnValue({
        data: mockProviderSession,
        status: 'authenticated',
        update: vi.fn(),
      })

      renderHook(() => useAuth())

      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed.user).toEqual(mockProviderSession.user)
      expect(parsed.isProvider).toBe(true)
      expect(parsed.isCustomer).toBe(false)
      expect(parsed.providerId).toBe('p123')
    })

    it('should clear sessionStorage on explicit logout (unauthenticated + online)', () => {
      // Seed sessionStorage as if we were previously authenticated
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        user: mockProviderSession.user,
        isProvider: true,
        isCustomer: false,
        isAdmin: false,
        providerId: 'p123',
      }))

      vi.mocked(useOnlineStatus).mockReturnValue(true)
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      })

      renderHook(() => useAuth())

      expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    })
  })

  describe('offline resilience', () => {
    it('should return cached session from sessionStorage when offline', () => {
      // Seed sessionStorage as if a previous render cached it
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        user: mockProviderSession.user,
        isProvider: true,
        isCustomer: false,
        isAdmin: false,
        providerId: 'p123',
      }))

      vi.mocked(useOnlineStatus).mockReturnValue(false)
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isProvider).toBe(true)
      expect(result.current.user).toEqual(mockProviderSession.user)
      expect(result.current.providerId).toBe('p123')
    })

    it('should return cached session when offline and useSession reports unauthenticated', () => {
      // First render: online + authenticated (caches the session)
      vi.mocked(useSession).mockReturnValue({
        data: mockProviderSession,
        status: 'authenticated',
        update: vi.fn(),
      })

      const { result, rerender } = renderHook(() => useAuth())
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isProvider).toBe(true)

      // Go offline and useSession returns unauthenticated (network failure)
      vi.mocked(useOnlineStatus).mockReturnValue(false)
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      })

      rerender()

      // Should still return cached session (from sessionStorage)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isProvider).toBe(true)
      expect(result.current.user).toEqual(mockProviderSession.user)
      expect(result.current.providerId).toBe('p123')
    })

    it('should return loading when offline with no cached session', () => {
      // Start offline with no prior session
      vi.mocked(useOnlineStatus).mockReturnValue(false)
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      })

      const { result } = renderHook(() => useAuth())

      // Should return loading, NOT unauthenticated (prevents redirect to login)
      expect(result.current.isLoading).toBe(true)
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should resume normal useSession behavior when back online', () => {
      // Start online + authenticated
      vi.mocked(useSession).mockReturnValue({
        data: mockProviderSession,
        status: 'authenticated',
        update: vi.fn(),
      })

      const { result, rerender } = renderHook(() => useAuth())
      expect(result.current.isAuthenticated).toBe(true)

      // Go offline
      vi.mocked(useOnlineStatus).mockReturnValue(false)
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      })
      rerender()
      expect(result.current.isAuthenticated).toBe(true) // cached

      // Come back online -- useSession now reports authenticated again
      vi.mocked(useOnlineStatus).mockReturnValue(true)
      vi.mocked(useSession).mockReturnValue({
        data: mockProviderSession,
        status: 'authenticated',
        update: vi.fn(),
      })
      rerender()

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(mockProviderSession.user)
    })

    it('should respect real unauthenticated when online', () => {
      // Online but genuinely unauthenticated (user logged out)
      vi.mocked(useOnlineStatus).mockReturnValue(true)
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
    })

    it('should return cached session when offline and useSession reports loading', () => {
      // First: online + authenticated
      vi.mocked(useSession).mockReturnValue({
        data: mockProviderSession,
        status: 'authenticated',
        update: vi.fn(),
      })

      const { result, rerender } = renderHook(() => useAuth())
      expect(result.current.isAuthenticated).toBe(true)

      // Go offline, useSession stuck in loading
      vi.mocked(useOnlineStatus).mockReturnValue(false)
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'loading',
        update: vi.fn(),
      })

      rerender()

      // Should return cached session, not loading
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isProvider).toBe(true)
    })

    it('should NOT clear sessionStorage when unauthenticated + offline', () => {
      // Seed sessionStorage
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        user: mockProviderSession.user,
        isProvider: true,
        isCustomer: false,
        isAdmin: false,
        providerId: 'p123',
      }))

      vi.mocked(useOnlineStatus).mockReturnValue(false)
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      })

      renderHook(() => useAuth())

      // Should NOT clear -- only clear on explicit logout (online)
      expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull()
    })
  })
})
