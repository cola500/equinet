/**
 * Route optimizer client
 *
 * Calls /api/optimize-route, which orders the stops inside Equinet.
 * Only coordinates are sent; names and addresses never leave the page.
 * Errors are thrown with a Swedish, user-facing message; the caller logs them.
 */

import type { GeoPoint, StopOrderResult } from "@/lib/geo/route-optimization"

export { MAX_OPTIMIZE_ORDERS } from "@/lib/geo/route-optimization"

export type Location = GeoPoint
export type OptimizeResponse = StopOrderResult

const API_URL = '/api';

// Prefer the specific Zod message ("Högst 100 ...") over the generic "Valideringsfel"
function extractErrorMessage(data: unknown): string {
  const body = data as { error?: unknown; details?: { message?: unknown }[] } | null
  const detail = body?.details?.[0]?.message
  if (typeof detail === 'string') return detail
  if (typeof body?.error === 'string') return body.error
  return 'Optimering misslyckades'
}

/**
 * Optimize the visiting order. `route` holds indices into `orders`.
 */
export async function optimizeRoute(
  startLocation: Location,
  orders: Location[]
): Promise<OptimizeResponse> {
  const response = await fetch(`${API_URL}/optimize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      start_location: startLocation,
      orders: orders,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(extractErrorMessage(data));
  }

  return await response.json();
}
