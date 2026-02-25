import { useEffect, useState, useCallback } from "react"

export function useFavoritesFilter(
  isCustomer: boolean,
  followEnabled: boolean,
  initialShowFavorites: boolean
) {
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(initialShowFavorites)

  useEffect(() => {
    if (!isCustomer || !followEnabled) return
    fetch("/api/follows")
      .then((res) => (res.ok ? res.json() : []))
      .then((follows: Array<{ providerId: string }>) => {
        setFollowedIds(new Set(follows.map((f) => f.providerId)))
      })
      .catch(() => {
        // Silently fail -- favorites filter just won't be available
      })
  }, [isCustomer, followEnabled])

  const toggleFavorites = useCallback(
    () => setShowFavoritesOnly((prev) => !prev),
    []
  )

  return { followedIds, showFavoritesOnly, setShowFavoritesOnly, toggleFavorites }
}
