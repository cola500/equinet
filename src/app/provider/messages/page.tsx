"use client"

import useSWR from "swr"
import Link from "next/link"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { MessageSquare } from "lucide-react"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"

interface InboxItem {
  bookingId: string
  bookingDate: string
  serviceName: string
  customerName: string
  lastMessageContent: string
  lastMessageSenderType: "CUSTOMER" | "PROVIDER"
  lastMessageAt: string
  unreadCount: number
}

interface InboxResponse {
  items: InboxItem[]
}

export default function ProviderMessagesPage() {
  const { data, isLoading } = useSWR<InboxResponse>(
    "/api/provider/conversations",
    { refreshInterval: 30000 }
  )

  const items = data?.items ?? []

  return (
    <ProviderLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Meddelanden</h1>

        {isLoading && (
          <p className="text-gray-500 text-sm">Laddar...</p>
        )}

        {!isLoading && items.length === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="Inga meddelanden"
            description="Inga aktiva konversationer just nu."
          />
        )}

        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.bookingId}>
              <Link
                href={`/provider/messages/${item.bookingId}`}
                className="block bg-white rounded-lg border p-4 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">
                        {item.customerName}
                      </span>
                      {item.unreadCount > 0 && (
                        <Badge variant="destructive" className="shrink-0 text-xs">
                          {item.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {item.serviceName} &middot;{" "}
                      {format(new Date(item.bookingDate), "d MMM", { locale: sv })}
                    </p>
                    <p className="text-sm text-gray-700 mt-1 truncate">
                      {item.lastMessageSenderType === "PROVIDER" ? "Du: " : ""}
                      {item.lastMessageContent}
                    </p>
                  </div>
                  <time className="text-xs text-gray-400 shrink-0 mt-0.5">
                    {format(new Date(item.lastMessageAt), "HH:mm", { locale: sv })}
                  </time>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </ProviderLayout>
  )
}
