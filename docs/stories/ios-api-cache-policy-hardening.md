---
title: "iOS API cache-policy hardening"
description: "Hindra URLSession från att cacha transienta 404-svar från Vercel CDN i native API-anrop. Bug upptäckt under S67-7 staging-cutover."
category: plan
status: active
last_updated: 2026-05-09
tags: [ios, networking, vercel, staging, cache, hardening]
related:
  - ../sprints/sprint-67-ios-staging-capability.md
  - ../../.claude/rules/ios-learnings.md
sections:
  - Problem
  - Reproduktion
  - Root cause
  - 5 Whys
  - Vald lösning
  - Riskbedömning
  - Acceptanskriterier
  - Verifieringsplan
  - Lärdom till memory
---

# iOS API cache-policy hardening

## Problem

iOS APIClient i `Equinet.app` använder default `URLRequest.cachePolicy = .useProtocolCachePolicy`. Vercel CDN sätter `cache-control: public, s-maxage=N` på **alla svar inklusive 4xx-fel**. URLSession respekterar detta och cachar 404-svar lokalt i `Library/Caches`. Vid transienta routing-glitchar (DNS-cutover, edge-cache-miss, deploy-rollover) får appen ett 404 som sedan **fastnar i cachen** och inte återhämtar sig automatiskt.

## Reproduktion

Bevisat under Sprint 67 S67-7 (2026-05-09):

1. iOS-app pekar på `https://equinet-staging.johanlindengard.com` (staging custom domain)
2. Domain-mappning genomförs (S67-5 DNS-flytt: domain flyttas från `equinet-app` preview till `equinet-staging-app` production)
3. iOS-app loggar in som Erik Järnfot (Supabase Auth direkt mot Supabase, fungerar)
4. iOS APIClient `fetchDashboard()` skickar GET `/api/native/dashboard`
5. Första request hamnar på Vercel edge-nod som inte hade uppdaterad domain-mapping → returnerar **HTTP 404 DEPLOYMENT_NOT_FOUND** + `cache-control: public, max-age=N`
6. URLSession cachar svaret enligt RFC
7. Alla efterföljande requests inom cache-TTL → CFNetwork loggar `cache_hit=true`, `response_status=404`
8. **Curl från terminal mot samma URL fungerar** (HTTP 401 från Next.js — förväntat utan auth)
9. Klick på "Försök igen" i appen → fortfarande 404 (cached)
10. Manuell rensning krävs: `simctl uninstall` + `simctl install` + `simctl launch` → fungerar

## Root cause

**iOS APIClient använder default `URLSession`-cache-policy som cachar Vercel:s 404-svar i 5+ minuter.** Detta gör att en transient DNS-mappnings-glitch (vanlig vid custom-domain-flytt) **fastnar** i app-cachen och inte återhämtar sig automatiskt utan force-clear.

Bevis från CFNetwork-logg under S67-7:
```
Task <A7E7A151-...>.<4> summary {response_status=404, cache_hit=true, ...}
Task <DB985EE4-...>.<2> summary {response_status=404, cache_hit=true, ...}
Task <95E91E35-...>.<3> summary {response_status=404, cache_hit=true, ...}
```

## 5 Whys

1. **Varför failade dashboard-fetchen?**
   HTTP 404 DEPLOYMENT_NOT_FOUND från Vercel.

2. **Varför fick iOS 404 medan curl fick 401 från samma URL?**
   iOS URLSession serverade 404 från **lokal cache** (`cache_hit=true`). Curl gjorde alltid riktig request → fick 401 från Next.js.

3. **Varför fanns en cachad 404 i URLSession?**
   Första request efter login (under DNS-flytt) hamnade på edge-nod utan uppdaterad mapping → 404 + `cache-control: max-age=N`. URLSession respekterade headern och cachade.

4. **Varför respekterade URLSession cache-control på ett 404-svar?**
   APIClient använder default `URLRequest.cachePolicy = .useProtocolCachePolicy`. RFC tillåter caching av 404 om servern säger det. URLSession följer protokollet.

5. **Varför sätter Vercel cache-control på fel-svar?**
   Vercel:s edge-CDN cachar alla svar (inkl. 4xx) per default för att skydda origin från upprepad belastning. Plattformsbeteende, inte vår config — vi har ingen kontroll över Vercel CDN:s 404-headers.

