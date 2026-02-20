"use client"

import { useSession } from "next-auth/react"
import { useOnlineStatus } from "./useOnlineStatus"

const SESSION_STORAGE_KEY = "equinet-auth-cache"

interface CachedAuth {
  user: any
  isProvider: boolean
  isCustomer: boolean
  isAdmin: boolean
  providerId: string | null
}

export function useAuth() {
  const { data: session, status } = useSession()
  const isOnline = useOnlineStatus()

  // Cache session to sessionStorage when authenticated
  if (status === "authenticated" && session?.user) {
    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          user: session.user,
          isProvider: session.user.userType === "provider",
          isCustomer: session.user.userType === "customer",
          isAdmin: session.user.isAdmin === true,
          providerId: session.user.providerId ?? null,
        })
      )
    } catch {
      /* quota exceeded -- ignore */
    }
  }

  // Clear cache on explicit logout (unauthenticated while online)
  if (status === "unauthenticated" && isOnline) {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  // Offline: try sessionStorage cache
  if (!isOnline && status !== "authenticated") {
    try {
      const cached = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (cached) {
        const parsed: CachedAuth = JSON.parse(cached)
        return {
          user: parsed.user,
          isAuthenticated: true,
          isLoading: false,
          isProvider: parsed.isProvider,
          isCustomer: parsed.isCustomer,
          isAdmin: parsed.isAdmin,
          providerId: parsed.providerId,
        }
      }
    } catch {
      /* parse error -- fall through */
    }

    // No cache at all -- return loading to prevent redirect
    return {
      user: undefined,
      isAuthenticated: false,
      isLoading: true,
      isProvider: false,
      isCustomer: false,
      isAdmin: false,
      providerId: null,
    }
  }

  // Online: normal behavior
  return {
    user: session?.user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    isProvider: session?.user?.userType === "provider",
    isCustomer: session?.user?.userType === "customer",
    isAdmin: session?.user?.isAdmin === true,
    providerId: session?.user?.providerId ?? null,
  }
}
