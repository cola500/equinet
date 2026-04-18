"use client"

import { useState, useEffect, useRef } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog"
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

interface MessagingDialogProps {
  bookingId: string
  providerName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MessagingDialog({
  bookingId,
  providerName,
  open,
  onOpenChange,
}: MessagingDialogProps) {
  const [content, setContent] = useState("")
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const readCalledRef = useRef(false)

  const { data, mutate, isLoading } = useSWR<MessagesResponse>(
    open ? `/api/bookings/${bookingId}/messages` : null,
    { refreshInterval: 10000 }
  )

  useEffect(() => {
    if (!open) {
      readCalledRef.current = false
    }
  }, [open])

  useEffect(() => {
    if (open && data && !readCalledRef.current) {
      readCalledRef.current = true
      fetch(`/api/bookings/${bookingId}/messages/read`, { method: "PATCH" }).catch(() => {})
    }
  }, [open, bookingId, data])

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
      clientLogger.error("MessagingDialog: send failed", err as Error)
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
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg flex flex-col max-h-[85vh]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Meddelanden</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Konversation med {providerName}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* Message list */}
        <div
          className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0"
          aria-live="polite"
          aria-label="Meddelandetråd"
        >
          {isLoading && (
            <p className="text-sm text-gray-400 text-center py-8">Laddar meddelanden...</p>
          )}
          {!isLoading && messages.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              Inga meddelanden ännu. Skriv ett meddelande till leverantören.
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
                  <p className="text-xs font-medium mb-1 text-gray-600">
                    {msg.senderName}
                  </p>
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
        <div className="border-t px-4 py-3 space-y-2">
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
            autoFocus
          />
          <div className="flex justify-between items-center">
            {content.length > 1800 ? (
              <span className="text-xs text-amber-600">{content.length}/2000</span>
            ) : (
              <span />
            )}
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
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
