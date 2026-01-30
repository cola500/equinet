"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProviderLayout } from "@/components/layout/ProviderLayout"
import { ReviewList } from "@/components/review/ReviewList"
import { StarRating } from "@/components/review/StarRating"
import { toast } from "sonner"

export default function ProviderReviewsPage() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const [providerId, setProviderId] = useState<string | null>(null)
  const [reviewStats, setReviewStats] = useState<{
    averageRating: number | null
    totalCount: number
  }>({ averageRating: null, totalCount: 0 })
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [replyingToReview, setReplyingToReview] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)
  const [reviewListKey, setReviewListKey] = useState(0)

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  useEffect(() => {
    if (isProvider) {
      fetchData()
    }
  }, [isProvider])

  const fetchData = async () => {
    setIsLoadingData(true)
    try {
      const profileRes = await fetch("/api/profile")
      if (!profileRes.ok) return
      const profile = await profileRes.json()
      if (!profile.providerId) return

      setProviderId(profile.providerId)

      const reviewsRes = await fetch(`/api/providers/${profile.providerId}/reviews?limit=1`)
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
  }

  const handleDeleteReply = async (reviewId: string) => {
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
  }

  if (isLoading || !isProvider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
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

      {isLoadingData ? (
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
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
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
