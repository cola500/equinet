import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker"
import type { PrecacheEntry, RuntimeCaching } from "serwist"
import { Serwist, NetworkFirst, ExpirationPlugin } from "serwist"
import { authSessionMatcher } from "./sw-matchers"

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[]
}

/**
 * Notify all client windows when a network fetch fails.
 *
 * This is the primary offline detection mechanism -- zero polling, zero server
 * cost. The client-side useOnlineStatus() hook listens for SW_FETCH_FAILED
 * messages and calls reportConnectivityLoss().
 */
const connectivityNotifier = {
  fetchDidFail: async () => {
    const clients = await self.clients.matchAll({ type: "window" })
    for (const client of clients) {
      client.postMessage({ type: "SW_FETCH_FAILED" })
    }
  },
}

/**
 * Network timeout for page/RSC requests (seconds).
 *
 * Without this, NetworkFirst waits for the network to fail completely before
 * checking the cache. On iOS Safari this can hang indefinitely, causing a
 * blank screen when navigating offline. 3 seconds is aggressive enough for
 * quick failover while still preferring fresh data on moderate connections.
 */
const PAGE_TIMEOUT = 3

/**
 * Custom runtime caching rules prepended before defaultCache.
 *
 * Serwist uses first-match-wins: our rules override the page/RSC behavior
 * from defaultCache while letting static asset rules (JS, CSS, images, fonts)
 * continue to match from defaultCache further down the list.
 */
const navigationCaching: RuntimeCaching[] = [
  // Auth session: cache so useSession() works offline
  {
    matcher: authSessionMatcher,
    handler: new NetworkFirst({
      cacheName: "auth-session",
      plugins: [
        new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 24 * 60 * 60 }),
        connectivityNotifier,
      ],
      networkTimeoutSeconds: PAGE_TIMEOUT,
    }),
  },
  // RSC Prefetch: Next.js Link prefetch -- NetworkFirst with fast timeout
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      request.headers.get("RSC") === "1" &&
      request.headers.get("Next-Router-Prefetch") === "1" &&
      sameOrigin &&
      !pathname.startsWith("/api/"),
    handler: new NetworkFirst({
      cacheName: PAGES_CACHE_NAME.rscPrefetch,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }),
        connectivityNotifier,
      ],
      networkTimeoutSeconds: PAGE_TIMEOUT,
    }),
  },
  // RSC: Next.js App Router client-side navigation -- NetworkFirst with fast timeout
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      request.headers.get("RSC") === "1" &&
      sameOrigin &&
      !pathname.startsWith("/api/"),
    handler: new NetworkFirst({
      cacheName: PAGES_CACHE_NAME.rsc,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }),
        connectivityNotifier,
      ],
      networkTimeoutSeconds: PAGE_TIMEOUT,
    }),
  },
  // HTML navigation: hard nav, address bar, refresh -- NetworkFirst with fast timeout
  // Uses request.mode === "navigate" (the correct check for navigation requests,
  // unlike defaultCache which checks Content-Type on the request which rarely matches)
  {
    matcher: ({ request, url: { pathname }, sameOrigin }) =>
      request.mode === "navigate" &&
      sameOrigin &&
      !pathname.startsWith("/api/"),
    handler: new NetworkFirst({
      cacheName: PAGES_CACHE_NAME.html,
      plugins: [
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }),
        connectivityNotifier,
      ],
      networkTimeoutSeconds: PAGE_TIMEOUT,
    }),
  },
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false, // Safari does not support Navigation Preload API
  runtimeCaching: [...navigationCaching, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          // Only catch document requests (hard navigation, refresh).
          // RSC requests must NOT get HTML fallback -- Next.js can't parse HTML
          // as RSC protocol, causing a crash. RSC failures propagate to error.tsx.
          return request.destination === "document"
        },
      },
    ],
  },
})

serwist.addEventListeners()
