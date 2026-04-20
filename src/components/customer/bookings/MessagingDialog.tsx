"use client"

import { useState, useEffect, useRef } from "react"
import useSWR from "swr"
import { Paperclip } from "lucide-react"
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
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const readCalledRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  }, [data?.messages.at(-1)?.id])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl)
    }
  }, [attachmentPreviewUrl])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset input so same file can be reselected
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
      clientLogger.error("MessagingDialog: upload failed", err as Error)
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
        senderType: "CUSTOMER",
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
  const isBusy = isSending || isUploading

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
                  <p className="text-xs font-medium mb-1 text-gray-600">
                    {msg.senderName}
                  </p>
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
        <div className="border-t px-4 py-3 space-y-2">
          {/* Attachment preview */}
          {attachedFile && attachmentPreviewUrl && (
            <AttachmentPreview
              previewUrl={attachmentPreviewUrl}
              fileName={attachedFile.name}
              onRemove={handleRemoveAttachment}
              disabled={isUploading}
            />
          )}

          {/* Text input — hidden when attachment selected */}
          {!attachedFile && (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Skriv ett meddelande..."
              className="resize-none"
              rows={3}
              maxLength={2000}
              disabled={isBusy}
              aria-label="Meddelande"
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
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
