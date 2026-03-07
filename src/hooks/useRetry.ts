'use client'

import { useState, useCallback } from 'react'
import { clientLogger } from '@/lib/client-logger'

interface UseRetryOptions {
  maxRetries?: number
  onMaxRetriesReached?: () => void
}

export function useRetry(options: UseRetryOptions = {}) {
  const { maxRetries = 3, onMaxRetriesReached } = options

  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  const retry = useCallback(
    async (fn: () => Promise<void>) => {
      if (retryCount >= maxRetries) {
        onMaxRetriesReached?.()
        return
      }

      setIsRetrying(true)
      setRetryCount(prev => prev + 1)

      try {
        await fn()
        setRetryCount(0) // Success - reset
      } catch (error) {
        clientLogger.error("Retry failed", error, { attempt: retryCount + 1, maxRetries })
      } finally {
        setIsRetrying(false)
      }
    },
    [retryCount, maxRetries, onMaxRetriesReached]
  )

  const reset = useCallback(() => {
    setRetryCount(0)
    setIsRetrying(false)
  }, [])

  return {
    retry,
    retryCount,
    isRetrying,
    canRetry: retryCount < maxRetries,
    reset,
  }
}
