"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
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
  /** Allow PDF uploads in addition to images */
  allowPdf?: boolean
}

const _MAX_COMPRESSED_SIZE = 1024 * 1024 // 1MB after compression

export function ImageUpload({
  bucket,
  entityId,
  currentUrl,
  onUploaded,
  className = "",
  variant = "default",
  allowPdf = false,
}: ImageUploadProps) {
  const isCompact = variant === "square" || variant === "circle"
  const shapeClass = variant === "circle" ? "rounded-full" : "rounded-lg"
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl || null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      const isPdf = file.type === "application/pdf"

      // Client-side validation
      if (!file.type.startsWith("image/") && !(allowPdf && isPdf)) {
        toast.error(
          allowPdf
            ? "Bara bilder (JPEG, PNG, WebP) och PDF tillåtna"
            : "Bara bilder (JPEG, PNG, WebP) tillåtna"
        )
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Filen ar for stor. Max 5MB.")
        return
      }

      setIsUploading(true)

      try {
        let fileToUpload: File | Blob = file

        if (isPdf) {
          // PDF: use "pdf" as preview marker, skip compression
          setPreview("pdf")
        } else {
          // Image: compress and show preview
          fileToUpload = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
          })
          const reader = new FileReader()
          reader.onload = (e) => setPreview(e.target?.result as string)
          reader.readAsDataURL(fileToUpload as Blob)
        }

        // Upload to server
        const formData = new FormData()
        formData.append("file", fileToUpload, file.name)
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
        setPreview(isPdf ? "pdf" : data.url)
        onUploaded(data.url)
        toast.success(isPdf ? "PDF har laddats upp!" : "Bilden har laddats upp!")
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
    [bucket, entityId, currentUrl, onUploaded, allowPdf]
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
            {preview === "pdf" ? (
              <div className={`flex flex-col items-center justify-center ${isCompact ? "h-full" : "py-6"}`}>
                <svg className="h-10 w-10 text-red-500 mb-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8.5 13H10v4.5H8.5V13zm3 0h2c.83 0 1.5.67 1.5 1.5v1.5c0 .83-.67 1.5-1.5 1.5h-2V13zm6 0H19v1h-1v1h1v1h-1.5v1.5H16V13z" />
                </svg>
                {!isCompact && <p className="text-xs text-gray-500">PDF uppladdad</p>}
              </div>
            ) : (
              <Image
                src={preview}
                alt="Forhandsvisning"
                width={192}
                height={192}
                className={`object-cover ${
                  isCompact
                    ? `w-full h-full ${shapeClass}`
                    : "mx-auto max-h-48 rounded"
                }`}
                unoptimized
              />
            )}
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
                  {allowPdf
                    ? "Dra en fil hit eller klicka for att valja"
                    : "Dra en bild hit eller klicka for att valja"}
                </p>
                <p className="text-xs text-gray-400">
                  {allowPdf
                    ? "JPEG, PNG, WebP eller PDF. Max 5MB."
                    : "JPEG, PNG eller WebP. Max 5MB."}
                </p>
              </>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={allowPdf ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp"}
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
          Byt fil
        </Button>
      )}
    </div>
  )
}
