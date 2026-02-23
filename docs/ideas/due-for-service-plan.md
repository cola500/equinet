# Implementeringsplan: "Due for Service" + Ruttannons-notifiering

> Baserat på: `docs/ideas/due for service+ notice.md`
> Skapad: 2026-02-23
> Senast uppdaterad: 2026-02-23

## Status

| Fas | Status | Commits |
|-----|--------|---------|
| Fas 1: Kund-synlig due-for-service | **KLAR** | `2e93f3f`, `144dd9c`, `0e38bfa` |
| Fas 1 bonus: Kundstyrda intervall | **KLAR** | `2e93f3f`, `0e38bfa` |
| Fas 2: Hyperrelevant notis | Ej påbörjad | -- |
| Fas 3: Push-notiser | Ej påbörjad | -- |

**Supabase-migration applicerad:** `CustomerHorseServiceInterval` (2026-02-23)

---

## Kontext

Idedokumentet beskriver en hyperrelevant notis som kombinerar:
- Hastens service-status ("Blansen behovde skos for 2 veckor sedan")
- Ruttannons i kundens omrade ("Anna har lediga tider i Kungsbacka nasta vecka")

### Vad som redan finns

**Story 1 (berakningslogik) ar redan implementerad provider-side:**
- `GET /api/provider/due-for-service` med overdue/upcoming/ok-berakning
- Provider-dashboard pa `/provider/due-for-service`
- `HorseServiceInterval`-modell (per-hast-intervall-override per provider)
- `Service.recommendedIntervalWeeks` som default-intervall
- Berakningslogik inline i `src/app/api/provider/due-for-service/route.ts` (rad 116-155)
- Feature flag `due_for_service` (registrerad, default: true)

**Ruttannons + follow-system (session 56):**
- `RouteAnnouncementNotifier` med fire-and-forget + DI (`src/domain/notification/RouteAnnouncementNotifier.ts`)
- Factory: `src/domain/notification/RouteAnnouncementNotifierFactory.ts`
- `NotificationDelivery` dedup-tabell med unique constraint `[routeOrderId, customerId, channel]`
- `findFollowersInMunicipality()` i FollowRepository
- Email + in-app-notiser
- Feature flag `follow_provider` (default: false)
- Trigger: POST `/api/route-orders` fire-and-forget

**PushSubscription-modell finns som stub i schema (ej implementerad).**

---

## Fas 1: Kund-synlig "due for service"-status -- KLAR

**Mal:** Kunder ser direkt pa sin hastlista vilka hastar som behover service. Ger omedelbart varde -- kunder far proaktiv information utan att leverantoren behover gora nagot.

### 1.1 Extrahera DueForServiceCalculator -- KLAR

Berakningslogiken i provider-routen (rad 116-155) extraheras till en ren, testbar domanfunktion.

**Ny fil:** `src/domain/due-for-service/DueForServiceCalculator.ts`

```typescript
export type DueStatus = "overdue" | "upcoming" | "ok"

export interface HorseServiceRecord {
  horseId: string
  horseName: string
  serviceId: string
  serviceName: string
  lastServiceDate: Date
  intervalWeeks: number // redan resolved (override > default)
}

export interface DueForServiceResult {
  horseId: string
  horseName: string
  serviceId: string
  serviceName: string
  lastServiceDate: string      // ISO 8601
  daysSinceService: number
  intervalWeeks: number
  dueDate: string              // ISO 8601
  daysUntilDue: number
  status: DueStatus
}

// Ren funktion -- inga Prisma-dependencies, testbar med valfria datum
export function calculateDueStatus(record: HorseServiceRecord, now?: Date): DueForServiceResult

// Interval-resolution: override har fortur over default
export function resolveInterval(defaultWeeks: number, overrideWeeks: number | null): number
```

**Ny fil:** `src/domain/due-for-service/DueForServiceCalculator.test.ts`

