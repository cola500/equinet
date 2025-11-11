"use client"

import { useSession } from "next-auth/react"

export function useAuth() {
  const { data: session, status } = useSession()

  return {
    user: session?.user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    isProvider: session?.user?.userType === "provider",
    isCustomer: session?.user?.userType === "customer",
  }
}
