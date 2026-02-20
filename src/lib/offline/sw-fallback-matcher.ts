/**
 * Determines if a failed request should fall back to the offline page.
 *
 * Only matches document requests (hard navigation: address bar, refresh, initial load).
 * RSC requests (Next.js App Router client-side Link navigation) are NOT matched --
 * serving HTML as an RSC fallback crashes Next.js because it expects RSC protocol.
 * Instead, RSC failures propagate to error.tsx which handles them client-side.
 *
 * This logic is duplicated in src/sw.ts (which can't import from @/lib)
 * but kept here for testability.
 */
export function isDocumentNavigationRequest(request: Request): boolean {
  return request.destination === "document"
}
