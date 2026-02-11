"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

// --- Types ---

interface VerificationImage {
  id: string
  url: string
  mimeType: string
}

interface PendingVerification {
  id: string
  type: string
  title: string
  description: string | null
  issuer: string | null
  year: number | null
  status: string
  createdAt: string
  provider: {
    businessName: string
  }
  images: VerificationImage[]
}

// --- Constants ---

const TYPE_LABELS: Record<string, string> = {
  education: "Utbildning",
  organization: "Organisation",
  certificate: "Certifikat",
  experience: "Erfarenhet",
  license: "Licens",
}

// --- Page ---

export default function AdminVerificationsPage() {
  const router = useRouter()
  const { isLoading: authLoading } = useAuth()

  const [verifications, setVerifications] = useState<PendingVerification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/verification-requests")
      if (response.ok) {
        const data = await response.json()
        setVerifications(data)
      } else if (response.status === 403) {
        toast.error("Du har inte admin-behörighet")
        router.push("/")
      }
    } catch {
      toast.error("Kunde inte hämta ansökningar")
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!authLoading) {
      fetchPending()
    }
  }, [authLoading, fetchPending])

  const handleReview = async (id: string, action: "approve" | "reject") => {
    setProcessing(id)
    try {
      const response = await fetch(
        `/api/admin/verification-requests/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            reviewNote: reviewNotes[id] || undefined,
          }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Kunde inte behandla ansökan")
      }

      toast.success(
        action === "approve"
          ? "Ansökan godkänd!"
          : "Ansökan avvisad."
      )
      fetchPending()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte behandla ansökan"
      )
    } finally {
      setProcessing(null)
    }
  }

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold mb-2">Verifieringsansökningar</h1>
      <p className="text-gray-600 mb-8">
        Granska och godkänn eller avvisa leverantörers verifieringsansökningar.
      </p>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
          <p className="mt-2 text-gray-600">Laddar ansökningar...</p>
        </div>
      ) : verifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">
              Inga väntande ansökningar att granska.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {verifications.map((ver) => (
            <Card key={ver.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{ver.title}</CardTitle>
                    <CardDescription>
                      {ver.provider.businessName} &middot;{" "}
                      {TYPE_LABELS[ver.type] || ver.type}
                      {ver.issuer && ` - ${ver.issuer}`}
                      {ver.year && ` (${ver.year})`}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                    Väntar
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {ver.description && (
                  <p className="text-sm text-gray-600 mb-4">
                    {ver.description}
                  </p>
                )}

                {/* Images */}
                {ver.images && ver.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {ver.images.map((img) => (
                      <img
                        key={img.id}
                        src={img.url}
                        alt="Verifieringsbild"
                        className="w-24 h-24 object-cover rounded cursor-pointer border border-gray-200 hover:opacity-80 transition-opacity"
                        onClick={() => setLightboxImage(img.url)}
                      />
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-400 mb-4">
                  Skickad{" "}
                  {new Date(ver.createdAt).toLocaleDateString("sv-SE")}
                </p>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor={`note-${ver.id}`}>
                      Kommentar (valfritt)
                    </Label>
                    <Textarea
                      id={`note-${ver.id}`}
                      value={reviewNotes[ver.id] || ""}
                      onChange={(e) =>
                        setReviewNotes({
                          ...reviewNotes,
                          [ver.id]: e.target.value,
                        })
                      }
                      placeholder="Valfri kommentar till leverantören..."
                      rows={2}
                      maxLength={500}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleReview(ver.id, "approve")}
                      disabled={processing === ver.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processing === ver.id
                        ? "Behandlar..."
                        : "Godkänn"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleReview(ver.id, "reject")}
                      disabled={processing === ver.id}
                      className="text-red-600 hover:text-red-700"
                    >
                      Avvisa
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image Lightbox */}
      <Dialog open={lightboxImage !== null} onOpenChange={(open) => !open && setLightboxImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Bild</DialogTitle>
          </DialogHeader>
          {lightboxImage && (
            <img
              src={lightboxImage}
              alt="Verifieringsbild"
              className="w-full h-auto rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