## Vald lösning (Alt A)

Sätt `request.cachePolicy = .reloadIgnoringLocalCacheData` på alla native API-requests i `APIClient.swift`. Detta gör att URLSession alltid hämtar färska svar och **aldrig** använder lokal cache för API-anrop.

**Scope:**
- `APIClient.performRequest` (alla auth-skyddade native API-anrop)
- `APIClient.fetchFeatureFlags` (publik /api/feature-flags)
- `APIClient.uploadProfileImage` (multipart upload)

**Inte i scope:**
- WebView-trafik (har egen cache-strategi via WKWebView)
- Asset/bild-fetch (offline-tillgängliga, ska cachas)
- Offline-mode IndexedDB-cache (separat lager via SWRProvider)

## Riskbedömning

| Risk | Sannolikhet | Konsekvens | Mitigering |
|---|---|---|---|
| Ökad nätverkstrafik (varje API-anrop hämtar nytt) | Säker | Marginal — Equinet API-svar har korta TTLs, ingen meningsfull cachning sker idag heller | Acceptabelt; serverside-cache (Upstash Redis) skyddar origin |
| Snäv batterianvändning vid återkommande polling | Mycket låg | Inga API-anrop görs i tight loop; SWR-polling sker via WebView, inte native | N/A |
| Performance-regression vid långsam network | Låg | Native vyer ökar latens marginellt (ingen lokal cache fallback) | Befintlig SharedDataManager `UserDefaults`-cache fortfarande aktiv för dashboard/calendar |
| Bryter befintliga tester | Låg | URLProtocol-mock i APIClientTests respekterar inte cache-policy direkt | Lägg till explicit cachePolicy-assertion i ny test |

## Acceptanskriterier

- [ ] `request.cachePolicy = .reloadIgnoringLocalCacheData` satt på alla URLRequest-instanser i `APIClient.swift`
- [ ] Befintliga 9 APIClientTests fortsatt gröna
- [ ] Ny test verifierar att cachePolicy är satt korrekt på minst en GET- och en POST-request
- [ ] Manuell verifiering: efter DNS-cutover eller redeploy återhämtar appen sig **utan** uninstall/reinstall
- [ ] Inget tillägg av nya beroenden
- [ ] Ingen kod-ändring utanför `APIClient.swift` + `APIClientTests.swift`

## Verifieringsplan

### Nivå 1 — Unit (XCTest, ~1s)

Ny test i `APIClientTests.swift`:
```swift
func testRequestCachePolicyIsReloadIgnoring() async throws {
    var capturedPolicy: URLRequest.CachePolicy?
    MockURLProtocol.mockHandler = { request in
        capturedPolicy = request.cachePolicy
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, ...)
        return (response, validJSON)
    }
    _ = try await sut.fetchDashboard()
    XCTAssertEqual(capturedPolicy, .reloadIgnoringLocalCacheData)
}
```

Kör: `xcodebuild test ... -only-testing:EquinetTests/APIClientTests`

### Nivå 2 — Manuell DNS-cutover-test (efter merge)

1. Logga in som Erik i staging-app
2. Trigga dashboard-fetch → grön
3. Force domain-rotation (t.ex. ny deploy som inkluderar Force-rebuild)
4. Trigga dashboard-fetch igen → grön (utan uninstall)

### Nivå 3 — Network-trace (post-merge sanity)

Använd Xcode Instruments → Network-templat → kör appen → verifiera att alla requests till `/api/native/*` har **`Cache-Status: NotCached`** (eller liknande) i request-detalj.

## Lärdom till memory

- **Vercel cachar 404 via cache-control headers** — gäller alla deployments med standard CDN
- **iOS URLSession följer cache-control enligt RFC** — även för fel-svar om servern tillåter
- **Default `URLRequest.cachePolicy` är olämplig för auth-kritiska API-flöden** — använd `.reloadIgnoringLocalCacheData` på native API-clients
- **Workaround vid problem:** `simctl uninstall + install + launch` rensar URLSession-cache (också `Library/Caches/com.equinet.Equinet/` + `Library/HTTPStorages/com.equinet.Equinet/`)
- **Identifiering:** CFNetwork-logg `cache_hit=true` + `response_status=4xx` → cache-relaterat
