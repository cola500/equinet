"use client"

import { useSession } from "@/components/providers/SessionProvider"
import { useOnlineStatus } from "./useOnlineStatus"

const SESSION_STORAGE_KEY = "equinet-auth-cache"

interface CachedAuth {
  user: {
    id: string
    email: string
    name: string
    userType: string
    isAdmin?: boolean
    providerId?: string | null
    stableId?: string | null
  }
  isProvider: boolean
  isCustomer: boolean
  isAdmin: boolean
  isStableOwner: boolean
  providerId: string | null
  stableId: string | null
}

export function useAuth() {
  const { user, status } = useSession()
  const isOnline = useOnlineStatus()

  // Cache session to sessionStorage when authenticated
  if (status === "authenticated" && user) {
    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          user,
          isProvider: user.userType === "provider",
          isCustomer: user.userType === "customer",
          isAdmin: user.isAdmin === true,
          isStableOwner: !!user.stableId,
          providerId: user.providerId ?? null,
          stableId: user.stableId ?? null,
        })
      )
    } catch {
      /* quota exceeded -- ignore */
    }
  }

  // NOTE: We intentionally do NOT clear sessionStorage on "unauthenticated + online".
  // There's a ~2s race condition where the session check reports unauthenticated (network error)
  // BEFORE navigator.onLine changes to false. Clearing here would destroy the cache
  // we need for offline mode. sessionStorage auto-clears on tab close anyway,
  // and new logins overwrite the cache (above).

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
          isStableOwner: parsed.isStableOwner,
          providerId: parsed.providerId,
          stableId: parsed.stableId,
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
      isStableOwner: false,
      providerId: null,
      stableId: null,
    }
  }

  // Online: normal behavior
  return {
    user: user ?? undefined,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    isProvider: user?.userType === "provider",
    isCustomer: user?.userType === "customer",
    isAdmin: user?.isAdmin === true,
    isStableOwner: !!user?.stableId,
    providerId: user?.providerId ?? null,
    stableId: user?.stableId ?? null,
  }
}
