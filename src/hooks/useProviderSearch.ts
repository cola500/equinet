import { useEffect, useRef, useState, useCallback } from "react"
import type { GeoLocation } from "./useGeoFiltering"

export interface ProviderData {
  id: string
  businessName: string
  description?: string
  city?: string
  profileImageUrl?: string | null
  services: Array<{
    id: string
    name: string
    price: number
    durationMinutes: number
  }>
  user: {
    firstName: string
    lastName: string
  }
  nextVisit?: {
    date: string
    location: string
  } | null
  reviewStats?: {
    averageRating: number | null
    totalCount: number
  }
}

export type SortOption = "default" | "rating" | "reviews"

export interface ProviderWithVisit {
  provider: ProviderData
  nextVisit: {
    date: string
    location: string
    startTime: string | null
    endTime: string | null
  }
}

interface UseProviderSearchOptions {
  initialSearch: string
  initialCity: string
  initialVisitingArea: string
  initialSortBy: SortOption
  userLocation: GeoLocation | null
  radiusKm: number
  followedIds: Set<string>
  showFavoritesOnly: boolean
}

export function useProviderSearch(options: UseProviderSearchOptions) {
  const {
    userLocation,
    radiusKm,
    followedIds,
    showFavoritesOnly,
  } = options

  const initializedFromUrl = useRef(false)
  const [providers, setProviders] = useState<ProviderData[]>([])
  const [visitingProviders, setVisitingProviders] = useState<ProviderWithVisit[]>([])
  const [search, setSearch] = useState(options.initialSearch)
  const [city, setCity] = useState(options.initialCity)
  const [visitingArea, setVisitingArea] = useState(options.initialVisitingArea)
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>(options.initialSortBy)

  // Sync filter state to URL (no network request -- uses replaceState)
  useEffect(() => {
    if (!initializedFromUrl.current) {
      initializedFromUrl.current = true
      return
    }
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (city) params.set("city", city)
    if (visitingArea) params.set("visiting", visitingArea)
    if (sortBy !== "default") params.set("sort", sortBy)
    if (showFavoritesOnly) params.set("favorites", "true")
    const qs = params.toString()
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, "", url)
  }, [search, city, visitingArea, sortBy, showFavoritesOnly])

  const fetchProviders = useCallback(
    async (
      searchQuery?: string,
      cityQuery?: string,
      geo?: { latitude: number; longitude: number; radiusKm: number }
    ) => {
      try {
        setIsLoading(true)
        setError(null)
        const params = new URLSearchParams()
        if (searchQuery) params.append("search", searchQuery)
        if (cityQuery) params.append("city", cityQuery)
        if (geo) {
          params.append("latitude", geo.latitude.toString())
          params.append("longitude", geo.longitude.toString())
          params.append("radiusKm", geo.radiusKm.toString())
        }

        const url = params.toString()
          ? `/api/providers?${params.toString()}`
          : "/api/providers"

        const response = await fetch(url)
        if (response.ok) {
          const result = await response.json()
          setProviders(result.data)
        } else {
          try {
            const errorData = await response.json()
            setError(errorData.error || "Kunde inte hämta leverantörer")
          } catch {
            setError("Kunde inte hämta leverantörer")
          }
        }
      } catch (fetchError) {
        console.error("Error fetching providers:", fetchError)
        setError("Något gick fel. Kontrollera din internetanslutning.")
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // Debounce search
  useEffect(() => {
    const hasFilters = search || city
    if (hasFilters) {
      setIsSearching(true)
    }

    const geo = userLocation
      ? { latitude: userLocation.lat, longitude: userLocation.lng, radiusKm }
      : undefined

    const delay = hasFilters ? 500 : 0

    const timer = setTimeout(() => {
      fetchProviders(search, city, geo)
      setIsSearching(false)
    }, delay)

    return () => {
      clearTimeout(timer)
      setIsSearching(false)
    }
  }, [search, city, radiusKm, userLocation, fetchProviders])

  // Fetch providers visiting a specific area
  useEffect(() => {
    if (visitingArea.length < 2) {
      setVisitingProviders([])
      return
    }

    setIsSearching(true)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/providers/visiting-area?location=${encodeURIComponent(visitingArea)}`
        )
        if (response.ok) {
          const result = await response.json()
          setVisitingProviders(result.data)
        }
      } catch (fetchError) {
        console.error("Error fetching visiting providers:", fetchError)
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      setIsSearching(false)
    }
  }, [visitingArea])

  // Sort providers client-side
  const sortedProviders = [...providers].sort((a, b) => {
    if (sortBy === "rating") {
      const ratingA = a.reviewStats?.averageRating ?? 0
      const ratingB = b.reviewStats?.averageRating ?? 0
      return ratingB - ratingA
    }
    if (sortBy === "reviews") {
      const countA = a.reviewStats?.totalCount ?? 0
      const countB = b.reviewStats?.totalCount ?? 0
      return countB - countA
    }
    return 0
  })

  // Apply favorites filter
  const displayedProviders = showFavoritesOnly
    ? sortedProviders.filter((p) => followedIds.has(p.id))
    : sortedProviders

  const clearSearch = useCallback(() => {
    setSearch("")
    setCity("")
    setVisitingArea("")
    setVisitingProviders([])
  }, [])

  return {
    providers,
    displayedProviders,
    visitingProviders,
    search,
    setSearch,
    city,
    setCity,
    visitingArea,
    setVisitingArea,
    isLoading,
    isSearching,
    error,
    sortBy,
    setSortBy,
    fetchProviders,
    clearSearch,
  }
}
