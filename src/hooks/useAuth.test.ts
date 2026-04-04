import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuth } from './useAuth'

// Mock our SessionProvider's useSession (not next-auth)
const mockUseSession = vi.fn()
vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => mockUseSession(),
}))

// Mock useOnlineStatus
vi.mock('./useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => true),
}))

import { useOnlineStatus } from './useOnlineStatus'

const SESSION_STORAGE_KEY = 'equinet-auth-cache'

const mockProviderUser = {
  id: '456',
  email: 'provider@example.com',
  name: 'Test Provider',
  userType: 'provider' as const,
  isAdmin: false,
  providerId: 'p123',
  stableId: null,
}

const mockCustomerUser = {
  id: '123',
  email: 'customer@example.com',
  name: 'Test Customer',
  userType: 'customer' as const,
  isAdmin: false,
  providerId: null,
  stableId: null,
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
    mockUseSession.mockReturnValue({ user: null, status: 'unauthenticated' })

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeUndefined()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isProvider).toBe(false)
    expect(result.current.isCustomer).toBe(false)
    expect(result.current.providerId).toBeNull()
  })

  it('should return loading state', () => {
    mockUseSession.mockReturnValue({ user: null, status: 'loading' })

    const { result } = renderHook(() => useAuth())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should return authenticated customer state', () => {
    mockUseSession.mockReturnValue({ user: mockCustomerUser, status: 'authenticated' })

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toEqual(mockCustomerUser)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isCustomer).toBe(true)
    expect(result.current.isProvider).toBe(false)
    expect(result.current.providerId).toBeNull()
  })

  it('should return authenticated provider state', () => {
    mockUseSession.mockReturnValue({ user: mockProviderUser, status: 'authenticated' })

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toEqual(mockProviderUser)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isProvider).toBe(true)
    expect(result.current.isCustomer).toBe(false)
    expect(result.current.providerId).toBe('p123')
  })

  describe('sessionStorage caching', () => {
    it('should write to sessionStorage when authenticated', () => {
      mockUseSession.mockReturnValue({ user: mockProviderUser, status: 'authenticated' })

      renderHook(() => useAuth())

      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed.user).toEqual(mockProviderUser)
      expect(parsed.isProvider).toBe(true)
      expect(parsed.isCustomer).toBe(false)
      expect(parsed.providerId).toBe('p123')
    })

    it('should NOT clear sessionStorage when unauthenticated + online (race condition protection)', () => {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        user: mockProviderUser,
        isProvider: true,
        isCustomer: false,
        isAdmin: false,
        providerId: 'p123',
      }))

      vi.mocked(useOnlineStatus).mockReturnValue(true)
      mockUseSession.mockReturnValue({ user: null, status: 'unauthenticated' })

      renderHook(() => useAuth())

      expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull()
    })

    it('should overwrite sessionStorage when new user logs in', () => {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        user: mockProviderUser,
        isProvider: true,
        isCustomer: false,
        isAdmin: false,
        providerId: 'p123',
      }))

      mockUseSession.mockReturnValue({ user: mockCustomerUser, status: 'authenticated' })

      renderHook(() => useAuth())

      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed.user).toEqual(mockCustomerUser)
      expect(parsed.isCustomer).toBe(true)
      expect(parsed.isProvider).toBe(false)
    })
  })

  describe('offline resilience', () => {
    it('should return cached session from sessionStorage when offline', () => {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        user: mockProviderUser,
        isProvider: true,
        isCustomer: false,
        isAdmin: false,
        providerId: 'p123',
      }))

      vi.mocked(useOnlineStatus).mockReturnValue(false)
      mockUseSession.mockReturnValue({ user: null, status: 'unauthenticated' })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isProvider).toBe(true)
      expect(result.current.user).toEqual(mockProviderUser)
      expect(result.current.providerId).toBe('p123')
    })

    it('should return loading when offline with no cached session', () => {
      vi.mocked(useOnlineStatus).mockReturnValue(false)
      mockUseSession.mockReturnValue({ user: null, status: 'unauthenticated' })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should respect real unauthenticated when online', () => {
      vi.mocked(useOnlineStatus).mockReturnValue(true)
      mockUseSession.mockReturnValue({ user: null, status: 'unauthenticated' })

      const { result } = renderHook(() => useAuth())

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.isLoading).toBe(false)
    })

    it('should NOT clear sessionStorage when unauthenticated + offline', () => {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        user: mockProviderUser,
        isProvider: true,
        isCustomer: false,
        isAdmin: false,
        providerId: 'p123',
      }))

      vi.mocked(useOnlineStatus).mockReturnValue(false)
      mockUseSession.mockReturnValue({ user: null, status: 'unauthenticated' })

      renderHook(() => useAuth())

      expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull()
    })
  })
})
