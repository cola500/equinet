"use client"

import { useState, useEffect, useRef, use } from "react"
import useSWR from "swr"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { toast } from "sonner"
import { clientLogger } from "@/lib/client-logger"

interface Message {
  id: string
  conversationId: string
  senderType: "CUSTOMER" | "PROVIDER"
  senderName: string
  content: string
  createdAt: string
  readAt: string | null
  isFromSelf: boolean
}

interface MessagesResponse {
  messages: Message[]
  nextCursor: string | null
}

export default function ProviderThreadPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = use(params)
  const [content, setContent] = useState("")
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data, mutate } = useSWR<MessagesResponse>(
    `/api/bookings/${bookingId}/messages`,
    { refreshInterval: 10000 }
  )

  // Mark messages as read when opening thread
  useEffect(() => {
    if (data) {
      fetch(`/api/bookings/${bookingId}/messages/read`, { method: "PATCH" }).catch(() => {})
    }
  }, [bookingId, data])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [data?.messages.length])

  async function handleSend() {
    const trimmed = content.trim()
    if (!trimmed || isSending) return

    setIsSending(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Okänt fel")
      }

      setContent("")
      await mutate()
    } catch (err) {
      clientLogger.error("ProviderThreadPage: send failed", err as Error)
      toast.error("Kunde inte skicka meddelandet. Försök igen.")
    } finally {
      setIsSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const messages = data?.messages ?? []

  return (
    <ProviderLayout>
      <div className="container mx-auto px-4 py-4 max-w-2xl flex flex-col h-[calc(100dvh-10rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/provider/messages"
            className="text-gray-500 hover:text-gray-900"
            aria-label="Tillbaka till inkorg"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">Konversation</h1>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-2">
          {messages.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              Inga meddelanden ännu.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.isFromSelf ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.isFromSelf
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {!msg.isFromSelf && (
                  <p className="text-xs font-medium mb-1 text-gray-600">{msg.senderName}</p>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.isFromSelf ? "text-green-200" : "text-gray-400"
                  }`}
                >
                  {new Date(msg.createdAt).toLocaleTimeString("sv-SE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Compose area */}
        <div className="border-t pt-3 space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Skriv ett meddelande..."
            className="resize-none"
            rows={3}
            maxLength={2000}
            disabled={isSending}
            aria-label="Meddelande"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{content.length}/2000</span>
            <Button
              type="button"
              onClick={handleSend}
              disabled={!content.trim() || isSending}
              size="sm"
              className="min-h-[44px] sm:min-h-0"
            >
              {isSending ? "Skickar..." : "Skicka"}
            </Button>
          </div>
        </div>
      </div>
    </ProviderLayout>
  )
}
