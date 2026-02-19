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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog"
import { toast } from "sonner"
import { ProviderLayout } from "@/components/layout/ProviderLayout"

interface Participant {
  id: string
  userId: string
  numberOfHorses: number
  status: string
  horseName: string | null
  notes: string | null
  user: { firstName: string }
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
  notes: string | null
  participants: Participant[]
  provider: { id: string; businessName: string } | null
  _count: { participants: number }
}

interface ProviderService {
  id: string
  name: string
  durationMinutes: number
  price: number
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

export default function ProviderGroupBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { isLoading: authLoading, isProvider } = useAuth()
  const [groupBooking, setGroupBooking] = useState<GroupBookingDetail | null>(null)
  const [services, setServices] = useState<ProviderService[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [matchDialogOpen, setMatchDialogOpen] = useState(false)
  const [isMatching, setIsMatching] = useState(false)

  const [matchForm, setMatchForm] = useState({
    serviceId: "",
    bookingDate: "",
    startTime: "09:00",
  })

  useEffect(() => {
    if (!authLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, authLoading, router])

  const fetchDetail = useCallback(async () => {
    try {
      const response = await fetch(`/api/group-bookings/${id}`)
      if (response.ok) {
        const data = await response.json()
        setGroupBooking(data)
      } else {
        toast.error("Kunde inte hämta grupprequest")
        router.push("/provider/group-bookings")
      }
    } catch (error) {
      console.error("Error fetching group booking:", error)
      toast.error("Kunde inte hämta grupprequest")
    } finally {
      setIsLoading(false)
    }
  }, [id, router])

  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch("/api/services")
      if (response.ok) {
        const data = await response.json()
        setServices(data)
      }
    } catch (error) {
      console.error("Error fetching services:", error)
    }
  }, [])

  useEffect(() => {
    if (isProvider) {
      fetchDetail()
      fetchServices()
    }
  }, [isProvider, fetchDetail, fetchServices])

  const handleMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsMatching(true)

    try {
      const response = await fetch(`/api/group-bookings/${id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: matchForm.serviceId,
          bookingDate: new Date(matchForm.bookingDate).toISOString(),
          startTime: matchForm.startTime,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Matchning misslyckades")
      }

      toast.success(`${data.bookingsCreated} bokningar skapade!`)
      setMatchDialogOpen(false)
      fetchDetail()
    } catch (error) {
      console.error("Error matching:", error)
      toast.error(
        error instanceof Error ? error.message : "Matchning misslyckades"
      )
    } finally {
      setIsMatching(false)
    }
  }

  if (authLoading || !isProvider) {
    return (
      <ProviderLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Laddar...</p>
          </div>
        </div>
      </ProviderLayout>
    )
  }

  if (isLoading || !groupBooking) {
    return (
      <ProviderLayout>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Laddar grupprequest...</p>
        </div>
      </ProviderLayout>
    )
  }

  const totalHorses = groupBooking.participants.reduce(
    (sum, p) => sum + p.numberOfHorses,
    0
  )
  const isOpen = groupBooking.status === "open"

  // Calculate time slots for the match dialog preview
  const selectedService = services.find((s) => s.id === matchForm.serviceId)
  const timeSlots =
    selectedService && matchForm.startTime
      ? (() => {
          const slots: string[] = []
          const [hours, minutes] = matchForm.startTime.split(":").map(Number)
          let currentMinutes = hours * 60 + minutes
          const participantCount = groupBooking._count.participants
          for (let i = 0; i < participantCount; i++) {
            const startH = Math.floor(currentMinutes / 60)
            const startM = currentMinutes % 60
            const endMinutes = currentMinutes + selectedService.durationMinutes
            const endH = Math.floor(endMinutes / 60)
            const endM = endMinutes % 60
            slots.push(
              `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}-${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`
            )
            currentMinutes = endMinutes
          }
          const endH = Math.floor(currentMinutes / 60)
          const endM = currentMinutes % 60
          return {
            slots,
            endTime: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
          }
        })()
      : null

  return (
    <ProviderLayout>
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
                  {groupBooking._count.participants} st ({totalHorses} hästar)
                </p>
              </div>
            </div>
            {groupBooking.notes && (
              <div className="pt-2 border-t text-sm">
                <span className="text-gray-500">Anteckningar:</span>
                <p className="mt-1">{groupBooking.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Participants */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Deltagare</CardTitle>
            <CardDescription>
              {groupBooking._count.participants} deltagare, {totalHorses} hästar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {groupBooking.participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{p.user.firstName}</p>
                    <p className="text-sm text-gray-500">
                      {p.numberOfHorses} {p.numberOfHorses === 1 ? "häst" : "hästar"}
                      {p.horseName && ` - ${p.horseName}`}
                    </p>
                    {p.notes && (
                      <p className="text-xs text-gray-400 mt-1">{p.notes}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {p.status === "joined" ? "Anmälda" : p.status === "booked" ? "Bokad" : p.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/provider/group-bookings")}
          >
            Tillbaka
          </Button>

          {isOpen && (
            <>
              <Button onClick={() => setMatchDialogOpen(true)}>
                Matcha och skapa bokningar
              </Button>
              <ResponsiveAlertDialog
                open={matchDialogOpen}
                onOpenChange={setMatchDialogOpen}
              >
                <ResponsiveAlertDialogContent>
                  <ResponsiveAlertDialogHeader>
                    <ResponsiveAlertDialogTitle>Matcha grupprequest</ResponsiveAlertDialogTitle>
                    <ResponsiveAlertDialogDescription>
                      Välj tjänst, datum och starttid. Individuella bokningar skapas
                      för alla {groupBooking._count.participants} deltagare i rad.
                    </ResponsiveAlertDialogDescription>
                  </ResponsiveAlertDialogHeader>
                  <form onSubmit={handleMatch} className="space-y-4">
                    <div>
                      <Label htmlFor="matchService">Tjänst *</Label>
                      <Select
                        value={matchForm.serviceId}
                        onValueChange={(value) =>
                          setMatchForm({ ...matchForm, serviceId: value })
                        }
                      >
                        <SelectTrigger id="matchService">
                          <SelectValue placeholder="Välj tjänst..." />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} ({s.durationMinutes} min, {s.price} kr)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="matchDate">Datum *</Label>
                      <Input
                        id="matchDate"
                        type="date"
                        value={matchForm.bookingDate}
                        onChange={(e) =>
                          setMatchForm({
                            ...matchForm,
                            bookingDate: e.target.value,
                          })
                        }
                        min={groupBooking.dateFrom.split("T")[0]}
                        max={groupBooking.dateTo.split("T")[0]}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="matchStartTime">Starttid *</Label>
                      <Input
                        id="matchStartTime"
                        type="time"
                        value={matchForm.startTime}
                        onChange={(e) =>
                          setMatchForm({
                            ...matchForm,
                            startTime: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    {/* Time slot preview */}
                    {timeSlots && (
                      <div className="bg-gray-50 rounded-lg p-3 text-sm">
                        <p className="font-medium text-gray-700 mb-1">Tidsöversikt</p>
                        <p className="text-gray-600">
                          {timeSlots.slots.join(", ")}
                        </p>
                        <p className="text-gray-500 mt-1">
                          {groupBooking._count.participants} bokningar, klart {timeSlots.endTime}
                        </p>
                      </div>
                    )}

                    <ResponsiveAlertDialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setMatchDialogOpen(false)}
                      >
                        Avbryt
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          isMatching || !matchForm.serviceId || !matchForm.bookingDate
                        }
                      >
                        {isMatching
                          ? "Skapar bokningar..."
                          : `Skapa ${groupBooking._count.participants} bokningar`}
                      </Button>
                    </ResponsiveAlertDialogFooter>
                  </form>
                </ResponsiveAlertDialogContent>
              </ResponsiveAlertDialog>
            </>
          )}
        </div>
      </div>
    </ProviderLayout>
  )
}
