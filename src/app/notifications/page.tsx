"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell, Check, CheckCheck } from "lucide-react"
import { type Notification } from "@/hooks/useNotifications"
import { formatRelativeTime } from "@/lib/format-utils"

function getNotificationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    booking_created: "Bokning",
    booking_confirmed: "Bokning bekräftad",
    booking_cancelled: "Bokning avbokad",
    booking_completed: "Bokning genomförd",
    payment_received: "Betalning",
    review_received: "Recension",
    reminder_rebook: "Påminnelse",
  }
  return labels[type] || "Notifikation"
}

export default function NotificationsPage() {
  const router = useRouter()
  const { isLoading, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, isLoading, router])

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoadingNotifications(true)
      setError(null)
      const response = await fetch("/api/notifications?limit=50")
      if (!response.ok) {
        setError("Kunde inte hämta notifikationer")
        return
      }
      const data = await response.json()
      setNotifications(data)
    } catch {
      setError("Något gick fel. Kontrollera din internetanslutning.")
    } finally {
      setIsLoadingNotifications(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications()
    }
  }, [isAuthenticated, fetchNotifications])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PUT",
      })
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
        )
      }
    } catch {
      toast.error("Kunde inte markera som läst")
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications", { method: "POST" })
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      }
    } catch {
      toast.error("Kunde inte markera alla som lästa")
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id)
    }
    if (notification.linkUrl) {
      router.push(notification.linkUrl)
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Notifikationer</h1>
            <p className="text-gray-600 mt-1">
              {unreadCount > 0
                ? `${unreadCount} olästa notifikationer`
                : "Inga olästa notifikationer"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Markera alla som lästa
            </Button>
          )}
        </div>

        {error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Något gick fel
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={fetchNotifications}>Försök igen</Button>
            </CardContent>
          </Card>
        ) : isLoadingNotifications ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar notifikationer...</p>
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Inga notifikationer
              </h3>
              <p className="text-gray-600">
                Du har inga notifikationer ännu. De dyker upp här när det händer
                något med dina bokningar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                  !notification.isRead ? "border-l-4 border-l-green-500 bg-green-50/30" : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {!notification.isRead ? (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-green-500" />
                      ) : (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-transparent" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          {getNotificationTypeLabel(notification.type)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className={`text-sm ${!notification.isRead ? "font-medium" : "text-gray-700"}`}>
                        {notification.message}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0 p-0 text-gray-400 hover:text-green-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkAsRead(notification.id)
                        }}
                        title="Markera som läst"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