TDD-testfall:
1. Hast med senaste service 10 veckor sedan, 6-veckors intervall -> overdue
2. Hast med senaste service 5 veckor sedan, 6-veckors intervall -> upcoming (inom 14 dagar)
3. Hast med senaste service 2 veckor sedan, 6-veckors intervall -> ok
4. `resolveInterval` returnerar override nar den finns, default annars
5. Edge: daysUntilDue = 0 (forfaller idag) -> "upcoming"
6. Edge: daysUntilDue = 14 (exakt 2 veckor) -> "upcoming"
7. Edge: daysUntilDue = 15 -> "ok"
8. Korrekt berakning av `daysSinceService` och `dueDate`

### 1.2 DueForServiceService (data-access + berakning) -- KLAR

**Ny fil:** `src/domain/due-for-service/DueForServiceService.ts`

```typescript
export class DueForServiceService {
  // Alla kundens hastar -- returnerar overdue + upcoming (inte "ok")
  async getForCustomer(customerId: string): Promise<DueForServiceResult[]>

  // Specifik hast -- alla servicetyper
  async getForHorse(horseId: string, customerId: string): Promise<DueForServiceResult[]>
}
```

Logik:
1. Hamta completed bookings dar `customerId = X` OCH `horseId IS NOT NULL` OCH `service.recommendedIntervalWeeks IS NOT NULL`
2. Hamta alla `HorseServiceInterval`-overrides for kundens hastar
3. Deduplicate: behall senaste booking per (horseId, serviceId)
4. Kor `calculateDueStatus` pa varje
5. Sortera: mest bradskande forst (`daysUntilDue` ascending)
6. Filtrera bort "ok" (kunder behover inte se det)

Prisma direkt ar OK har -- det ar en read-only query service, inte en karndomansoperation.

**Ny fil:** `src/domain/due-for-service/DueForServiceService.test.ts`

### 1.3 Refaktorera provider-route -- KLAR

**Andra:** `src/app/api/provider/due-for-service/route.ts`
- Ersatt inline-berakning (rad 116-155) med import fran `DueForServiceCalculator`
- Ingen beteendeandring -- befintliga tester ska fortfarande passera
- Bade kund- och provider-vagen anrops samma berakningsfunktion

### 1.4 Kund-API -- KLAR

**Ny fil:** `src/app/api/customer/due-for-service/route.ts`

```
GET /api/customer/due-for-service
GET /api/customer/due-for-service?horseId=xxx
```

Foljer standard API-route-struktur:
1. `auth()` -- maste vara kund
2. Rate limiting
3. Feature flag check: `isFeatureEnabled("due_for_service")`
4. Instansiera `DueForServiceService`
5. Om `horseId` query param: `getForHorse(horseId, session.user.id)`
6. Annars: `getForCustomer(session.user.id)`
7. Returnera `{ items: [...] }`

**Ny fil:** `src/app/api/customer/due-for-service/route.test.ts`

Testfall:
1. 401 for oautentiserad
2. 403 for provider-anvandare
3. Returnerar overdue/upcoming hastar
4. Feature flag avstangd -> tomt/404
5. horseId-filter fungerar
6. Ownership check: kan inte fraga om annan kunds hast

### 1.5 SWR-hook -- KLAR

**Ny fil:** `src/hooks/useDueForService.ts`

```typescript
export function useDueForService() {
  // SWR hook for /api/customer/due-for-service
  // Hamtar bara nar due_for_service-flaggan ar pa
}
```

### 1.6 UI: Badges pa hastlistan -- KLAR

**Andra:** `src/app/customer/horses/page.tsx`

- Importera `useDueForService` + `useFeatureFlag("due_for_service")`
- `DueStatusBadge` inline-komponent (liten, ingen extra fil)
  - Rod badge: "Forsenad" (overdue)
  - Gul badge: "Snart dags" (upcoming)
- Matcha due-items mot horse.id, visa mest bradskande per hast
- Bara synligt nar feature flag ar pa
- **Bonus:** Badges visar tjanstnamn ("Hovvard: Forsenad")

### 1.7 Kundstyrda serviceintervall (bonus, ej i ursprunglig plan) -- KLAR

Utokade fas 1 med mojlighet for kunder att satta egna intervall per hast+tjanst:

