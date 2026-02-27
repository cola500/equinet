"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"
import { Header } from "@/components/layout/Header"
import { ProviderCardSkeleton } from "@/components/loading/ProviderCardSkeleton"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { useDialogState } from "@/hooks/useDialogState"
import { useGeoFiltering } from "@/hooks/useGeoFiltering"
import { useFavoritesFilter } from "@/hooks/useFavoritesFilter"
import { useProviderSearch, type SortOption } from "@/hooks/useProviderSearch"
import { ProviderGrid } from "./ProviderGrid"
import { ProviderFiltersDrawer } from "./ProviderFiltersDrawer"
import { SlidersHorizontal, MapPin, Heart } from "lucide-react"

export default function ProvidersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2">Hitta tjänsteleverantörer</h1>
            <p className="text-gray-600 mb-8">
              Bläddra bland professionella hovslagare, veterinärer och andra hästtjänster
            </p>
            <ProviderCardSkeleton count={6} />
          </div>
        </main>
      </div>
    }>
      <ProvidersContent />
    </Suspense>
  )
}

function ProvidersContent() {
  const { user } = useAuth()
  const isCustomer = user?.userType === "customer"
  const followEnabled = useFeatureFlag("follow_provider")
  const searchParams = useSearchParams()
  const filterDrawer = useDialogState()

  const geo = useGeoFiltering()
  const favorites = useFavoritesFilter(
    isCustomer,
    followEnabled,
    searchParams.get("favorites") === "true"
  )

  const providerSearch = useProviderSearch({
    initialSearch: searchParams.get("search") || "",
    initialCity: searchParams.get("city") || "",
    initialVisitingArea: searchParams.get("visiting") || "",
    initialSortBy: (searchParams.get("sort") as SortOption) || "default",
    userLocation: geo.userLocation,
    radiusKm: geo.radiusKm,
    followedIds: favorites.followedIds,
    showFavoritesOnly: favorites.showFavoritesOnly,
  })

  const {
    displayedProviders,
    visitingProviders,
    search, setSearch,
    city, setCity,
    visitingArea, setVisitingArea,
    isLoading, isSearching, error,
    sortBy, setSortBy,
    fetchProviders,
    clearSearch,
  } = providerSearch

  // Count active advanced filters (not counting main search)
  const activeFilterCount = [city, visitingArea, geo.userLocation, favorites.showFavoritesOnly].filter(Boolean).length

  const handleClearFilters = () => {
    clearSearch()
    geo.clearLocation()
    favorites.setShowFavoritesOnly(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">Hitta tjänsteleverantörer</h1>
          <p className="text-gray-600 mb-8">
            Bläddra bland professionella hovslagare, veterinärer och andra hästtjänster
          </p>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="flex flex-col gap-4">
              {/* Main search row */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Sök efter företagsnamn..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-green-600"></div>
                    </div>
                  )}
                </div>

                {/* Mobile: Filter button */}
                <Button
                  variant="outline"
                  className="md:hidden relative"
                  onClick={filterDrawer.openDialog}
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-green-600 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>

                {/* Desktop: inline advanced filters */}
                <div className="hidden md:flex gap-4 items-center">
                  <Input
                    placeholder="Filtrera på ort..."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-40 lg:w-48"
                  />
                  <Input
                    placeholder="Besöker område..."
                    value={visitingArea}
                    onChange={(e) => setVisitingArea(e.target.value)}
                    className="w-40 lg:w-48"
                  />
                  {isCustomer && followEnabled && favorites.followedIds.size > 0 && (
                    <Button
                      variant={favorites.showFavoritesOnly ? "default" : "outline"}
                      size="sm"
                      onClick={favorites.toggleFavorites}
                      aria-pressed={favorites.showFavoritesOnly}
                      data-testid="favorites-filter-button"
                    >
                      <Heart className={`h-4 w-4 mr-1.5 ${favorites.showFavoritesOnly ? "fill-current" : ""}`} />
                      Favoriter ({favorites.followedIds.size})
                    </Button>
                  )}
                </div>
                {(search || city || visitingArea || geo.userLocation || favorites.showFavoritesOnly) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearFilters}
                    data-testid="clear-filters-button"
                    className="hidden md:flex"
                  >
                    Rensa
                  </Button>
                )}
              </div>

              {/* Desktop: Place Search (hidden on mobile -- inside drawer) */}
              <div className="hidden md:flex flex-col gap-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-medium text-gray-700">Sök i närheten:</span>
                  <div className="flex gap-2 items-center flex-1 min-w-[200px] max-w-md">
                    <Input
                      placeholder="Ort, stad eller postnummer..."
                      value={geo.searchPlace}
                      onChange={(e) => geo.setSearchPlace(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") geo.handleSearchPlace() }}
                      className="flex-1"
                    />
                    <Button
                      onClick={geo.handleSearchPlace}
                      disabled={geo.isGeocoding || !geo.searchPlace.trim()}
                      variant="outline"
                    >
                      {geo.isGeocoding ? "Söker..." : "Sök plats"}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    onClick={geo.requestLocation}
                    variant="outline"
                    size="sm"
                    disabled={geo.locationLoading}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {geo.locationLoading ? "Hämtar position..." : "Använd min position"}
                  </Button>
                  {geo.userLocation && (
                    <select
                      value={geo.radiusKm}
                      onChange={(e) => geo.setRadiusKm(Number(e.target.value))}
                      className="border rounded-md px-3 py-2 text-sm bg-white"
                    >
                      <option value={25}>25 km</option>
                      <option value={50}>50 km</option>
                      <option value={100}>100 km</option>
                      <option value={200}>200 km</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Location Error */}
              {geo.locationError && (
                <p className="text-sm text-red-600">{geo.locationError}</p>
              )}

              {/* Result count + sort + active filter chips */}
              {!isLoading && !isSearching && !error && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {displayedProviders.length === 0
                      ? favorites.showFavoritesOnly ? "Inga favoriter matchar" : "Inga träffar"
                      : `${displayedProviders.length} leverantör${displayedProviders.length !== 1 ? "er" : ""}`}
                  </p>
                  {displayedProviders.length > 1 && (
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="text-sm border rounded-md px-3 py-1.5 bg-white text-gray-700"
                    >
                      <option value="default">Sortera</option>
                      <option value="rating">Högst betyg</option>
                      <option value="reviews">Flest recensioner</option>
                    </select>
                  )}
                </div>
              )}

              {isSearching && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-green-600"></div>
                  <span>Söker...</span>
                </div>
              )}
              {!isSearching && (search || city || visitingArea || geo.userLocation || favorites.showFavoritesOnly) && (
                <div className="flex items-center gap-2 text-sm text-gray-600 overflow-x-auto pb-1 scrollbar-hide">
                  <span className="shrink-0">Aktiva filter:</span>
                  {search && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 touch-target bg-green-100 text-green-800 rounded-full shrink-0 whitespace-nowrap">
                      Sökning: &quot;{search}&quot;
                      <button type="button" onClick={() => setSearch("")} className="hover:text-green-900">×</button>
                    </span>
                  )}
                  {city && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 touch-target bg-blue-100 text-blue-800 rounded-full shrink-0 whitespace-nowrap">
                      Ort: &quot;{city}&quot;
                      <button type="button" onClick={() => setCity("")} className="hover:text-blue-900">×</button>
                    </span>
                  )}
                  {visitingArea && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 touch-target bg-purple-100 text-purple-800 rounded-full shrink-0 whitespace-nowrap">
                      Besöker: &quot;{visitingArea}&quot;
                      <button type="button" onClick={() => setVisitingArea("")} className="hover:text-purple-900">×</button>
                    </span>
                  )}
                  {geo.userLocation && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 touch-target bg-orange-100 text-orange-800 rounded-full shrink-0 whitespace-nowrap">
                      {geo.searchPlaceName ? geo.searchPlaceName : "Min position"}, inom {geo.radiusKm} km
                      <button type="button" onClick={geo.clearLocation} className="hover:text-orange-900">×</button>
                    </span>
                  )}
                  {favorites.showFavoritesOnly && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 touch-target bg-red-100 text-red-800 rounded-full shrink-0 whitespace-nowrap">
                      <Heart className="h-3 w-3 fill-current" />
                      Favoriter
                      <button type="button" onClick={() => favorites.setShowFavoritesOnly(false)} className="hover:text-red-900">×</button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="inline-flex items-center px-3 py-1 text-gray-500 hover:text-gray-700 rounded-full border border-gray-300 hover:bg-gray-50 shrink-0 whitespace-nowrap md:hidden"
                    data-testid="clear-filters-mobile"
                  >
                    Rensa alla
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Filter Drawer */}
          <ProviderFiltersDrawer
            open={filterDrawer.open}
            onOpenChange={filterDrawer.setOpen}
            city={city}
            onCityChange={setCity}
            visitingArea={visitingArea}
            onVisitingAreaChange={setVisitingArea}
            geo={geo}
            isCustomer={isCustomer}
            followEnabled={followEnabled}
            followedIds={favorites.followedIds}
            showFavoritesOnly={favorites.showFavoritesOnly}
            onToggleFavorites={favorites.toggleFavorites}
            hasActiveFilters={!!(city || visitingArea || geo.userLocation || favorites.showFavoritesOnly)}
            onClearFilters={handleClearFilters}
          />

          {/* Visiting Providers Section */}
          {visitingArea && visitingProviders.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 text-purple-800">
                Leverantörer som besöker {visitingArea}
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visitingProviders.map(({ provider, nextVisit }) => (
                  <Card
                    key={provider.id}
                    className="hover:shadow-lg transition-shadow border-purple-200 bg-purple-50"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{provider.businessName}</CardTitle>
                          <CardDescription>
                            {provider.city && `${provider.city} • `}
                            {provider.user.firstName} {provider.user.lastName}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="mt-2 p-2 bg-purple-100 rounded-md">
                        <p className="text-sm font-medium text-purple-800">
                          Nästa besök i {nextVisit.location}:
                        </p>
                        <p className="text-sm text-purple-700">
                          {new Date(nextVisit.date + "T00:00:00").toLocaleDateString("sv-SE", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                          {nextVisit.startTime && nextVisit.endTime && (
                            <span className="ml-1">
                              kl {nextVisit.startTime} - {nextVisit.endTime}
                            </span>
                          )}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {provider.services.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Tjänster:</p>
                          <div className="space-y-1">
                            {provider.services.slice(0, 2).map((service) => (
                              <div key={service.id} className="text-sm flex justify-between">
                                <span>{service.name}</span>
                                <span className="text-gray-600">{service.price} kr</span>
                              </div>
                            ))}
                            {provider.services.length > 2 && (
                              <p className="text-xs text-gray-500">
                                +{provider.services.length - 2} fler tjänster
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      <Link href={`/providers/${provider.id}`}>
                        <Button className="w-full bg-purple-600 hover:bg-purple-700">
                          Se profil & boka
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {visitingArea && visitingProviders.length === 0 && !isSearching && (
            <Card className="mb-8 border-purple-200">
              <CardContent className="py-6 text-center">
                <p className="text-gray-600">
                  Inga leverantörer har planerade besök i &quot;{visitingArea}&quot; just nu.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Providers List */}
          {error ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Något gick fel</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={() => {
                  const geoParams = geo.userLocation
                    ? { latitude: geo.userLocation.lat, longitude: geo.userLocation.lng, radiusKm: geo.radiusKm }
                    : undefined
                  fetchProviders(search, city, geoParams)
                }}>
                  Försök igen
                </Button>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <ProviderCardSkeleton count={6} />
          ) : displayedProviders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {favorites.showFavoritesOnly ? "Inga favoriter matchar" : "Inga leverantörer hittades"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {favorites.showFavoritesOnly ? (
                    <>
                      Inga av dina följda leverantörer matchar de aktuella filtren.{" "}
                      <button
                        onClick={() => favorites.setShowFavoritesOnly(false)}
                        className="text-green-600 hover:text-green-700 font-medium"
                      >
                        Visa alla leverantörer
                      </button>
                    </>
                  ) : search || city || geo.userLocation ? (
                    <>
                      Prova att ändra dina sökfilter eller{" "}
                      <button
                        onClick={handleClearFilters}
                        className="text-green-600 hover:text-green-700 font-medium"
                      >
                        rensa alla filter
                      </button>
                    </>
                  ) : (
                    "Det finns inga leverantörer tillgängliga just nu. Kom tillbaka senare!"
                  )}
                </p>
                {user && user.userType === "provider" && !search && !city && !geo.userLocation && !favorites.showFavoritesOnly && (
                  <p className="text-sm text-gray-500">
                    Tips: Se till att din profil är komplett och att du har skapat minst en tjänst för att synas här.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <ProviderGrid providers={displayedProviders} />
          )}
        </div>
      </main>
    </div>
  )
}
