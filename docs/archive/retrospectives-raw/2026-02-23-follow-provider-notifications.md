# Retrospektiv: Följ leverantör + notifiering vid ny ruttannons

**Datum:** 2026-02-23
**Scope:** Komplett follow-system: kunder följer leverantörer och får in-app + email-notis vid nya rutt-annonser i sin kommun

---

## Resultat

- 10 ändrade filer, 20 nya filer, 1 ny migration (`add_follow_system`)
- 42 nya tester (alla TDD, alla gröna)
- 2314 totala tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Schema | `prisma/schema.prisma`, migration | `municipality` på User, Follow, NotificationDelivery, PushSubscription modeller |
| Feature Flag | `src/lib/feature-flags.ts` | `follow_provider` (default: false) |
| Repository | `src/infrastructure/persistence/follow/` (5 filer) | IFollowRepository, Mock, Prisma, index |
| Domain | `src/domain/follow/` (3 filer) | FollowService + FollowServiceFactory |
| Notification | `src/domain/notification/` (3 nya filer) | RouteAnnouncementNotifier + factory, ny typ `ROUTE_ANNOUNCEMENT_NEW` |
| API Routes | `src/app/api/follows/` (4 filer) | POST/GET /follows, DELETE/GET /follows/:providerId |
| API Routes | `src/app/api/push-subscriptions/` (2 filer) | POST/DELETE (stub för framtida push) |
| API | `src/app/api/profile/route.ts` | municipality i Zod-schema + select-block |
| API | `src/app/api/route-orders/route.ts` | Fire-and-forget notifier-integration |
| UI | `src/components/follow/FollowButton.tsx` | Optimistisk toggle med heart-ikon |
| UI | `src/hooks/useFollowProvider.ts` | Client hook med optimistic UI |
| UI | `src/app/providers/[id]/page.tsx` | FollowButton integrerad i provider-profil |
| UI | `src/app/customer/profile/page.tsx` | MunicipalitySelect i kundprofil |
| Tester | 6 testfiler | MockFollowRepository (10), FollowService (10), follows API (11), push-sub (4), notifier (7) |

## Vad gick bra

### 1. DDD-mönstret skalerar
Review-mönstret (IRepository -> MockRepo -> PrismaRepo -> Service -> Factory -> Route) kopierades rakt av för Follow-domänen. Varje lager tog <5 minuter att scaffolda tack vare det etablerade mönstret.

### 2. TDD fångade Zod UUID-gotcha direkt
Första testkörningen för API routes failade på `providerId: "p1"` -- Zod v4 kräver giltiga UUIDs. Fångades i RED-fasen istället för i manuell testning.

### 3. Fire-and-forget notifier med dependency injection
RouteAnnouncementNotifier tog emot alla beroenden via constructor (followRepo, notificationService, emailService, routeOrderLookup, deliveryStore). Gjorde testning trivial med mocks, och produktions-factory:n kopplar ihop allt.

### 4. Inga regressioner trots brett scope
8 faser, 20 nya filer, 10 ändrade filer -- 2314 tester gröna genomgående. Feature flag-testerna var de enda som behövde uppdateras (hardcoded flag-lista).

## Vad kan förbättras

### 1. Feature flag-tester med hardcoded lista
Testerna i `feature-flags.test.ts` och `feature-flags/route.test.ts` har en `toEqual()` med alla flaggor listade. Varje ny flagga kräver manuell uppdatering av båda testerna.

**Prioritet:** LÅG -- sker sällan och felet är uppenbart.

### 2. Follow är inte en kärndomän i repository-mönstret
Follow-repository:n skapades med fullständigt DDD-mönster (IRepository, Mock, Prisma) trots att Follow saknar komplex affärslogik. En enklare approach med Prisma direkt i servicen hade räckt.

**Prioritet:** LÅG -- konsistens i mönstret väger tyngre än minimalism.

### 3. E2E-tester saknas
Inga E2E-tester skrevs för follow-flödet. Bör läggas till när feature flag:en slås på.

**Prioritet:** MEDEL -- behövs innan production-aktivering.

## Patterns att spara

### Fire-and-forget notifier med dedup
```typescript
// I API route efter skapande:
if (await isFeatureEnabled("follow_provider")) {
  notifier.notifyFollowersOfNewRoute(id).catch(err =>
    logger.error("Failed to notify", err)
  )
}

// I notifier: dedup via NotificationDelivery-tabell
const alreadyDelivered = await deliveryStore.exists(routeOrderId, customerId, "in_app")
if (alreadyDelivered) { skipped++; continue }
```

### Optimistisk follow-toggle
```typescript
// Optimistic update -> revert on error
const prev = { isFollowing, followerCount }
setIsFollowing(!isFollowing)
setFollowerCount(isFollowing ? count - 1 : count + 1)
try { await fetch(...) }
catch { setIsFollowing(prev.isFollowing); setFollowerCount(prev.followerCount) }
```

### Municipality-matchning för geo-notiser
Exakt string-match på `User.municipality` mot `RouteOrder.municipality`. Enklare än geo-radius, tillräckligt för MVP. Skalerar via index på `User.municipality`.

## Lärandeeffekt

**Nyckelinsikt:** DDD-mönstret med dependency injection gör det trivialt att testa asynkrona side-effects (email, notiser) -- alla externa beroenden injiceras via constructor och mockas i tester, medan fire-and-forget i produktionen hanterar fel gracefully.
