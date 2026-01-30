"use client"

import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNotifications } from "@/hooks/useNotifications"
import { formatRelativeTime } from "@/lib/format-utils"

export function NotificationBell() {
  const router = useRouter()
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications()

  const handleNotificationClick = async (notification: {
    id: string
    isRead: boolean
    linkUrl: string | null
  }) => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }
    if (notification.linkUrl) {
      router.push(notification.linkUrl)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-11 w-11 p-0">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <span className="font-semibold text-sm">Notifikationer</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-green-600 hover:text-green-700"
            >
              Markera alla som lästa
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            Inga notifikationer
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`flex flex-col items-start gap-1 px-4 py-3 cursor-pointer ${
                !notification.isRead ? "bg-green-50" : ""
              }`}
            >
              <div className="flex items-start gap-2 w-full">
                {!notification.isRead && (
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-green-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{notification.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/notifications")}
              className="justify-center text-sm text-gray-500 py-2"
            >
              Visa alla
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
