"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useAuth } from "@/hooks/useAuth"
import { debugLog } from "@/lib/offline/debug-logger"

export function useDebugLogger(): void {
  const enabled = useFeatureFlag("offline_mode")
  const isOnline = useOnlineStatus()
  const { isAuthenticated, isLoading } = useAuth()
  const pathname = usePathname()

  const isInitialMount = useRef(true)
  const prevOnline = useRef(isOnline)
  const prevAuth = useRef({ isAuthenticated, isLoading })
  const prevPathname = useRef(pathname)

  // Init log
  useEffect(() => {
    if (!enabled) return
    debugLog("general", "info", "Debug logger initialized", {
      pathname,
      isOnline,
      isAuthenticated,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Navigation changes
  useEffect(() => {
    if (!enabled) return
    if (isInitialMount.current) return
    if (pathname !== prevPathname.current) {
      debugLog("navigation", "info", `Navigated to ${pathname}`)
      prevPathname.current = pathname
    }
  }, [enabled, pathname])

  // Online/offline transitions
  useEffect(() => {
    if (!enabled) return
    if (isInitialMount.current) return
    if (isOnline !== prevOnline.current) {
      debugLog(
        "network",
        isOnline ? "info" : "warn",
        isOnline ? "Went online" : "Went offline"
      )
      prevOnline.current = isOnline
    }
  }, [enabled, isOnline])

  // Auth state changes
  useEffect(() => {
    if (!enabled) return
    if (isInitialMount.current) return
    if (
      isAuthenticated !== prevAuth.current.isAuthenticated ||
      isLoading !== prevAuth.current.isLoading
    ) {
      debugLog("auth", isAuthenticated ? "info" : "warn", "Auth state changed", {
        isAuthenticated,
        isLoading,
      })
      prevAuth.current = { isAuthenticated, isLoading }
    }
  }, [enabled, isAuthenticated, isLoading])

  // Mark initial mount complete after first render cycle
  useEffect(() => {
    if (!enabled) return
    isInitialMount.current = false
  }, [enabled])
}
