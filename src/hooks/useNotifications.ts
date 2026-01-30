"use client"

import { useState, useEffect, useCallback } from "react"

export interface Notification {
  id: string
  type: string
  message: string
  isRead: boolean
  linkUrl: string | null
  metadata: string | null
  createdAt: string
}

const POLL_INTERVAL_MS = 30_000 // 30 seconds

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?limit=10")
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
      }
    } catch {
      // Silently fail - notifications are non-critical
    }
  }, [])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/unread-count")
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.count)
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PUT",
      })
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch {
      // Silently fail
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { method: "POST" })
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        setUnreadCount(0)
      }
    } catch {
      // Silently fail
    }
  }, [])

  const refresh = useCallback(() => {
    fetchNotifications()
    fetchUnreadCount()
  }, [fetchNotifications, fetchUnreadCount])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [refresh])

  // Polling for unread count
  useEffect(() => {
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh,
  }
}
