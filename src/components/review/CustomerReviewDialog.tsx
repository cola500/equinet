"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StarRating } from "./StarRating"
import { toast } from "sonner"

interface CustomerReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  customerName: string
  serviceName: string
  onSuccess: () => void
}

export function CustomerReviewDialog({
  open,
  onOpenChange,
  bookingId,
  customerName,
  serviceName,
  onSuccess,
}: CustomerReviewDialogProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      toast.error("Välj ett betyg (1-5 stjärnor)")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/customer-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          rating,
          comment: comment || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte spara recension")
      }

      toast.success("Recension skickad!")
      setRating(0)
      setComment("")
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Något gick fel")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recensera kund</DialogTitle>
          <DialogDescription>
            {customerName} - {serviceName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="customer-review-comment">
              Kommentar <span className="text-gray-400">(valfritt)</span>
            </Label>
            <Textarea
              id="customer-review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Beskriv din upplevelse av kunden..."
            />
            <p className="text-xs text-gray-400 text-right">
              {comment.length}/500
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isSubmitting || rating === 0}>
              {isSubmitting ? "Sparar..." : "Skicka recension"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
