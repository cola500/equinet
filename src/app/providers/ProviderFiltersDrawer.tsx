import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { MapPin, Heart } from "lucide-react"
import type { useGeoFiltering } from "@/hooks/useGeoFiltering"

interface ProviderFiltersDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  city: string
  onCityChange: (value: string) => void
  visitingArea: string
  onVisitingAreaChange: (value: string) => void
  geo: ReturnType<typeof useGeoFiltering>
  isCustomer: boolean
  followEnabled: boolean
  followedIds: Set<string>
  showFavoritesOnly: boolean
  onToggleFavorites: () => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function ProviderFiltersDrawer({
  open,
  onOpenChange,
  city,
  onCityChange,
  visitingArea,
  onVisitingAreaChange,
  geo,
  isCustomer,
  followEnabled,
  followedIds,
  showFavoritesOnly,
  onToggleFavorites,
  hasActiveFilters,
  onClearFilters,
}: ProviderFiltersDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filter</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Filtrera på ort
            </label>
            <Input
              placeholder="T.ex. Stockholm, Göteborg..."
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Besöker område
            </label>
            <Input
              placeholder="T.ex. Täby, Sollentuna..."
              value={visitingArea}
              onChange={(e) => onVisitingAreaChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Sök i närheten
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Ort eller postnummer..."
                value={geo.searchPlace}
                onChange={(e) => geo.setSearchPlace(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") geo.handleSearchPlace()
                }}
                className="flex-1"
              />
              <Button
                onClick={geo.handleSearchPlace}
                disabled={geo.isGeocoding || !geo.searchPlace.trim()}
                variant="outline"
              >
                {geo.isGeocoding ? "Söker..." : "Sök"}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={geo.requestLocation}
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={geo.locationLoading}
            >
              <MapPin className="h-4 w-4 mr-2" />
              {geo.locationLoading ? "Hämtar..." : "Min position"}
            </Button>
            {geo.userLocation && (
              <select
                value={geo.radiusKm}
                onChange={(e) => geo.setRadiusKm(Number(e.target.value))}
                className="border rounded-md px-3 py-2 touch-target text-sm bg-white"
              >
                <option value={25}>25 km</option>
                <option value={50}>50 km</option>
                <option value={100}>100 km</option>
                <option value={200}>200 km</option>
              </select>
            )}
          </div>
          {geo.locationError && (
            <p className="text-sm text-red-600">{geo.locationError}</p>
          )}
          {isCustomer && followEnabled && followedIds.size > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Favoriter
              </label>
              <Button
                variant={showFavoritesOnly ? "default" : "outline"}
                className="w-full min-h-[44px]"
                onClick={onToggleFavorites}
                aria-pressed={showFavoritesOnly}
                data-testid="favorites-filter-button-mobile"
              >
                <Heart
                  className={`h-4 w-4 mr-1.5 ${showFavoritesOnly ? "fill-current" : ""}`}
                />
                Visa bara favoriter ({followedIds.size})
              </Button>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            {hasActiveFilters && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onClearFilters()
                  onOpenChange(false)
                }}
              >
                Rensa filter
              </Button>
            )}
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Visa resultat
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
