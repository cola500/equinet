"use client"

import { Suspense, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/layout/Header"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { useStableSearch, type StableData } from "@/hooks/useStableSearch"
import { searchMunicipalities } from "@/lib/geo/municipalities"
import { MapPin, Search } from "lucide-react"

export default function StablesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2">Hitta stallplatser</h1>
            <p className="text-gray-600 mb-8">Sök bland stall med lediga platser</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-lg" />
              ))}
            </div>
          </div>
        </main>
      </div>
    }>
      <StablesContent />
    </Suspense>
  )
}

function StablesContent() {
  const stableProfilesEnabled = useFeatureFlag("stable_profiles")
  const searchParams = useSearchParams()

  const {
    stables,
    search, setSearch,
    municipality, setMunicipality,
    hasAvailableSpots, setHasAvailableSpots,
    isLoading, isSearching, error,
    clearSearch,
  } = useStableSearch({
    initialSearch: searchParams.get("search") || "",
    initialMunicipality: searchParams.get("municipality") || "",
    initialHasAvailableSpots: searchParams.get("available") === "true",
  })

  // Municipality autocomplete
  const [municipalitySuggestions, setMunicipalitySuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleMunicipalityInput = useCallback((value: string) => {
    setMunicipality(value)
    if (value.length >= 2) {
      const matches = searchMunicipalities(value).map((m) => m.name)
      setMunicipalitySuggestions(matches.slice(0, 5))
      setShowSuggestions(matches.length > 0)
    } else {
      setMunicipalitySuggestions([])
      setShowSuggestions(false)
    }
  }, [setMunicipality])

  const selectMunicipality = useCallback((name: string) => {
    setMunicipality(name)
    setShowSuggestions(false)
    setMunicipalitySuggestions([])
  }, [setMunicipality])

  if (!stableProfilesEnabled) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p>Funktionen är inte tillgänglig just nu.</p>
        </main>
      </div>
    )
  }

  const hasActiveFilters = !!(search || municipality || hasAvailableSpots)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">Hitta stallplatser</h1>
          <p className="text-gray-600 mb-8">
            Sök bland stall med lediga platser i hela Sverige
          </p>

          {/* Search Filters */}
          <div className="mb-8 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Input
                  placeholder="Sök stallnamn..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-green-600" />
                  </div>
                )}
              </div>

              <div className="relative sm:w-48">
                <Input
                  placeholder="Kommun..."
                  value={municipality}
                  onChange={(e) => handleMunicipalityInput(e.target.value)}
                  onFocus={() => municipalitySuggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                {showSuggestions && municipalitySuggestions.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {municipalitySuggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                        onMouseDown={() => selectMunicipality(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAvailableSpots}
                  onChange={(e) => setHasAvailableSpots(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Lediga platser
              </label>

              {hasActiveFilters && (
                <Button variant="outline" onClick={clearSearch}>
                  Rensa
                </Button>
              )}
            </div>

            {/* Active filter chips */}
            {!isSearching && hasActiveFilters && (
              <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                <span>Aktiva filter:</span>
                {search && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full">
                    &quot;{search}&quot;
                    <button type="button" onClick={() => setSearch("")}>×</button>
                  </span>
                )}
                {municipality && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                    <MapPin className="h-3 w-3" />
                    {municipality}
                    <button type="button" onClick={() => setMunicipality("")}>×</button>
                  </span>
                )}
                {hasAvailableSpots && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
                    Lediga platser
                    <button type="button" onClick={() => setHasAvailableSpots(false)}>×</button>
                  </span>
                )}
              </div>
            )}

            {/* Result count */}
            {!isLoading && !isSearching && !error && (
              <p className="text-sm text-gray-500">
                {stables.length === 0
                  ? "Inga stall hittades"
                  : `${stables.length} stall`}
              </p>
            )}
          </div>

          {/* Results */}
          {error ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Något gick fel</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={clearSearch}>Försök igen</Button>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : stables.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Inga stall hittades</h3>
                <p className="text-gray-600">
                  {hasActiveFilters ? (
                    <>
                      Prova att ändra dina filter eller{" "}
                      <button onClick={clearSearch} className="text-green-600 hover:text-green-700 font-medium">
                        rensa alla filter
                      </button>
                    </>
                  ) : (
                    "Det finns inga stall registrerade just nu."
                  )}
                </p>
              </CardContent>
            </Card>
          ) : (
            <StableGrid stables={stables} />
          )}
        </div>
      </main>
    </div>
  )
}

function StableGrid({ stables }: { stables: StableData[] }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stables.map((stable) => (
        <Link key={stable.id} href={`/stables/${stable.id}`}>
          <Card className="hover:shadow-lg transition-shadow h-full cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">{stable.name}</CardTitle>
              {(stable.municipality || stable.city) && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[stable.municipality, stable.city].filter(Boolean).join(", ")}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {stable.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {stable.description}
                </p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {stable._count.spots} platser totalt
                </span>
                {stable._count.availableSpots > 0 ? (
                  <span className="text-green-700 font-medium">
                    {stable._count.availableSpots} lediga
                  </span>
                ) : (
                  <span className="text-gray-400">Inga lediga</span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