- **Ny modell:** `CustomerHorseServiceInterval` (horseId, serviceId, intervalWeeks, unique constraint)
- **Migration:** `20260223121939_add_customer_horse_service_interval` (applicerad pa Supabase 2026-02-23)
- **3-tier prioritet:** Kundintervall > Provider-rekommendation > Service default
- **CRUD API:** `GET/PUT/DELETE /api/customer/horses/[horseId]/intervals` + tester
- **UI:** Fliksystem pa hastdetaljsidan (Historik/Intervall/Info) med URL-state
- **Hastar utan recommendedIntervalWeeks** inkluderas om kund satt intervall

### Fas 1 sammanfattning

| Typ | Fil | Status |
|-----|-----|--------|
| NY | `src/domain/due-for-service/DueForServiceCalculator.ts` | KLAR |
| NY | `src/domain/due-for-service/DueForServiceCalculator.test.ts` | KLAR |
| NY | `src/domain/due-for-service/DueForServiceService.ts` | KLAR |
| NY | `src/domain/due-for-service/DueForServiceService.test.ts` | KLAR |
| ANDRA | `src/app/api/provider/due-for-service/route.ts` | KLAR (refaktorerad) |
| NY | `src/app/api/customer/due-for-service/route.ts` | KLAR |
| NY | `src/app/api/customer/due-for-service/route.test.ts` | KLAR |
| NY | `src/hooks/useDueForService.ts` | KLAR |
| ANDRA | `src/app/customer/horses/page.tsx` | KLAR |
| NY | `src/app/api/customer/horses/[horseId]/intervals/route.ts` | KLAR (bonus) |
| NY | `src/app/api/customer/horses/[horseId]/intervals/route.test.ts` | KLAR (bonus) |
| ANDRA | `src/app/customer/horses/[id]/page.tsx` | KLAR (bonus, fliksystem) |
| NY | `src/components/ui/tabs.tsx` | KLAR (bonus) |
| NY | `prisma/migrations/20260223121939_.../migration.sql` | KLAR |

**Migration:** `CustomerHorseServiceInterval` -- applicerad pa Supabase 2026-02-23.
**Beroenden:** Inga nya.

---

## Fas 2: Hyperrelevant notis (Due + Ruttannons)

**Mal:** Foljare med forsenade hastar far en personlig notis nar leverantoren annonserar i deras kommun:
> "Blansen behovde skos for 2 veckor sedan. Anna har lediga tider i Kungsbacka nasta vecka."

Foljare utan forsenade hastar far standard ruttannons-notisen (oforandrat beteende).

### 2.1 DueForServiceLookup (adapter)

**Ny fil:** `src/domain/due-for-service/DueForServiceLookup.ts`

```typescript
export interface DueForServiceLookup {
  getOverdueHorsesForCustomer(customerId: string): Promise<{
    horseName: string
    serviceName: string
    daysOverdue: number
  }[]>
}

export class PrismaDueForServiceLookup implements DueForServiceLookup {
  // Anvander DueForServiceService fran fas 1
  // Filtrerar till enbart overdue-items
}
```

**Ny fil:** `src/domain/due-for-service/DueForServiceLookup.test.ts`

**Prestandaoptimering:** Batch-hamta for alla followers i ett anrop istallet for N separata queries. `getOverdueHorsesForCustomers(customerIds[])` -> `Map<customerId, overdueHorses[]>`.

### 2.2 Utoka RouteAnnouncementNotifier

**Andra:** `src/domain/notification/RouteAnnouncementNotifier.ts`

Andringar i `NotifierDeps`:
```typescript
interface NotifierDeps {
  // ... befintliga deps ...
  dueForServiceLookup?: DueForServiceLookup  // NY, optional for backward compat
}
```

I follower-loopen (rad 89-145), efter dedup-check:

```
1. Om dueForServiceLookup finns -> hamta overdue-hastar for denna foljare
2. Om overdue hast finns:
   - Valj mest forsenade hasten
   - Bygg forbattrat meddelande: "{hast} behovde {tjanst} for {tid} sedan. {leverantor} har lediga tider i {kommun} ({datum})."
   - Anvand notis-typ ROUTE_ANNOUNCEMENT_DUE_HORSE
   - Metadata: overdueHorseName, routeOrderId, providerId, municipality
3. Om ingen overdue hast:
   - Standard meddelande (befintligt beteende, oforandrat)
   - Notis-typ ROUTE_ANNOUNCEMENT_NEW
```

