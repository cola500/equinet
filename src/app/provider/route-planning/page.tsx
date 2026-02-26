"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useAuth } from "@/hooks/useAuth"
import { useRouteOrders } from "@/hooks/useRouteOrders"
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
import { optimizeRoute, type Location } from "@/lib/route-optimizer"
import { getRoute } from "@/lib/routing"

// Dynamic import to avoid SSR issues with Leaflet
const RouteMapVisualization = dynamic(
  () => import('@/components/RouteMapVisualization'),
  { ssr: false, loading: () => <div className="h-[500px] bg-gray-100 rounded-lg animate-pulse flex items-center justify-center text-gray-500">Laddar karta...</div> }
)

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
  } | null
  provider: {
    businessName: string
  } | null
  distanceKm?: number
}

export default function RoutePlanningPage() {
  const router = useRouter()
  const { isLoading, isProvider } = useAuth()
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [isCreatingRoute, setIsCreatingRoute] = useState(false)

  // Route optimization state
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<{
    optimizedOrderIds: string[]
    improvement: number
    totalDistance: number
    baselineDistance: number
  } | null>(null)

  // Filter states
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")

  // SWR-driven data fetching
  const { orders, error, isLoading: isLoadingOrders } = useRouteOrders(
    { serviceType: serviceTypeFilter, priority: priorityFilter },
    !!isProvider
  )

  // Start location (geolocation with Göteborg fallback)
  const [startLocation, setStartLocation] = useState<{ lat: number; lon: number }>({
    lat: 57.7089, lon: 11.9746,
  })

  // Mobile map toggle
  const [showMap, setShowMap] = useState(false)

  // Route creation form
  const [routeName, setRouteName] = useState("")
  const [routeDate, setRouteDate] = useState("")
  const [startTime, setStartTime] = useState("08:00")

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setStartLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {} // tyst fallback till Göteborg
      )
    }
  }, [])

  useEffect(() => {
    // Set default route date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setRouteDate(format(tomorrow, 'yyyy-MM-dd'))
  }, [])

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

  const handleOptimizeRoute = async () => {
    if (selectedOrders.size < 2) {
      toast.error("Välj minst 2 beställningar för att optimera")
      return
    }

    setIsOptimizing(true)
    setOptimizationResult(null)

    try {
      // Hämta valda orders
      const selected = orders.filter(o => selectedOrders.has(o.id))

      // Konvertera till Location format med index som ID för Modal API
      const locations: Location[] = selected.map((order, index) => ({
        id: index, // Använd array-index som ID för Modal API
        lat: order.latitude,
        lon: order.longitude,
        customer: order.customer
          ? `${order.customer.firstName} ${order.customer.lastName}`
          : order.provider?.businessName ?? 'Okänd',
        address: order.address,
        service: order.serviceType,
      }))

      // Anropa Modal API
      const result = await optimizeRoute(startLocation, locations)

      // Mappa tillbaka från array-index till riktiga order IDs
      const optimizedOrderIds = result.route.map(index => selected[index].id)

      // Beräkna FAKTISK baseline distance med OSRM (istället för Modal API:s fågelväg)
      let actualBaselineDistanceKm = result.baseline_distance_km // Fallback
      let actualOptimizedDistanceKm = result.total_distance_km // Fallback

      try {
        // Skapa path för original ordning
        const originalPath: [number, number][] = [[startLocation.lat, startLocation.lon]]
        selected.forEach(order => {
          originalPath.push([order.latitude, order.longitude])
        })
        originalPath.push([startLocation.lat, startLocation.lon])

        // Skapa path för optimerad ordning
        const optimizedPath: [number, number][] = [[startLocation.lat, startLocation.lon]]
        result.route.forEach(index => {
          const order = selected[index]
          optimizedPath.push([order.latitude, order.longitude])
        })
        optimizedPath.push([startLocation.lat, startLocation.lon])

        // Hämta faktiska rutter parallellt
        const [originalRoute, optimizedRoute] = await Promise.all([
          getRoute(originalPath),
          getRoute(optimizedPath)
        ])

        actualBaselineDistanceKm = originalRoute.distance / 1000 // meter -> km
        actualOptimizedDistanceKm = optimizedRoute.distance / 1000

        // Beräkna VERKLIG förbättring
        const actualImprovement = ((actualBaselineDistanceKm - actualOptimizedDistanceKm) / actualBaselineDistanceKm) * 100

        // Spara resultat med FAKTISKA avstånd
        setOptimizationResult({
          optimizedOrderIds,
          improvement: actualImprovement,
          totalDistance: actualOptimizedDistanceKm,
          baselineDistance: actualBaselineDistanceKm,
        })

        toast.success(`Rutt optimerad! ${actualImprovement.toFixed(1)}% kortare (${actualBaselineDistanceKm.toFixed(1)} km → ${actualOptimizedDistanceKm.toFixed(1)} km)`)
      } catch (error) {
        console.error('OSRM distance calculation failed, using Modal API distances:', error)
        // Fallback till Modal API:s resultat
        setOptimizationResult({
          optimizedOrderIds,
          improvement: result.improvement_percent,
          totalDistance: result.total_distance_km,
          baselineDistance: result.baseline_distance_km,
        })

        toast.success(`Rutt optimerad! ${result.improvement_percent.toFixed(1)}% kortare`)
      }
    } catch (error: any) {
      console.error("Optimization error:", error)
      toast.error("Kunde inte optimera rutt: " + error.message)
    } finally {
      setIsOptimizing(false)
    }
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
      // Använd optimerad ordning om den finns, annars original
      const orderIds = optimizationResult
        ? optimizationResult.optimizedOrderIds
        : Array.from(selectedOrders)

      const payload = {
        routeName: routeName.trim(),
        routeDate: new Date(routeDate).toISOString(),
        startTime,
        orderIds,
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
              <p className="text-red-600">Kunde inte hämta beställningar</p>
            </CardContent>
          </Card>
        )}

        {/* Map Visualization */}
        {selectedOrders.size > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Kartvy</CardTitle>
                  <CardDescription>
                    {optimizationResult
                      ? `Visar optimerad rutt (${optimizationResult.improvement.toFixed(1)}% kortare)`
                      : `Visar ${selectedOrders.size} valda beställningar`
                    }
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setShowMap(!showMap)}
                >
                  {showMap ? "Dölj karta" : "Visa karta"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className={`${showMap ? "block" : "hidden"} md:block`}>
              <RouteMapVisualization
                orders={orders}
                selectedOrderIds={Array.from(selectedOrders)}
                optimizedOrderIds={optimizationResult?.optimizedOrderIds}
              />
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
                  Sorterat efter avstånd från din position
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
                    <p className="text-xs text-gray-500 pt-1">(ca 1h/häst, exkl körtid)</p>
                  </div>
                )}

                {/* Optimization section */}
                {selectedOrders.size >= 2 && (
                  <div className="border-t pt-4">
                    <Button
                      variant="outline"
                      className="w-full mb-3"
                      onClick={handleOptimizeRoute}
                      disabled={isOptimizing}
                    >
                      {isOptimizing ? "Optimerar..." : "🚀 Optimera rutt"}
                    </Button>

                    {optimizationResult && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2 text-sm">
                        <p className="font-semibold text-green-900">
                          ✅ Rutt optimerad!
                        </p>
                        <div className="space-y-1 text-green-800">
                          <div className="flex justify-between">
                            <span>Förbättring:</span>
                            <span className="font-bold">{optimizationResult.improvement.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Ny sträcka:</span>
                            <span className="font-medium">{optimizationResult.totalDistance.toFixed(1)} km</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>Tidigare:</span>
                            <span>{optimizationResult.baselineDistance.toFixed(1)} km</span>
                          </div>
                        </div>
                      </div>
                    )}
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

                {optimizationResult ? (
                  <p className="text-xs text-green-600 text-center font-medium">
                    ✨ Rutten kommer skapas i optimerad ordning
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 text-center">
                    💡 Välj minst 2 beställningar för att optimera rutten
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Mobile sticky action bar */}
        {selectedOrders.size > 0 && (
          <div className="fixed bottom-16 left-0 right-0 bg-white border-t shadow-lg p-4 z-50 md:hidden">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-gray-600">{selectedOrders.size} valda stopp</span>
              <span className="font-medium">{totals.distance} km</span>
            </div>
            <div className="flex gap-2">
              {selectedOrders.size >= 2 && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleOptimizeRoute}
                  disabled={isOptimizing}
                >
                  {isOptimizing ? "Optimerar..." : "Optimera rutt"}
                </Button>
              )}
              <Button
                className="flex-1"
                onClick={() => {
                  const el = document.getElementById('routeName')
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  el?.focus()
                }}
              >
                Skapa rutt
              </Button>
            </div>
          </div>
        )}
      </div>
    </ProviderLayout>
  )
}
