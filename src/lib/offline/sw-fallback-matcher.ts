/**
 * Determines if a failed request should fall back to the offline page.
 *
 * Handles both:
 * - Document requests (hard navigation: address bar, refresh, initial load)
 * - RSC requests (Next.js App Router client-side Link navigation)
 *
 * This logic is duplicated in src/sw.ts (which can't import from @/lib)
 * but kept here for testability.
 */
export function isNavigationOrRSCRequest(request: Request): boolean {
  if (request.destination === "document") return true
  if (request.headers.get("RSC") === "1") return true
  return false
}
