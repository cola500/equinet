"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StarRating } from "./StarRating"
import { format } from "date-fns"
import { sv } from "date-fns/locale"

interface Review {
  id: string
  rating: number
  comment: string | null
  reply: string | null
  repliedAt: string | null
  createdAt: string
  customer: {
    firstName: string
    lastName: string
  }
  booking: {
    service: {
      name: string
    }
  }
}

interface ReviewListProps {
  providerId: string
  /** If provided, shows reply actions for the provider */
  showReplyActions?: boolean
  onReply?: (reviewId: string) => void
  onDeleteReply?: (reviewId: string) => void
}

export function ReviewList({
  providerId,
  showReplyActions = false,
  onReply,
  onDeleteReply,
}: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [averageRating, setAverageRating] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const limit = 10

  useEffect(() => {
    fetchReviews()
  }, [providerId, page])

  const fetchReviews = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      const response = await fetch(`/api/providers/${providerId}/reviews?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (page === 1) {
          setReviews(data.reviews)
        } else {
          setReviews((prev) => [...prev, ...data.reviews])
        }
        setTotalCount(data.totalCount)
        setAverageRating(data.averageRating)
      }
    } catch (error) {
      console.error("Error fetching reviews:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Refresh reviews (e.g., after reply)
  const refresh = () => {
    setPage(1)
    fetchReviews()
  }

  // Expose refresh for parent
  useEffect(() => {
    // Re-fetch when page resets to 1 (after reply/delete)
  }, [])

  const hasMore = reviews.length < totalCount

  if (isLoading && reviews.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Laddar recensioner...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Summary */}
      {totalCount > 0 && averageRating !== null && (
        <div className="flex items-center gap-3 mb-4">
          <StarRating rating={Math.round(averageRating)} readonly size="md" />
          <span className="text-lg font-semibold">
            {averageRating.toFixed(1)} / 5
          </span>
          <span className="text-gray-500">
            ({totalCount} {totalCount === 1 ? "recension" : "recensioner"})
          </span>
        </div>
      )}

      {/* Review cards */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            Inga recensioner ännu.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">
                      {review.customer.firstName} {review.customer.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {review.booking.service.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <StarRating rating={review.rating} readonly size="sm" />
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(review.createdAt), "d MMM yyyy", { locale: sv })}
                    </p>
                  </div>
                </div>

                {/* Comment */}
                {review.comment && (
                  <p className="text-gray-700 mt-2">{review.comment}</p>
                )}

                {/* Provider reply */}
                {review.reply && (
                  <div className="mt-3 pl-4 border-l-2 border-green-300 bg-green-50 p-3 rounded-r">
                    <p className="text-sm font-medium text-green-800 mb-1">
                      Svar från leverantören
                    </p>
                    <p className="text-sm text-green-700">{review.reply}</p>
                    {review.repliedAt && (
                      <p className="text-xs text-green-500 mt-1">
                        {format(new Date(review.repliedAt), "d MMM yyyy", { locale: sv })}
                      </p>
                    )}
                    {showReplyActions && onDeleteReply && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 text-red-600 hover:text-red-700 h-7 px-2"
                        onClick={() => onDeleteReply(review.id)}
                      >
                        Ta bort svar
                      </Button>
                    )}
                  </div>
                )}

                {/* Reply action for provider */}
                {showReplyActions && !review.reply && onReply && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReply(review.id)}
                    >
                      Svara
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={isLoading}
          >
            {isLoading ? "Laddar..." : "Visa fler recensioner"}
          </Button>
        </div>
      )}
    </div>
  )
}
