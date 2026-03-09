import { useEffect, useRef, useState, useCallback } from "react"
import { clientLogger } from "@/lib/client-logger"

export interface StableData {
  id: string
  name: string
  description: string | null
  city: string | null
  municipality: string | null
  latitude: number | null
  longitude: number | null
  contactEmail: string | null
  contactPhone: string | null
  profileImageUrl: string | null
  _count: {
    spots: number
    availableSpots: number
  }
}

interface UseStableSearchOptions {
  initialSearch: string
  initialMunicipality: string
  initialHasAvailableSpots: boolean
}

export function useStableSearch(options: UseStableSearchOptions) {
  const initializedFromUrl = useRef(false)
  const [stables, setStables] = useState<StableData[]>([])
  const [search, setSearch] = useState(options.initialSearch)
  const [municipality, setMunicipality] = useState(options.initialMunicipality)
  const [hasAvailableSpots, setHasAvailableSpots] = useState(options.initialHasAvailableSpots)
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync filter state to URL
  useEffect(() => {
    if (!initializedFromUrl.current) {
      initializedFromUrl.current = true
      return
    }
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (municipality) params.set("municipality", municipality)
    if (hasAvailableSpots) params.set("available", "true")
    const qs = params.toString()
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, "", url)
  }, [search, municipality, hasAvailableSpots])

  const fetchStables = useCallback(
    async (
      searchQuery?: string,
      municipalityQuery?: string,
      availableOnly?: boolean
    ) => {
      try {
        setIsLoading(true)
        setError(null)
        const params = new URLSearchParams()
        if (searchQuery) params.append("search", searchQuery)
        if (municipalityQuery) params.append("municipality", municipalityQuery)
        if (availableOnly) params.append("hasAvailableSpots", "true")

        const url = params.toString()
          ? `/api/stables?${params.toString()}`
          : "/api/stables"

        const response = await fetch(url)
        if (response.ok) {
          const result = await response.json()
          setStables(result.data)
        } else {
          try {
            const errorData = await response.json()
            setError(errorData.error || "Kunde inte hämta stall")
          } catch {
            setError("Kunde inte hämta stall")
          }
        }
      } catch (fetchError) {
        clientLogger.error("Error fetching stables", fetchError)
        setError("Något gick fel. Kontrollera din internetanslutning.")
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // Debounce search
  useEffect(() => {
    const hasFilters = search || municipality
    if (hasFilters) {
      setIsSearching(true)
    }

    const delay = hasFilters ? 500 : 0

    const timer = setTimeout(() => {
      fetchStables(search, municipality, hasAvailableSpots)
      setIsSearching(false)
    }, delay)

    return () => {
      clearTimeout(timer)
      setIsSearching(false)
    }
  }, [search, municipality, hasAvailableSpots, fetchStables])

  const clearSearch = useCallback(() => {
    setSearch("")
    setMunicipality("")
    setHasAvailableSpots(false)
  }, [])

  return {
    stables,
    search,
    setSearch,
    municipality,
    setMunicipality,
    hasAvailableSpots,
    setHasAvailableSpots,
    isLoading,
    isSearching,
    error,
    clearSearch,
  }
}
