"use client"

import { useState, useEffect, useRef, use, Suspense } from "react"
import useSWR from "swr"
import Link from "next/link"
import { ArrowLeft, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VoiceTextarea } from "@/components/ui/voice-textarea"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { toast } from "sonner"
import { clientLogger } from "@/lib/client-logger"
import { SmartReplyChips } from "@/components/provider/messages/SmartReplyChips"
import { displayMessages } from "@/components/provider/messages/messageUtils"
import { AttachmentBubble, AttachmentPreview } from "@/components/provider/messages/AttachmentBubble"
import { MESSAGING_ALLOWED_MIME, MESSAGING_MAX_SIZE } from "@/lib/messaging-constants"

interface Message {
  id: string
  conversationId: string
  senderType: "CUSTOMER" | "PROVIDER"
  senderName: string
  content: string
  createdAt: string
  readAt: string | null
  isFromSelf: boolean
  attachmentSignedUrl?: string | null
  attachmentType?: string | null
  attachmentSize?: number | null
}

interface MessagesResponse {
  customerName: string
  serviceName: string
  bookingDate: string
  messages: Message[]
  nextCursor: string | null
}

interface ProviderProfile {
  user?: {
    phone?: string | null
  }
}

function ThreadView({ bookingId }: { bookingId: string }) {
  const [content, setContent] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const readCalledRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, mutate, isLoading } = useSWR<MessagesResponse>(
    `/api/bookings/${bookingId}/messages`,
    { refreshInterval: 10000 }
  )
  const { data: profile } = useSWR<ProviderProfile>("/api/provider/profile")

  const customerName = data?.customerName ?? "Kund"
  const serviceName = data?.serviceName ?? null

  const smartReplyVars = (() => {
    const d = data?.bookingDate ? new Date(data.bookingDate) : null
    return {
      datum: d ? d.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" }) : "",
      tid: d ? d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }) : "",
      telefon: profile?.user?.phone ?? "",
    }
  })()

  useEffect(() => {
    if (data && !readCalledRef.current) {
      readCalledRef.current = true
      fetch(`/api/bookings/${bookingId}/messages/read`, { method: "PATCH" }).catch(() => {})
    }
  }, [bookingId, data])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [data?.messages.at(-1)?.id])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl)
    }
  }, [attachmentPreviewUrl])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (!MESSAGING_ALLOWED_MIME.includes(file.type as typeof MESSAGING_ALLOWED_MIME[number])) {
      toast.error("Filtypen stöds inte. Tillåtna: JPEG, PNG, HEIC, WebP.")
      return
    }
    if (file.size > MESSAGING_MAX_SIZE) {
      toast.error("Filen är för stor. Max 10 MB.")
      return
    }

    if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl)
    setAttachedFile(file)
    setAttachmentPreviewUrl(URL.createObjectURL(file))
  }

  function handleRemoveAttachment() {
    if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl)
    setAttachedFile(null)
    setAttachmentPreviewUrl(null)
  }

  async function handleSendAttachment() {
    if (!attachedFile || isUploading) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", attachedFile)

    try {
      const res = await fetch(`/api/bookings/${bookingId}/messages/attachments`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Okänt fel")
      }

      handleRemoveAttachment()
      await mutate()
    } catch (err) {
      clientLogger.error("ProviderThreadPage: upload failed", err as Error)
      toast.error("Kunde inte ladda upp bilagan. Försök igen.")
    } finally {
      setIsUploading(false)
    }
  }

  async function handleSend() {
    if (attachedFile) {
      await handleSendAttachment()
      return
    }

    const trimmed = content.trim()
    if (!trimmed || isSending) return

    setIsSending(true)

    const prevData = data
    if (prevData) {
      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        conversationId: prevData.messages[0]?.conversationId ?? "",
        senderType: "PROVIDER",
        senderName: "",
        content: trimmed,
        createdAt: new Date().toISOString(),
        readAt: null,
        isFromSelf: true,
      }
      mutate({ ...prevData, messages: [...prevData.messages, optimisticMsg] }, false)
    }
    setContent("")

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

      await mutate()
    } catch (err) {
      if (prevData) mutate(prevData, false)
      setContent(trimmed)
      clientLogger.error("ProviderThreadPage: send failed", err as Error)
      toast.error("Kunde inte skicka meddelandet. Försök igen.")
    } finally {
      setIsSending(false)
    }
  }

  const messages = data?.messages ?? []
  const isBusy = isSending || isUploading

  return (
    <div className="container mx-auto px-4 py-4 max-w-2xl flex flex-col h-[calc(100dvh-10rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/provider/messages"
          className="p-2 -ml-2 text-gray-500 hover:text-gray-900 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Tillbaka till inkorg"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold leading-tight">{customerName}</h1>
          {serviceName && (
            <p className="text-sm text-gray-500">{serviceName}</p>
          )}
        </div>
      </div>

      {/* Message list */}
      <div
        className="flex-1 overflow-y-auto space-y-3 pb-2"
        aria-live="polite"
        aria-label="Meddelandetråd"
      >
        {isLoading && (
          <p className="text-sm text-gray-400 text-center py-8">Laddar meddelanden...</p>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            Inga meddelanden ännu.
          </p>
        )}
        {displayMessages(messages).map((msg) => (
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
              {msg.attachmentSignedUrl ? (
                <AttachmentBubble
                  signedUrl={msg.attachmentSignedUrl}
                  isFromSelf={msg.isFromSelf}
                />
              ) : (
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              )}
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
        {/* Attachment preview */}
        {attachedFile && attachmentPreviewUrl && (
          <AttachmentPreview
            previewUrl={attachmentPreviewUrl}
            fileName={attachedFile.name}
            onRemove={handleRemoveAttachment}
            disabled={isUploading}
          />
        )}

        {!attachedFile && (
          <SmartReplyChips
            vars={smartReplyVars}
            onSelect={(text) => {
              if (content.trim()) {
                const prev = content
                setContent(text)
                toast("Snabbsvaret ersatte din text.", {
                  action: { label: "Ångra", onClick: () => setContent(prev) },
                })
              } else {
                setContent(text)
              }
            }}
            disabled={isBusy}
          />
        )}

        {/* Text input — hidden when attachment selected */}
        {!attachedFile && (
          <VoiceTextarea
            value={content}
            onChange={(value) => setContent(value)}
            placeholder="Skriv ett meddelande..."
            className="resize-none"
            rows={2}
            maxLength={2000}
            disabled={isBusy}
          />
        )}

        <div className="flex justify-between items-center gap-2">
          {/* Paperclip button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="text-gray-500 hover:text-gray-900 disabled:opacity-40 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Bifoga bild"
          >
            <Paperclip className="h-5 w-5" aria-hidden />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileSelect}
            aria-hidden
          />

          {!attachedFile && content.length > 1800 && (
            <span className="text-xs text-amber-600 flex-1">{content.length}/2000</span>
          )}

          <Button
            type="button"
            onClick={handleSend}
            disabled={(!content.trim() && !attachedFile) || isBusy}
            size="sm"
            className="min-h-[44px] sm:min-h-0"
          >
            {isUploading ? "Laddar upp..." : isSending ? "Skickar..." : "Skicka"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ThreadSkeleton() {
  return (
    <div className="container mx-auto px-4 py-4 max-w-2xl flex flex-col h-[calc(100dvh-10rem)] animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded bg-gray-200" />
        <div className="space-y-1">
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="h-3 w-20 rounded bg-gray-200" />
        </div>
      </div>
      <div className="flex-1 space-y-3 pb-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
            <div className="h-10 w-48 rounded-lg bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="border-t pt-3 space-y-2">
        <div className="h-16 w-full rounded bg-gray-200" />
        <div className="flex justify-end">
          <div className="h-9 w-20 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

export default function ProviderThreadPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = use(params)

  return (
    <ProviderLayout>
      <Suspense fallback={<ThreadSkeleton />}>
        <ThreadView bookingId={bookingId} />
      </Suspense>
    </ProviderLayout>
  )
}
