"use client"

import { useEffect, useState, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"
import { toast } from "sonner"
import { CustomerLayout } from "@/components/layout/CustomerLayout"

interface Participant {
  id: string
  userId: string
  numberOfHorses: number
  status: string
  horseName: string | null
  horseInfo: string | null
  notes: string | null
  user: { firstName: string }
  horse: { name: string } | null
}

interface GroupBookingDetail {
  id: string
  creatorId: string
  serviceType: string
  locationName: string
  address: string
  dateFrom: string
  dateTo: string
  maxParticipants: number
  status: string
  inviteCode: string
  notes: string | null
  joinDeadline: string | null
  createdAt: string
  participants: Participant[]
  provider: { id: string; businessName: string } | null
  _count: { participants: number }
}

const STATUS_LABELS: Record<string, string> = {
  open: "Öppen",
  matched: "Matchad",
  completed: "Slutförd",
  cancelled: "Avbruten",
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  matched: "bg-blue-100 text-blue-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export default function GroupBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { isLoading: authLoading, isCustomer, user } = useAuth()
  const [groupBooking, setGroupBooking] = useState<GroupBookingDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCopied, setIsCopied] = useState(false)
  const [participantToRemove, setParticipantToRemove] = useState<Participant | null>(null)
  const [participantToLeave, setParticipantToLeave] = useState<Participant | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  useEffect(() => {
    if (!authLoading && !isCustomer) {
      router.push("/login")
    }
  }, [isCustomer, authLoading, router])

  const fetchDetail = useCallback(async () => {
    try {
      const response = await fetch(`/api/group-bookings/${id}`)
      if (response.ok) {
        const data = await response.json()
        setGroupBooking(data)
      } else if (response.status === 404) {
        toast.error("Grupprequest hittades inte")
        router.push("/customer/group-bookings")
      } else {
        toast.error("Kunde inte hämta grupprequest")
      }
    } catch (error) {
      console.error("Error fetching group booking:", error)
      toast.error("Kunde inte hämta grupprequest")
    } finally {
      setIsLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    if (isCustomer) {
      fetchDetail()
    }
  }, [isCustomer, fetchDetail])

  const handleCopyInviteLink = async () => {
    if (!groupBooking) return
    const link = `${window.location.origin}/customer/group-bookings/join?code=${groupBooking.inviteCode}`
    try {
      await navigator.clipboard.writeText(link)
      setIsCopied(true)
      toast.success("Inbjudningslänk kopierad!")
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      // Fallback
      toast.info(`Inbjudningskod: ${groupBooking.inviteCode}`)
    }
  }

  const handleCancel = async () => {
    if (!groupBooking) return
    try {
      const response = await fetch(`/api/group-bookings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })
      if (response.ok) {
        toast.success("Grupprequest avbruten")
        setShowCancelDialog(false)
        fetchDetail()
      } else {
        toast.error("Kunde inte avbryta")
      }
    } catch {
      toast.error("Kunde inte avbryta")
    }
  }

  const handleLeave = async (participantId: string) => {
    try {
      const response = await fetch(
        `/api/group-bookings/${id}/participants/${participantId}`,
        { method: "DELETE" }
      )
      if (response.ok) {
        toast.success("Du har lämnat grupprequesten")
        setParticipantToLeave(null)
        fetchDetail()
      } else {
        toast.error("Kunde inte lämna grupprequesten")
      }
    } catch {
      toast.error("Kunde inte lämna grupprequesten")
    }
  }

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      const response = await fetch(
        `/api/group-bookings/${id}/participants/${participantId}`,
        { method: "DELETE" }
      )
      if (response.ok) {
        toast.success("Deltagaren har tagits bort")
        setParticipantToRemove(null)
        fetchDetail()
      } else {
        toast.error("Kunde inte ta bort deltagaren")
      }
    } catch {
      toast.error("Kunde inte ta bort deltagaren")
    }
  }

  if (authLoading || !isCustomer) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </CustomerLayout>
    )
  }

  if (isLoading || !groupBooking) {
    return (
      <CustomerLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Laddar grupprequest...</p>
        </div>
      </CustomerLayout>
    )
  }

  const isCreator = groupBooking.creatorId === user?.id
  const myParticipation = groupBooking.participants.find(
    (p) => p.userId === user?.id
  )
  const isOpen = groupBooking.status === "open"

  return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{groupBooking.serviceType}</h1>
            <p className="text-gray-600">{groupBooking.locationName}</p>
          </div>
          <Badge className={STATUS_COLORS[groupBooking.status] || "bg-gray-100"}>
            {STATUS_LABELS[groupBooking.status] || groupBooking.status}
          </Badge>
        </div>

        {/* Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Detaljer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Adress:</span>
                <p className="font-medium">{groupBooking.address}</p>
              </div>
              <div>
                <span className="text-gray-500">Period:</span>
                <p className="font-medium">
                  {formatDate(groupBooking.dateFrom)} &ndash;{" "}
                  {formatDate(groupBooking.dateTo)}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Deltagare:</span>
                <p className="font-medium">
                  {groupBooking._count.participants} / {groupBooking.maxParticipants}
                </p>
              </div>
              {groupBooking.provider && (
                <div>
                  <span className="text-gray-500">Leverantör:</span>
                  <p className="font-medium">{groupBooking.provider.businessName}</p>
                </div>
              )}
            </div>
            {groupBooking.notes && (
              <div className="pt-2 border-t text-sm">
                <span className="text-gray-500">Anteckningar:</span>
                <p className="mt-1">{groupBooking.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invite code (only if open) */}
        {isOpen && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-800 font-medium">Inbjudningskod</p>
                  <p className="text-2xl font-mono font-bold text-green-900 tracking-wider">
                    {groupBooking.inviteCode}
                  </p>
                </div>
                <Button
                  onClick={handleCopyInviteLink}
                  variant="outline"
                  className="border-green-300"
                >
                  {isCopied ? "Kopierad!" : "Kopiera länk"}
                </Button>
              </div>
              <p className="text-xs text-green-700 mt-2">
                Dela koden eller länken med de som ska vara med.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Participants */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Deltagare</CardTitle>
            <CardDescription>
              {groupBooking._count.participants} av {groupBooking.maxParticipants} platser
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {groupBooking.participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {p.user.firstName}
                      {p.userId === groupBooking.creatorId && (
                        <span className="text-xs text-gray-500 ml-2">(skapare)</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {p.numberOfHorses} {p.numberOfHorses === 1 ? "häst" : "hästar"}
                      {p.horse && ` - ${p.horse.name}`}
                      {!p.horse && p.horseName && ` - ${p.horseName}`}
                    </p>
                    {p.notes && (
                      <p className="text-xs text-gray-400 mt-1">{p.notes}</p>
                    )}
                  </div>
                  {/* Actions */}
                  <div>
                    {isCreator && p.userId !== user?.id && isOpen && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] sm:min-h-0 text-red-600"
                        onClick={() => setParticipantToRemove(p)}
                      >
                        Ta bort
                      </Button>
                    )}
                    {!isCreator && p.userId === user?.id && isOpen && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] sm:min-h-0 text-red-600"
                        onClick={() => setParticipantToLeave(p)}
                      >
                        Lämna
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/customer/group-bookings")}
          >
            Tillbaka
          </Button>
          {isCreator && isOpen && (
            <Button
              variant="outline"
              className="text-red-600 border-red-200"
              onClick={() => setShowCancelDialog(true)}
            >
              Avbryt grupprequest
            </Button>
          )}
        </div>

        {/* Remove participant dialog */}
        {participantToRemove && (
          <ResponsiveAlertDialog
            open={true}
            onOpenChange={(open) => { if (!open) setParticipantToRemove(null) }}
          >
            <ResponsiveAlertDialogContent>
              <ResponsiveAlertDialogHeader>
                <ResponsiveAlertDialogTitle>Ta bort {participantToRemove.user.firstName}?</ResponsiveAlertDialogTitle>
                <ResponsiveAlertDialogDescription>
                  Deltagaren tas bort från grupprequesten. De kan gå med igen om de vill.
                </ResponsiveAlertDialogDescription>
              </ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogFooter>
                <ResponsiveAlertDialogCancel onClick={() => setParticipantToRemove(null)}>Avbryt</ResponsiveAlertDialogCancel>
                <ResponsiveAlertDialogAction
                  onClick={() => handleRemoveParticipant(participantToRemove.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Ta bort
                </ResponsiveAlertDialogAction>
              </ResponsiveAlertDialogFooter>
            </ResponsiveAlertDialogContent>
          </ResponsiveAlertDialog>
        )}

        {/* Leave group dialog */}
        {participantToLeave && (
          <ResponsiveAlertDialog
            open={true}
            onOpenChange={(open) => { if (!open) setParticipantToLeave(null) }}
          >
            <ResponsiveAlertDialogContent>
              <ResponsiveAlertDialogHeader>
                <ResponsiveAlertDialogTitle>Lämna grupprequesten?</ResponsiveAlertDialogTitle>
                <ResponsiveAlertDialogDescription>
                  Du kan gå med igen via inbjudningskoden om du ändrar dig.
                </ResponsiveAlertDialogDescription>
              </ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogFooter>
                <ResponsiveAlertDialogCancel onClick={() => setParticipantToLeave(null)}>Avbryt</ResponsiveAlertDialogCancel>
                <ResponsiveAlertDialogAction
                  onClick={() => handleLeave(participantToLeave.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Lämna
                </ResponsiveAlertDialogAction>
              </ResponsiveAlertDialogFooter>
            </ResponsiveAlertDialogContent>
          </ResponsiveAlertDialog>
        )}

        {/* Cancel group booking dialog */}
        {showCancelDialog && (
          <ResponsiveAlertDialog open={true} onOpenChange={setShowCancelDialog}>
            <ResponsiveAlertDialogContent>
              <ResponsiveAlertDialogHeader>
                <ResponsiveAlertDialogTitle>Avbryt grupprequesten?</ResponsiveAlertDialogTitle>
                <ResponsiveAlertDialogDescription>
                  Alla deltagare kommer att meddelas. Denna åtgärd kan inte ångras.
                </ResponsiveAlertDialogDescription>
              </ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogFooter>
                <ResponsiveAlertDialogCancel onClick={() => setShowCancelDialog(false)}>Behåll</ResponsiveAlertDialogCancel>
                <ResponsiveAlertDialogAction
                  onClick={handleCancel}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Avbryt grupprequest
                </ResponsiveAlertDialogAction>
              </ResponsiveAlertDialogFooter>
            </ResponsiveAlertDialogContent>
          </ResponsiveAlertDialog>
        )}
      </div>
    </CustomerLayout>
  )
}
