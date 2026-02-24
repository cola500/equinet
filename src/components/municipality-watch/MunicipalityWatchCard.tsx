"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MunicipalitySelect } from "@/components/ui/municipality-select"
import { ServiceTypeSelect } from "@/components/ui/service-type-select"
import { Label } from "@/components/ui/label"
import { useMunicipalityWatches } from "@/hooks/useMunicipalityWatches"
import { X } from "lucide-react"

export function MunicipalityWatchCard() {
  const { watches, isLoading, isSubmitting, addWatch, removeWatch } = useMunicipalityWatches()
  const [municipality, setMunicipality] = useState("")
  const [serviceTypeName, setServiceTypeName] = useState("")

  const handleAdd = async () => {
    if (!municipality || !serviceTypeName.trim()) return
    const success = await addWatch(municipality, serviceTypeName.trim())
    if (success) {
      setMunicipality("")
      setServiceTypeName("")
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bevakningar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-20 bg-gray-100 rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bevakningar</CardTitle>
        <CardDescription>
          Få notis när leverantörer annonserar tjänster i ditt område
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new watch form */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="watch-municipality">Kommun</Label>
            <MunicipalitySelect
              id="watch-municipality"
              value={municipality}
              onChange={setMunicipality}
              placeholder="Välj kommun..."
            />
          </div>
          <div>
            <Label htmlFor="watch-service">Tjänstetyp</Label>
            <ServiceTypeSelect
              id="watch-service"
              value={serviceTypeName}
              onChange={setServiceTypeName}
              placeholder="Sök tjänstetyp..."
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={!municipality || !serviceTypeName.trim() || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "Lägger till..." : "Lägg till bevakning"}
          </Button>
        </div>

        {/* Existing watches list */}
        {watches.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            {watches.map((watch) => (
              <div
                key={watch.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <span className="font-medium">{watch.serviceTypeName}</span>
                  <span className="text-gray-500"> i </span>
                  <span className="font-medium">{watch.municipality}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeWatch(watch.id)}
                  aria-label={`Ta bort bevakning ${watch.serviceTypeName} i ${watch.municipality}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <p className="text-xs text-gray-500">
              {watches.length} av 10 bevakningar
            </p>
          </div>
        )}

        {watches.length === 0 && (
          <p className="text-sm text-gray-500">
            Du har inga aktiva bevakningar. Lägg till en ovan för att få notiser.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
