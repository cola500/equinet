import { useState, useCallback } from "react"

export interface GeoLocation {
  lat: number
  lng: number
}

export function useGeoFiltering() {
  const [userLocation, setUserLocation] = useState<GeoLocation | null>(null)
  const [radiusKm, setRadiusKm] = useState(50)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [searchPlace, setSearchPlace] = useState("")
  const [searchPlaceName, setSearchPlaceName] = useState<string | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Din webbläsare stöder inte platsdelning")
      return
    }

    setLocationLoading(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setSearchPlaceName(null)
        setSearchPlace("")
        setLocationLoading(false)
      },
      (err) => {
        console.error("Geolocation error:", err)
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError(
              "Du nekade platsåtkomst. Tillåt platsdelning i webbläsarens inställningar."
            )
            break
          case err.POSITION_UNAVAILABLE:
            setLocationError("Din plats kunde inte fastställas")
            break
          case err.TIMEOUT:
            setLocationError("Det tog för lång tid att hämta din plats")
            break
          default:
            setLocationError("Kunde inte hämta din plats")
        }
        setLocationLoading(false)
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    )
  }, [])

  const handleSearchPlace = useCallback(async () => {
    const trimmed = searchPlace.trim()
    if (!trimmed) return

    setIsGeocoding(true)
    setLocationError(null)

    try {
      const response = await fetch(
        `/api/geocode?address=${encodeURIComponent(trimmed)}`
      )
      if (response.ok) {
        const data = await response.json()
        setUserLocation({ lat: data.latitude, lng: data.longitude })
        setSearchPlaceName(trimmed)
      } else {
        setLocationError(
          "Kunde inte hitta platsen. Prova en annan ort eller postnummer."
        )
      }
    } catch {
      setLocationError("Något gick fel vid sökning. Försök igen.")
    } finally {
      setIsGeocoding(false)
    }
  }, [searchPlace])

  const clearLocation = useCallback(() => {
    setUserLocation(null)
    setLocationError(null)
    setSearchPlaceName(null)
    setSearchPlace("")
  }, [])

  return {
    userLocation,
    radiusKm,
    setRadiusKm,
    locationLoading,
    locationError,
    searchPlace,
    setSearchPlace,
    searchPlaceName,
    isGeocoding,
    requestLocation,
    handleSearchPlace,
    clearLocation,
  }
}