Forbattrad email-template:
- Amber/rod header istallet for gron
- Prominent hastnamn och overdue-formulering
- Samma CTA-knapp till annonseringssidan

### 2.3 Utoka Factory (asynkron)

**Andra:** `src/domain/notification/RouteAnnouncementNotifierFactory.ts`

```typescript
// Blir async (feature flag check)
export async function createRouteAnnouncementNotifier(): Promise<RouteAnnouncementNotifier> {
  const dueEnabled = await isFeatureEnabled("due_for_service")
  return new RouteAnnouncementNotifier({
    // ... befintliga deps ...
    dueForServiceLookup: dueEnabled ? new PrismaDueForServiceLookup() : undefined,
  })
}
```

### 2.4 Uppdatera trigger i route-orders

**Andra:** `src/app/api/route-orders/route.ts`

Andras fran synkront fabriksanrop till:
```typescript
createRouteAnnouncementNotifier()
  .then(notifier => notifier.notifyFollowersOfNewRoute(announcement.id))
  .catch(err => logger.error("Route announcement notification failed", err))
```

### 2.5 Ny notis-typ

**Andra:** `src/domain/notification/NotificationService.ts`
```typescript
ROUTE_ANNOUNCEMENT_DUE_HORSE: "route_announcement_due_horse",
```

### 2.6 Tester

**Andra:** `src/domain/notification/RouteAnnouncementNotifier.test.ts`

Nya testfall:
1. Foljare MED overdue hast -> forbattrat meddelande med hastnamn
2. Foljare UTAN overdue hast -> standard meddelande
3. `dueForServiceLookup` undefined (feature av) -> alla far standard
4. Flera overdue hastar -> valjer mest forsenade
5. Dedup fungerar for forbattrade notiser
6. Email-template skiljer sig for forbattrade notiser
7. Metadata inkluderar `overdueHorseName`

### Fas 2 sammanfattning

| Typ | Fil | Uppskattning |
|-----|-----|-------------|
| NY | `src/domain/due-for-service/DueForServiceLookup.ts` | ~40 rader |
| NY | `src/domain/due-for-service/DueForServiceLookup.test.ts` | ~50 rader |
| ANDRA | `src/domain/notification/RouteAnnouncementNotifier.ts` | ~+80 rader |
| ANDRA | `src/domain/notification/RouteAnnouncementNotifier.test.ts` | ~+80 rader |
| ANDRA | `src/domain/notification/RouteAnnouncementNotifierFactory.ts` | ~+15 rader |
| ANDRA | `src/domain/notification/NotificationService.ts` | ~+1 rad |
| ANDRA | `src/app/api/route-orders/route.ts` | ~+3 rader |

**Migration:** Inga schemaaandringar.
**Beroenden:** Inga nya.
**Feature flags:** Kraver bade `due_for_service` OCH `follow_provider` for full effekt.

---

## Fas 3: Push-notiser

**Mal:** Kunder far push-notis utover in-app + email. Robust fallback om ingen push-token.

