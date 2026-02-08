"use client"

import { useState, useEffect } from "react"

/**
 * SSR-safe hook that tracks a CSS media query.
 * Returns false during SSR and hydration, then updates on the client.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])

  return matches
}

/**
 * Convenience hook: true when viewport < 768px (mobile).
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)")
}
