"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { getRouteWithFallback } from '@/lib/routing'

// Prevent Leaflet from re-initializing icons
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  })
}

interface RouteOrder {
  id: string
  address: string
  latitude?: number
  longitude?: number
  serviceType: string
  customer: {
    firstName: string
    lastName: string
  } | null
  provider?: {
    businessName: string
  } | null
}

interface RouteMapVisualizationProps {
  orders: RouteOrder[]
  selectedOrderIds: string[]
  optimizedOrderIds?: string[]
  startLocation?: { lat: number; lon: number }
}

export default function RouteMapVisualization({
  orders,
  selectedOrderIds,
  optimizedOrderIds,
  startLocation = { lat: 57.7089, lon: 11.9746 } // Göteborg centrum
}: RouteMapVisualizationProps) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<L.Marker[]>([])
  const linesRef = useRef<L.Polyline[]>([])

  // State for routed paths (actual roads)
  const [routedOriginalPath, setRoutedOriginalPath] = useState<[number, number][] | null>(null)
  const [routedOptimizedPath, setRoutedOptimizedPath] = useState<[number, number][] | null>(null)
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  // Filter selected orders (only those with coordinates)
  const selectedOrders = useMemo(() =>
    orders.filter(o =>
      selectedOrderIds.includes(o.id) &&
      o.latitude !== undefined &&
      o.latitude !== null &&
      o.longitude !== undefined &&
      o.longitude !== null
    ),
    [orders, selectedOrderIds]
  )

  // Create path for original route (in selection order)
  const originalPath = useMemo(() => {
    if (selectedOrders.length < 2) return null
    const path: [number, number][] = [[startLocation.lat, startLocation.lon]]
    selectedOrders.forEach(order => {
      if (order.latitude != null && order.longitude != null) {
        path.push([order.latitude, order.longitude])
      }
    })
    // Return to start
    path.push([startLocation.lat, startLocation.lon])
    return path
  }, [selectedOrders, startLocation])

  // Create path for optimized route
  const optimizedPath = useMemo(() => {
    if (!optimizedOrderIds || optimizedOrderIds.length < 2) return null
    const path: [number, number][] = [[startLocation.lat, startLocation.lon]]
    optimizedOrderIds.forEach(id => {
      const order = orders.find(o => o.id === id)
      if (order && order.latitude != null && order.longitude != null) {
        path.push([order.latitude, order.longitude])
      }
    })
    // Return to start
    path.push([startLocation.lat, startLocation.lon])
    return path
  }, [optimizedOrderIds, orders, startLocation])

  // Fetch actual routes when paths change
  // Fetch BOTH original AND optimized paths for fair comparison
  useEffect(() => {
    let cancelled = false

    // Fetch original path (in selection order)
    if (originalPath && originalPath.length > 1 && !routedOriginalPath) {
      console.log('Fetching ORIGINAL route for', originalPath.length, 'points')
      setIsLoadingRoutes(true)

      getRouteWithFallback(originalPath)
        .then(routed => {
          if (cancelled) return
          console.log('Original route received:', routed.length, 'points')
          setRoutedOriginalPath(routed)
        })
        .catch(err => {
          if (cancelled) return
          console.error('Original route failed:', err)
          // Fallback to straight line
          setRoutedOriginalPath(originalPath)
        })
        .finally(() => {
          if (cancelled) return
          setIsLoadingRoutes(false)
        })
    } else if (!originalPath) {
      setRoutedOriginalPath(null)
    }

    return () => {
      cancelled = true
    }
  }, [originalPath])

  // Fetch optimized path when optimization is done
  useEffect(() => {
    let cancelled = false

    if (optimizedPath && optimizedPath.length > 1 && !routedOptimizedPath) {
      console.log('Fetching OPTIMIZED route for', optimizedPath.length, 'points')
      setIsLoadingRoutes(true)

      getRouteWithFallback(optimizedPath)
        .then(routed => {
          if (cancelled) return
          console.log('Optimized route received:', routed.length, 'points')
          setRoutedOptimizedPath(routed)
        })
        .catch(err => {
          if (cancelled) return
          console.error('Optimized route failed:', err)
          // Fallback to straight line
          setRoutedOptimizedPath(optimizedPath)
        })
        .finally(() => {
          if (cancelled) return
          setIsLoadingRoutes(false)
        })
    } else if (!optimizedPath) {
      setRoutedOptimizedPath(null)
      setIsLoadingRoutes(false)
    }

    return () => {
      cancelled = true
    }
  }, [optimizedPath])

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Create map
    const map = L.map(mapContainerRef.current).setView(
      [startLocation.lat, startLocation.lon],
      12
    )

    // Add tile layer - using our own proxy to avoid CORS issues
    L.tileLayer('/api/tiles/{z}/{x}/{y}', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map)

    mapRef.current = map

    // Signal map is ready after initial render completes
    map.whenReady(() => {
      setMapReady(true)
    })

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        setMapReady(false)
      }
    }
  }, [startLocation])

  // Update markers and routes
  useEffect(() => {
    if (!mapRef.current || !mapReady) return

    const map = mapRef.current

    // Don't update while routes are loading
    if (isLoadingRoutes) return

    // Clear existing markers and lines
    markersRef.current.forEach(marker => {
      try {
        marker.remove()
      } catch (e) {
        // Ignore errors during removal
      }
    })
    linesRef.current.forEach(line => {
      try {
        line.remove()
      } catch (e) {
        // Ignore errors during removal
      }
    })
    markersRef.current = []
    linesRef.current = []

    if (selectedOrders.length === 0) return

    // Add start location marker
    const startMarker = L.marker([startLocation.lat, startLocation.lon])
      .bindPopup('<strong>Startposition</strong><br/>Göteborg centrum')
      .addTo(map)
    markersRef.current.push(startMarker)

    // Show actual routed original path before optimization
    if (routedOriginalPath && !routedOptimizedPath) {
      const line = L.polyline(routedOriginalPath, {
        color: '#ef4444',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
      }).addTo(map)
      linesRef.current.push(line)
    }

    // Show BOTH routed paths when optimization is done
    if (routedOptimizedPath) {
      // Show original as routed path (not straight line!)
      if (routedOriginalPath) {
        const originalLine = L.polyline(routedOriginalPath, {
          color: '#ef4444',
          weight: 3,
          opacity: 0.5,
          dashArray: '10, 10'
        }).addTo(map)
        linesRef.current.push(originalLine)
      }

      // Show optimized as routed path
      const optimizedLine = L.polyline(routedOptimizedPath, {
        color: '#22c55e',
        weight: 4,
        opacity: 0.8
      }).addTo(map)
      linesRef.current.push(optimizedLine)
    }

    // Add order markers (only for orders with coordinates)
    selectedOrders.forEach((order, index) => {
      if (order.latitude == null || order.longitude == null) return

      const optimizedIndex = optimizedOrderIds?.indexOf(order.id)
      const displayNumber = optimizedIndex !== undefined && optimizedIndex >= 0
        ? optimizedIndex + 1
        : index + 1

      const icon = L.divIcon({
        html: `<div class="numbered-marker">${displayNumber}</div>`,
        className: 'custom-div-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
      })

      const marker = L.marker([order.latitude, order.longitude], { icon })
        .bindPopup(`
          <div class="text-sm">
            <strong class="text-base capitalize">${order.serviceType}</strong><br/>
            <span class="text-gray-600">${order.address}</span><br/>
            <span class="text-gray-600">${order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : order.provider?.businessName ?? ''}</span>
            ${optimizedPath ? `<br/><span class="text-green-600 font-medium">Stopp #${displayNumber}</span>` : ''}
          </div>
        `)
        .addTo(map)
      markersRef.current.push(marker)
    })

    // Fit bounds to show all markers (only orders with coordinates)
    // Use requestAnimationFrame to ensure DOM layout is complete before Leaflet
    // calculates positions (prevents _leaflet_pos race condition)
    requestAnimationFrame(() => {
      try {
        if (!mapRef.current) return
        const ordersWithCoords = selectedOrders.filter(o => o.latitude != null && o.longitude != null)
        if (ordersWithCoords.length === 0) return
        const bounds = L.latLngBounds(
          ordersWithCoords.map(o => [o.latitude!, o.longitude!] as [number, number])
        )
        mapRef.current.fitBounds(bounds, { padding: [50, 50] })
      } catch (e) {
        console.warn('Error fitting bounds:', e)
      }
    })

  }, [selectedOrders, routedOriginalPath, routedOptimizedPath, optimizedOrderIds, startLocation, isLoadingRoutes, mapReady])

  if (selectedOrders.length === 0) {
    const allSelected = orders.filter(o => selectedOrderIds.includes(o.id))
    const missingCoords = allSelected.filter(o => !o.latitude || !o.longitude)

    return (
      <div className="h-[500px] bg-gray-50 rounded-lg flex items-center justify-center text-gray-500">
        {missingCoords.length > 0
          ? `${missingCoords.length} valda beställningar saknar koordinater för kartvisning`
          : 'Välj beställningar för att visa karta'}
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        ref={mapContainerRef}
        style={{ height: '500px', width: '100%' }}
        className="rounded-lg border border-gray-200"
      />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 text-xs space-y-1 z-[1000]">
        <div className="font-semibold mb-2">Legend</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
          <span>Startposition</span>
        </div>
        {!optimizedPath && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-red-500" style={{ borderTop: '2px dashed #ef4444' }}></div>
            <span>Rutt (ej optimerad)</span>
          </div>
        )}
        {optimizedPath && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5" style={{ borderTop: '3px dashed #ef4444', opacity: 0.5 }}></div>
              <span>Original rutt</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 bg-green-500"></div>
              <span>Optimerad rutt</span>
            </div>
          </>
        )}
      </div>

      {/* Custom CSS for numbered markers */}
      <style jsx global>{`
        .numbered-marker {
          background-color: #f97316;
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .custom-div-icon {
          background: transparent;
          border: none;
        }
      `}</style>
    </div>
  )
}
