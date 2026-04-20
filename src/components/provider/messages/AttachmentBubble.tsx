"use client"

import { useState } from "react"
import { X, ImageOff } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

// -----------------------------------------------------------
// AttachmentPreview — fil vald men ej skickad ännu
// -----------------------------------------------------------

interface AttachmentPreviewProps {
  previewUrl: string
  fileName: string
  onRemove: () => void
  disabled?: boolean
}

export function AttachmentPreview({
  previewUrl,
  fileName,
  onRemove,
  disabled,
}: AttachmentPreviewProps) {
  return (
    <div className="relative inline-block">
      <img
        src={previewUrl}
        alt={fileName}
        className="h-20 w-20 object-cover rounded-lg border border-gray-200"
      />
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Ta bort bild"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
  )
}

// -----------------------------------------------------------
// AttachmentBubble — bild i tråden (thumbnail → fullskärm)
// -----------------------------------------------------------

interface AttachmentBubbleProps {
  signedUrl: string
  isFromSelf: boolean
}

export function AttachmentBubble({ signedUrl, isFromSelf }: AttachmentBubbleProps) {
  const [open, setOpen] = useState(false)
  const [imgError, setImgError] = useState(false)

  if (imgError) {
    return (
      <button
        type="button"
        onClick={() => setImgError(false)}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-left min-h-[44px] ${
          isFromSelf ? "bg-green-700 text-green-200" : "bg-gray-200 text-gray-500"
        }`}
        aria-label="Bilden kunde inte laddas — tryck för att försöka igen"
      >
        <ImageOff className="h-4 w-4 flex-shrink-0" aria-hidden />
        <span>Bilden kunde inte laddas</span>
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[44px] min-w-[44px]"
        aria-label="Visa bild i fullskärm"
      >
        <img
          src={signedUrl}
          alt="Bifogad bild"
          className="max-h-48 max-w-full object-cover rounded-lg"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </button>

      <ImageFullscreenModal
        open={open}
        onClose={() => setOpen(false)}
        signedUrl={signedUrl}
      />
    </>
  )
}

// -----------------------------------------------------------
// ImageFullscreenModal — full bild i dialog
// -----------------------------------------------------------

interface ImageFullscreenModalProps {
  open: boolean
  onClose: () => void
  signedUrl: string
}

export function ImageFullscreenModal({
  open,
  onClose,
  signedUrl,
}: ImageFullscreenModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-3xl p-2 flex flex-col items-center gap-2">
        <DialogTitle className="sr-only">Bifogad bild</DialogTitle>
        <img
          src={signedUrl}
          alt="Bifogad bild"
          className="max-h-[80vh] max-w-full object-contain rounded"
        />
      </DialogContent>
    </Dialog>
  )
}