### 3.1 VAPID-nycklar (env)

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:support@equinet.se
```

Lagg till i `.env.example`.

### 3.2 Push-service (server)

**Ny fil:** `src/lib/push/push-service.ts`

```typescript
export class PushService {
  // Hamtar alla subscriptions for userId, skickar till var och en
  async sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number; expired: number }>

  // Enskild push
  async sendToSubscription(subscription: PushSubscriptionData, payload: PushPayload): Promise<boolean>
}
```

- Dependency: `web-push` npm-paket (verifiera aktuell version fore installation)
- 410 Gone -> rensa stale subscription automatiskt
- Errors loggas men kastas inte uppat

**Ny fil:** `src/lib/push/push-service.test.ts`

### 3.3 Push-subscription API

**Ny fil:** `src/app/api/push/subscribe/route.ts`
```
POST /api/push/subscribe
Body: { endpoint, keys: { p256dh, auth } }
```
- Auth (kund), Zod-validering, rate limiting
- Upsert i PushSubscription (endpoint ar unique)

**Ny fil:** `src/app/api/push/unsubscribe/route.ts`
```
POST /api/push/unsubscribe
Body: { endpoint }
```

**Ny fil:** `src/app/api/push/subscribe/route.test.ts`

### 3.4 Service Worker push-handler

**Andra:** `src/sw.ts`

```typescript
self.addEventListener("push", (event) => {
  const data = event.data?.json()
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/icon-192x192.png",
    data: { url: data.url },
    tag: data.tag,  // Dedup-nyckel
  }))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url))
})
```

### 3.5 Klient-komponent

**Ny fil:** `src/components/notifications/PushPermissionPrompt.tsx`
- Visas i kunddashboard/profil
- Kontrollerar `Notification.permission`
- "default" -> visa prompt -> `requestPermission()` -> `pushManager.subscribe()` -> POST API
- "denied" -> informera om browserinstallningar
- "granted" -> gom prompt

**Ny fil:** `src/hooks/usePushSubscription.ts`

### 3.6 Integrera push i Notifier

**Andra:** `src/domain/notification/RouteAnnouncementNotifier.ts`

Ny optional dependency:
```typescript
interface PushSender {
  sendToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }): Promise<{ sent: number }>
}
```

I loopen efter in-app + email:
```
1. Om pushSender finns
2. Dedup-check: deliveryStore.exists(routeOrderId, userId, "push")
3. Om inte levererad: pushSender.sendToUser(userId, { title, body, url, tag })
4. Om sent > 0: deliveryStore.create(routeOrderId, userId, "push")
5. Errors loggas men blockerar inte
```

### Fas 3 sammanfattning

| Typ | Fil | Uppskattning |
|-----|-----|-------------|
| NY | `src/lib/push/push-service.ts` | ~80 rader |
| NY | `src/lib/push/push-service.test.ts` | ~80 rader |
| NY | `src/app/api/push/subscribe/route.ts` | ~60 rader |
| NY | `src/app/api/push/unsubscribe/route.ts` | ~40 rader |
| NY | `src/app/api/push/subscribe/route.test.ts` | ~80 rader |
| NY | `src/components/notifications/PushPermissionPrompt.tsx` | ~80 rader |
| NY | `src/hooks/usePushSubscription.ts` | ~50 rader |
| ANDRA | `src/sw.ts` | ~+20 rader |
| ANDRA | `src/domain/notification/RouteAnnouncementNotifier.ts` | ~+30 rader |
| ANDRA | `src/domain/notification/RouteAnnouncementNotifierFactory.ts` | ~+5 rader |
| ANDRA | `src/domain/notification/RouteAnnouncementNotifier.test.ts` | ~+40 rader |

**Migration:** Ingen -- PushSubscription-modellen finns redan i schema.
**Beroenden:** `web-push` npm-paket (ny).

---

## Verifiering per fas

### Fas 1
1. `npm run test:run` -- alla nya + befintliga tester grona
2. `npm run typecheck` -- 0 errors
3. Manuellt: logga in som kund med hast som har completed booking -> se badge pa hastlistan
4. Manuellt: provider due-for-service-sidan fungerar som innan (refaktor-verifiering)

### Fas 2
1. `npm run test:run` -- nya notifier-tester grona
2. Manuellt: skapa ruttannons i kommun med foljare som har overdue hast -> kontrollera forbattrat meddelande
3. Manuellt: foljare utan overdue hast -> standard meddelande (ingen regression)

### Fas 3
1. `npm run test:run`
2. Manuellt: aktivera push i browser -> skapa ruttannons -> push-notis visas
3. Manuellt: klicka push -> oppnar ratt sida
4. Manuellt: ingen push-token -> in-app + email fungerar (fallback)

---

## Oversikt

| | Nya filer | Andrade filer | Migration | Beroenden | Status |
|-----|-----------|---------------|-----------|-----------|--------|
| Fas 1 | 10 | 4 | `CustomerHorseServiceInterval` | Inga | **KLAR** |
| Fas 2 | ~2 | ~5 | Nej | Inga | Ej paborjad |
| Fas 3 | ~7 | ~3 | Nej | web-push | Ej paborjad |

Varje fas ar oberoende deploybar och ger varde pa egen hand.
