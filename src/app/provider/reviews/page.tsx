"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useProviderProfile } from "@/hooks/useProviderProfile"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { VoiceTextarea } from "@/components/ui/voice-textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { GenericListSkeleton } from "@/components/loading/GenericListSkeleton"
import { ReviewList } from "@/components/review/ReviewList"
import { StarRating } from "@/components/review/StarRating"
import { toast } from "sonner"
import { useOfflineGuard } from "@/hooks/useOfflineGuard"

export default function ProviderReviewsPage() {
  const { isLoading, isProvider } = useAuth()
  const { providerId, isLoading: isLoadingProfile } = useProviderProfile()
  const [reviewStats, setReviewStats] = useState<{
    averageRating: number | null
    totalCount: number
  }>({ averageRating: null, totalCount: 0 })
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [replyingToReview, setReplyingToReview] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [reviewListKey, setReviewListKey] = useState(0)
  const { guardMutation } = useOfflineGuard()

  /* eslint-disable react-hooks/exhaustive-deps -- fetchReviewStats reads providerId from closure; runs when providerId becomes available */
  useEffect(() => {
    if (providerId) {
      fetchReviewStats()
    }
  }, [providerId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchReviewStats = async () => {
    if (!providerId) return
    setIsLoadingData(true)
    try {
      const reviewsRes = await fetch(`/api/providers/${providerId}/reviews?limit=1`)
      if (reviewsRes.ok) {
        const data = await reviewsRes.json()
        setReviewStats({
          averageRating: data.averageRating,
          totalCount: data.totalCount,
        })
      }
    } catch (error) {
      console.error("Error fetching review data:", error)
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleSubmitReply = async () => {
    if (!replyingToReview || !replyText.trim()) return

    await guardMutation(async () => {
      setIsSubmittingReply(true)
      try {
        const response = await fetch(`/api/reviews/${replyingToReview}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reply: replyText }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Kunde inte skicka svar")
        }

        toast.success("Svar skickat!")
        setReplyingToReview(null)
        setReplyText("")
        setReviewListKey((k) => k + 1)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Något gick fel")
      } finally {
        setIsSubmittingReply(false)
      }
    })
  }

  const handleDeleteReply = async (reviewId: string) => {
    await guardMutation(async () => {
      try {
        const response = await fetch(`/api/reviews/${reviewId}/reply`, {
          method: "DELETE",
        })
        if (!response.ok) {
          throw new Error("Kunde inte ta bort svar")
        }
        toast.success("Svar borttaget")
        setReviewListKey((k) => k + 1)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Något gick fel")
      }
    })
  }

  if (isLoading || !isProvider) {
    return (
      <ProviderLayout>
        <GenericListSkeleton />
      </ProviderLayout>
    )
  }

  return (
    <ProviderLayout>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold">Recensioner</h1>
          <p className="text-gray-600 mt-1">
            Se vad dina kunder tycker om dina tjänster
          </p>
        </div>
        {reviewStats.totalCount > 0 && reviewStats.averageRating !== null && (
          <div className="text-right">
            <div className="flex items-center gap-2">
              <StarRating rating={Math.round(reviewStats.averageRating)} readonly size="md" />
              <span className="text-2xl font-bold">{reviewStats.averageRating.toFixed(1)}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {reviewStats.totalCount} {reviewStats.totalCount === 1 ? "recension" : "recensioner"}
            </p>
          </div>
        )}
      </div>

      {(isLoadingData || isLoadingProfile) ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar recensioner...</p>
        </div>
      ) : providerId ? (
        <ReviewList
          key={reviewListKey}
          providerId={providerId}
          showReplyActions
          onReply={(reviewId) => {
            setReplyingToReview(reviewId)
            setReplyText("")
          }}
          onDeleteReply={handleDeleteReply}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Kunde inte ladda recensioner.
          </CardContent>
        </Card>
      )}

      {/* Reply Dialog */}
      <Dialog open={!!replyingToReview} onOpenChange={(open) => { if (!open) setReplyingToReview(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Svara på recension</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <VoiceTextarea
              value={replyText}
              onChange={(value) => setReplyText(value)}
              rows={3}
              maxLength={500}
              placeholder="Skriv ditt svar..."
            />
            <p className="text-xs text-gray-400 text-right">{replyText.length}/500</p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setReplyingToReview(null)}
                disabled={isSubmittingReply}
              >
                Avbryt
              </Button>
              <Button
                onClick={handleSubmitReply}
                disabled={isSubmittingReply || !replyText.trim()}
              >
                {isSubmittingReply ? "Skickar..." : "Skicka svar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProviderLayout>
  )
}
