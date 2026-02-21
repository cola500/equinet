# Plan: Fix offline auth -- cacha session for offline-navigering

## Kontext

Forsta fixen (PR #25) lade till `networkTimeoutSeconds: 3` pa RSC/page cache-regler,
utokad fallback-matcher och inaktiverad `navigationPreload`. Det fixade SW-nivans caching.

**Men vid test pa iPhone visade sig ett djupare problem:**
1. Anvandare oppnar sida offline -> sidan laddar fran SW-cache (bra!)
2. `SessionProvider` -> `useSession()` -> hamtar `/api/auth/session`
3. `/api/auth/session` ar `NetworkOnly` i Serwists `defaultCache` -> misslyckas offline
4. `useAuth()` har ingen cachad session (React ref forsvinner vid sidstangning)
5. `isLoading: true` for evigt -> spinner, Header visar "Logga in"
6. Online igen -> session aterhamtas -> allt funkar

**Rotorsak:** `/api/auth/session` cachas ALDRIG (NetworkOnly). Nar anvandaren stanger
och oppnar sidan offline forsvinner React-refen och det finns inget satt att fa sessionen.

## Losning

Lagg till EN cache-regel i `src/sw.ts` FORE `defaultCache` som cachar
`/api/auth/session` med NetworkFirst + 3s timeout.

Serwist anvander first-match-wins, sa var regel matchar `/api/auth/session` fore
defaultCache's generella `/api/auth/*` (NetworkOnly). Alla andra auth-endpoints
(signin, signout, csrf, etc.) forblir NetworkOnly.

### Varfor ar detta sakert?

- Sessionscookien ar HTTP-only JWT -- den faktiska autentiseringen sker via cookien, inte det cachade API-svaret
- Cachade svaret innehaller bara anvandarinfo (namn, email, roll) -- inget hemligt
- SW-cachen har samma sakerhetsgrens som browserns vanliga cache
- 24h expiry -- rimligt for en offline-session
- Nar anvandaren loggar ut online skrivs cachen over med null-session

### Effekt pa `useAuth()` (ingen andring behovs)

Med SW-fixen:
1. Offline -> `useSession()` hamtar `/api/auth/session` -> SW serverar cachad respons
2. `status` blir `"authenticated"` (inte `"loading"`)
3. `cachedAuthRef.current` fylls i av rad 21-29 i useAuth.ts
4. Allt fungerar som online

---

## Fas 1: Modifiera `src/sw.ts`

Lagg till en auth session cache-regel i `navigationCaching`-arrayen:

```typescript
// Auth session: cache for offline access
// (other auth endpoints stay NetworkOnly via defaultCache)
{
  matcher: ({ url: { pathname }, sameOrigin }) =>
    sameOrigin && pathname === "/api/auth/session",
  method: "GET",
  handler: new NetworkFirst({
    cacheName: "auth-session",
    plugins: [
      new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 24 * 60 * 60 }),
    ],
    networkTimeoutSeconds: PAGE_TIMEOUT,
  }),
},
```

Denna regel laggs till i `navigationCaching`-arrayen FORE `...defaultCache`.

## Fas 2: Verifiering

1. `npm run test:run` -- alla tester passar (inga kodandringar utanfor sw.ts)
2. `npm run typecheck` -- inga typfel (sw.ts exkluderad)
3. `npm run lint` -- inga lint-fel

---

## Filer att andra

| Fil | Aktion | Beskrivning |
|-----|--------|-------------|
| `src/sw.ts` | **Andra** | Lagg till auth session cache-regel |

## Manuell verifiering pa iPhone

1. Deploya till Vercel
2. Besok nagra sidor online (bygger cache)
3. Stang Safari helt
4. Sla pa flygplanslage
5. Oppna sidan igen -> ska visa dig som inloggad + kunna navigera
