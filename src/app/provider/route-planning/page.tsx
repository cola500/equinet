"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { sv } from "date-fns/locale"
import { toast } from "sonner"
import { ProviderLayout } from "@/components/layout/ProviderLayout"

interface RouteOrder {
  id: string
  serviceType: string
  address: string
  latitude: number
  longitude: number
  numberOfHorses: number
  dateFrom: string
  dateTo: string
  priority: string
  specialInstructions?: string
  contactPhone: string
  customer: {
    firstName: string
    lastName: string
    phone?: string
  }
  distanceKm?: number
}

export default function RoutePlanningPage() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const [orders, setOrders] = useState<RouteOrder[]>([])
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)
  const [isCreatingRoute, setIsCreatingRoute] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")

  // Route creation form
  const [routeName, setRouteName] = useState("")
  const [routeDate, setRouteDate] = useState("")
  const [startTime, setStartTime] = useState("08:00")

  useEffect(() => {
    if (!isLoading && !isProvider) {
      router.push("/login")
    }
  }, [isProvider, isLoading, router])

  useEffect(() => {
    if (isProvider) {
      fetchOrders()
    }
  }, [isProvider, serviceTypeFilter, priorityFilter])

  useEffect(() => {
    // Set default route date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setRouteDate(format(tomorrow, 'yyyy-MM-dd'))
  }, [])

  const fetchOrders = async () => {
    try {
      setIsLoadingOrders(true)
      setError(null)

      const params = new URLSearchParams()
      if (serviceTypeFilter !== "all") params.append("serviceType", serviceTypeFilter)
      if (priorityFilter !== "all") params.append("priority", priorityFilter)

      const response = await fetch(`/api/route-orders/available?${params}`)
      if (response.ok) {
        const data = await response.json()
        setOrders(data)
      } else {
        setError("Kunde inte hämta beställningar")
      }
    } catch (error) {
      console.error("Error fetching route orders:", error)
      setError("Något gick fel. Kontrollera din internetanslutning.")
    } finally {
      setIsLoadingOrders(false)
    }
  }

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const selectAll = () => {
    setSelectedOrders(new Set(orders.map(o => o.id)))
  }

  const deselectAll = () => {
    setSelectedOrders(new Set())
  }

  const handleCreateRoute = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Välj minst en beställning")
      return
    }

    if (!routeName.trim()) {
      toast.error("Ange ett ruttnamn")
      return
    }

    setIsCreatingRoute(true)

    try {
      const payload = {
        routeName: routeName.trim(),
        routeDate: new Date(routeDate).toISOString(),
        startTime,
        orderIds: Array.from(selectedOrders),
      }

      const response = await fetch("/api/routes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Kunde inte skapa rutt")
      }

      const newRoute = await response.json()
      toast.success("Rutt skapad!")
      router.push(`/provider/routes/${newRoute.id}`)
    } catch (error: any) {
      console.error("Error creating route:", error)
      toast.error(error.message || "Något gick fel")
    } finally {
      setIsCreatingRoute(false)
    }
  }

  const calculateTotals = () => {
    const selected = orders.filter(o => selectedOrders.has(o.id))
    const totalDistance = selected.reduce((sum, o) => sum + (o.distanceKm || 0), 0)
    const totalHorses = selected.reduce((sum, o) => sum + o.numberOfHorses, 0)
    const estimatedDuration = totalHorses * 60 // 1 hour per horse

    return {
      count: selected.length,
      distance: Math.round(totalDistance * 10) / 10,
      duration: estimatedDuration,
    }
  }

  const totals = calculateTotals()

  if (isLoading || !isProvider) {
    return null
  }

  return (
    <ProviderLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Rutt-planering</h1>
          <p className="text-gray-600 mt-2">
            Välj tillgängliga beställningar och skapa en optimerad rutt
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tjänstetyp</Label>
                <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla</SelectItem>
                    <SelectItem value="hovslagning">Hovslagning</SelectItem>
                    <SelectItem value="massage">Massage</SelectItem>
                    <SelectItem value="tandvård">Tandvård</SelectItem>
                    <SelectItem value="veterinär">Veterinär</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioritet</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Akut</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Available Orders */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Tillgängliga Beställningar</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Välj alla
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll}>
                      Avmarkera alla
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Sorterat efter avstånd från Göteborg centrum
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingOrders ? (
                  <p className="text-gray-500">Laddar beställningar...</p>
                ) : orders.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Inga tillgängliga beställningar matchar dina filter
                  </p>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedOrders.has(order.id)
                            ? "border-green-500 bg-green-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => toggleOrderSelection(order.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium capitalize">{order.serviceType}</p>
                                <p className="text-sm text-gray-600">{order.address}</p>
                              </div>
                              <div className="flex gap-2">
                                {order.priority === "urgent" && (
                                  <Badge variant="destructive">Akut</Badge>
                                )}
                                {order.distanceKm !== undefined && (
                                  <Badge variant="outline">{order.distanceKm} km</Badge>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Hästar:</span>{" "}
                                <span className="font-medium">{order.numberOfHorses}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-gray-600">Period:</span>{" "}
                                <span className="font-medium">
                                  {format(new Date(order.dateFrom), "d MMM", { locale: sv })} -{" "}
                                  {format(new Date(order.dateTo), "d MMM", { locale: sv })}
                                </span>
                              </div>
                            </div>
                            {order.specialInstructions && (
                              <p className="text-sm text-gray-600 mt-2">
                                💬 {order.specialInstructions}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Route Creation */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Skapa Rutt</CardTitle>
                <CardDescription>
                  {selectedOrders.size} beställningar valda
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {totals.count > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Antal stopp:</span>
                      <span className="font-medium">{totals.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total sträcka:</span>
                      <span className="font-medium">{totals.distance} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Beräknad tid:</span>
                      <span className="font-medium">{Math.round(totals.duration / 60)}h</span>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="routeName">Ruttnamn</Label>
                  <Input
                    id="routeName"
                    placeholder="T.ex. Göteborg Tisdag"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="routeDate">Datum</Label>
                  <Input
                    id="routeDate"
                    type="date"
                    value={routeDate}
                    onChange={(e) => setRouteDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="startTime">Starttid</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleCreateRoute}
                  disabled={selectedOrders.size === 0 || isCreatingRoute}
                >
                  {isCreatingRoute ? "Skapar rutt..." : "Skapa rutt"}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  OBS: I MVP-version skapas rutter i den ordning du valde beställningarna. Ruttoptimering kommer i senare version.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProviderLayout>
  )
}
