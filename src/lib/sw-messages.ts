/**
 * Message-type constants shared between the client (src/lib/sw-client.ts) and
 * the service worker (src/sw.ts). Kept in their own tiny module with zero
 * service-worker-only imports so the client bundle never pulls in SW code.
 */

/** Client -> SW: delete every cache that may hold per-user data. */
export const SW_MESSAGE_CLEAR_USER_CACHES = "CLEAR_USER_CACHES"

/** SW -> client: acknowledges CLEAR_USER_CACHES completed. */
export const SW_MESSAGE_USER_CACHES_CLEARED = "USER_CACHES_CLEARED"
