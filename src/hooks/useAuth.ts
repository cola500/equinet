"use client"

import { useRef } from "react"
import { useSession } from "next-auth/react"
import { useOnlineStatus } from "./useOnlineStatus"

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
  const cachedAuthRef = useRef<CachedAuth | null>(null)

  // When online and authenticated, cache the session data
  if (status === "authenticated" && session?.user) {
    cachedAuthRef.current = {
      user: session.user,
      isProvider: session.user.userType === "provider",
      isCustomer: session.user.userType === "customer",
      isAdmin: session.user.isAdmin === true,
      providerId: session.user.providerId ?? null,
    }
  }

  // Offline: return cached session if available
  if (!isOnline && cachedAuthRef.current) {
    return {
      user: cachedAuthRef.current.user,
      isAuthenticated: true,
      isLoading: false,
      isProvider: cachedAuthRef.current.isProvider,
      isCustomer: cachedAuthRef.current.isCustomer,
      isAdmin: cachedAuthRef.current.isAdmin,
      providerId: cachedAuthRef.current.providerId,
    }
  }

  // Offline with no cached session: return loading to prevent redirect to login
  if (!isOnline && status !== "authenticated") {
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
