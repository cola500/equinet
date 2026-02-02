"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import imageCompression from "browser-image-compression"

interface ImageUploadProps {
  bucket: "avatars" | "horses" | "services" | "verifications"
  entityId: string
  currentUrl?: string | null
  onUploaded: (url: string) => void
  className?: string
  /** "default" = rectangular with text, "square" = compact square, "circle" = compact round */
  variant?: "default" | "square" | "circle"
}

const MAX_COMPRESSED_SIZE = 1024 * 1024 // 1MB after compression

export function ImageUpload({
  bucket,
  entityId,
  currentUrl,
  onUploaded,
  className = "",
  variant = "default",
}: ImageUploadProps) {
  const isCompact = variant === "square" || variant === "circle"
  const shapeClass = variant === "circle" ? "rounded-full" : "rounded-lg"
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl || null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      // Client-side validation
      if (!file.type.startsWith("image/")) {
        toast.error("Bara bilder (JPEG, PNG, WebP) tillåtna")
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Filen ar for stor. Max 5MB.")
        return
      }

      setIsUploading(true)

      try {
        // Client-side compression
        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        })

        // Show preview immediately
        const reader = new FileReader()
        reader.onload = (e) => setPreview(e.target?.result as string)
        reader.readAsDataURL(compressed)

        // Upload to server
        const formData = new FormData()
        formData.append("file", compressed, file.name)
        formData.append("bucket", bucket)
        formData.append("entityId", entityId)

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Uppladdning misslyckades")
        }

        const data = await response.json()
        setPreview(data.url)
        onUploaded(data.url)
        toast.success("Bilden har laddats upp!")
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Uppladdning misslyckades"
        )
        // Revert preview on error
        setPreview(currentUrl || null)
      } finally {
        setIsUploading(false)
      }
    },
    [bucket, entityId, currentUrl, onUploaded]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className={className}>
      <div
        className={`relative border-2 border-dashed ${shapeClass} text-center transition-colors cursor-pointer ${
          isCompact ? "aspect-square overflow-hidden" : "p-4"
        } ${
          isDragging
            ? "border-green-500 bg-green-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {preview ? (
          <div className="relative h-full">
            <img
              src={preview}
              alt="Forhandsvisning"
              className={`object-cover ${
                isCompact
                  ? `w-full h-full ${shapeClass}`
                  : "mx-auto max-h-48 rounded"
              }`}
            />
            {isUploading && (
              <div className={`absolute inset-0 bg-white/60 flex items-center justify-center ${shapeClass}`}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
              </div>
            )}
          </div>
        ) : (
          <div className={`flex flex-col items-center justify-center ${isCompact ? "h-full p-1" : "py-8"}`}>
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2" />
                {!isCompact && <p className="text-sm text-gray-500">Laddar upp...</p>}
              </>
            ) : isCompact ? (
              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-1">
                  Dra en bild hit eller klicka for att valja
                </p>
                <p className="text-xs text-gray-400">
                  JPEG, PNG eller WebP. Max 5MB.
                </p>
              </>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleInputChange}
          className="hidden"
          disabled={isUploading}
        />
      </div>

      {preview && !isUploading && !isCompact && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-gray-500"
          onClick={(e) => {
            e.stopPropagation()
            inputRef.current?.click()
          }}
        >
          Byt bild
        </Button>
      )}
    </div>
  )
}
