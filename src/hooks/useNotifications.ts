"use client"

import { useCallback } from "react"
import useSWR from "swr"

export interface Notification {
  id: string
  type: string
  message: string
  isRead: boolean
  linkUrl: string | null
  metadata: string | null
  createdAt: string
}

interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
}

const POLL_INTERVAL_MS = 30_000

async function fetcher(url: string): Promise<NotificationsResponse> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch notifications")
  return res.json()
}

export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    "/api/notifications?limit=10",
    fetcher,
    {
      refreshInterval: POLL_INTERVAL_MS,
      revalidateOnFocus: true,
    }
  )

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0

  const markAsRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      mutate(
        (current) => {
          if (!current) return current
          return {
            notifications: current.notifications.map((n) =>
              n.id === notificationId ? { ...n, isRead: true } : n
            ),
            unreadCount: Math.max(0, current.unreadCount - 1),
          }
        },
        { revalidate: false }
      )

      try {
        await fetch(`/api/notifications/${notificationId}`, { method: "PUT" })
      } catch {
        // Revert on failure
        mutate()
      }
    },
    [mutate]
  )

  const markAllAsRead = useCallback(
    async () => {
      // Optimistic update
      mutate(
        (current) => {
          if (!current) return current
          return {
            notifications: current.notifications.map((n) => ({
              ...n,
              isRead: true,
            })),
            unreadCount: 0,
          }
        },
        { revalidate: false }
      )

      try {
        await fetch("/api/notifications", { method: "POST" })
      } catch {
        // Revert on failure
        mutate()
      }
    },
    [mutate]
  )

  const refresh = useCallback(() => {
    mutate()
  }, [mutate])

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refresh,
  }
}
