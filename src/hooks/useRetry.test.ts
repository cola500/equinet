import { renderHook, act, waitFor } from '@testing-library/react'
import { useRetry } from './useRetry'
import { describe, it, expect, vi } from 'vitest'

describe('useRetry', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useRetry())

    expect(result.current.retryCount).toBe(0)
    expect(result.current.isRetrying).toBe(false)
    expect(result.current.canRetry).toBe(true)
  })

  it('should increment retry count on failure', async () => {
    const { result } = renderHook(() => useRetry())
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'))

    await act(async () => {
      await result.current.retry(mockFn)
    })

    expect(result.current.retryCount).toBe(1)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should reset count on success', async () => {
    const { result } = renderHook(() => useRetry())
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValueOnce(undefined)

    // First attempt - fails
    await act(async () => {
      await result.current.retry(mockFn)
    })
    expect(result.current.retryCount).toBe(1)

    // Second attempt - succeeds
    await act(async () => {
      await result.current.retry(mockFn)
    })
    expect(result.current.retryCount).toBe(0)
  })

  it('should respect maxRetries limit', async () => {
    const onMaxRetriesReached = vi.fn()
    const { result } = renderHook(() =>
      useRetry({ maxRetries: 2, onMaxRetriesReached })
    )

    const mockFn = vi.fn().mockRejectedValue(new Error('Test'))

    // Attempt 1
    await act(async () => {
      await result.current.retry(mockFn)
    })
    expect(result.current.retryCount).toBe(1)
    expect(result.current.canRetry).toBe(true)

    // Attempt 2
    await act(async () => {
      await result.current.retry(mockFn)
    })
    expect(result.current.retryCount).toBe(2)
    expect(result.current.canRetry).toBe(false)

    // Attempt 3 - should not execute
    await act(async () => {
      await result.current.retry(mockFn)
    })
    expect(mockFn).toHaveBeenCalledTimes(2) // Still only 2 calls
    expect(onMaxRetriesReached).toHaveBeenCalledTimes(1)
  })

  it('should set isRetrying during execution', async () => {
    const { result } = renderHook(() => useRetry())
    let resolvePromise: () => void
    const slowPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })

    const mockFn = vi.fn().mockReturnValue(slowPromise)

    // Start retry
    act(() => {
      result.current.retry(mockFn)
    })

    // Should be retrying
    await waitFor(() => {
      expect(result.current.isRetrying).toBe(true)
    })

    // Resolve promise
    await act(async () => {
      resolvePromise!()
      await slowPromise
    })

    // Should no longer be retrying
    expect(result.current.isRetrying).toBe(false)
  })

  it('should allow manual reset', async () => {
    const { result } = renderHook(() => useRetry())
    const mockFn = vi.fn().mockRejectedValue(new Error('Test'))

    await act(async () => {
      await result.current.retry(mockFn)
    })
    expect(result.current.retryCount).toBe(1)

    act(() => {
      result.current.reset()
    })

    expect(result.current.retryCount).toBe(0)
    expect(result.current.isRetrying).toBe(false)
  })

  it('should handle custom maxRetries', () => {
    const { result } = renderHook(() => useRetry({ maxRetries: 5 }))

    expect(result.current.canRetry).toBe(true)
  })

  it('should log errors on failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useRetry({ maxRetries: 3 }))
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'))

    await act(async () => {
      await result.current.retry(mockFn)
    })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Retry 1/3 failed:',
      expect.any(Error)
    )

    consoleErrorSpy.mockRestore()
  })
})
