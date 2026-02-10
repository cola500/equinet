"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog"
import { StarRating } from "./StarRating"
import { toast } from "sonner"

interface ReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  serviceName: string
  providerName: string
  // For editing an existing review
  existingReview?: {
    id: string
    rating: number
    comment: string | null
  }
  onSuccess: () => void
}

export function ReviewDialog({
  open,
  onOpenChange,
  bookingId,
  serviceName,
  providerName,
  existingReview,
  onSuccess,
}: ReviewDialogProps) {
  const [rating, setRating] = useState(existingReview?.rating || 0)
  const [comment, setComment] = useState(existingReview?.comment || "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!existingReview

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      toast.error("Välj ett betyg (1-5 stjärnor)")
      return
    }

    setIsSubmitting(true)
    try {
      const url = isEditing
        ? `/api/reviews/${existingReview.id}`
        : "/api/reviews"
      const method = isEditing ? "PUT" : "POST"

      const body = isEditing
        ? { rating, comment: comment || undefined }
        : { bookingId, rating, comment: comment || undefined }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte spara recension")
      }

      toast.success(isEditing ? "Recension uppdaterad!" : "Tack för din recension!")
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Något gick fel")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isEditing ? "Redigera recension" : "Lämna recension"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {serviceName} hos {providerName}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Star Rating */}
          <div className="space-y-2">
            <Label>Betyg *</Label>
            <StarRating rating={rating} onChange={setRating} size="lg" />
            {rating > 0 && (
              <p className="text-sm text-gray-500">
                {rating === 1 && "Dålig"}
                {rating === 2 && "Inte bra"}
                {rating === 3 && "Okej"}
                {rating === 4 && "Bra"}
                {rating === 5 && "Utmärkt"}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="review-comment">
              Kommentar <span className="text-gray-400">(valfritt)</span>
            </Label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Beskriv din upplevelse..."
            />
            <p className="text-xs text-gray-400 text-right">
              {comment.length}/500
            </p>
          </div>

          {/* Actions */}
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || rating === 0}
            >
              {isSubmitting
                ? "Sparar..."
                : isEditing
                  ? "Uppdatera"
                  : "Skicka recension"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
