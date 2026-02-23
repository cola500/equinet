"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

interface UseFollowProviderOptions {
  providerId: string
  enabled?: boolean
}

export function useFollowProvider({ providerId, enabled = true }: UseFollowProviderOptions) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!enabled || !providerId) {
      setIsLoading(false)
      return
    }

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/follows/${providerId}`)
        if (response.ok) {
          const data = await response.json()
          setIsFollowing(data.isFollowing)
          setFollowerCount(data.followerCount)
        }
      } catch {
        // Silently fail -- not critical
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatus()
  }, [providerId, enabled])

  const toggle = useCallback(async () => {
    // Optimistic update
    const prev = { isFollowing, followerCount }
    setIsFollowing(!isFollowing)
    setFollowerCount(isFollowing ? followerCount - 1 : followerCount + 1)

    try {
      if (isFollowing) {
        const response = await fetch(`/api/follows/${providerId}`, { method: "DELETE" })
        if (!response.ok) throw new Error()
      } else {
        const response = await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerId }),
        })
        if (!response.ok) throw new Error()
      }
    } catch {
      // Revert on error
      setIsFollowing(prev.isFollowing)
      setFollowerCount(prev.followerCount)
      toast.error(isFollowing ? "Kunde inte avfölja" : "Kunde inte följa")
    }
  }, [isFollowing, followerCount, providerId])

  return { isFollowing, followerCount, toggle, isLoading }
}
