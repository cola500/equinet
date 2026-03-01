# Design: Buggrapporter backend + admin triage

**Datum:** 2026-02-28
**Status:** Godkand

## Bakgrund

Equinet har en klient-only buggrapportsfunktion (`BugReportFab.tsx`) som genererar text for `navigator.share()` / copy-paste. Den ar gatad bakom `offline_mode`-flaggan och sparar inget till backend.

**Mal:** Bygga ut med backend-lagring + admin-vy for triage sa buggrapporter samlas centralt och kan prioriteras.

## Arkitekturbeslut

- **Stodoman** -- Prisma direkt i routes (inget repository-pattern). Motivering: ingen komplex affarslogik, konsekvent med andra admin-routes (reviews, verifications, users).
- **Tillganglighet** -- Alla inloggade anvandare (kund/leverantor/admin), inte bara offline-mode.
- **Prioritetsskala** -- P0-P3 (standard bugtracking) istallet for HOG/MEDEL/LAG.

## Datamodell

```prisma
enum BugReportStatus {
  NEW
  INVESTIGATING
  PLANNED
  FIXED
  DISMISSED
}

enum BugReportPriority {
  P0
  P1
  P2
  P3
}

model BugReport {
  id                String             @id @default(uuid())
  title             String
  description       String
  reproductionSteps String?
  pageUrl           String
  userAgent         String?
  platform          String?
  userRole          String
  status            BugReportStatus    @default(NEW)
  priority          BugReportPriority  @default(P2)
  internalNote      String?

  userId            String?
  user              User?              @relation(fields: [userId], references: [id])

  updatedBy         String?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@index([status])
  @@index([priority])
  @@index([createdAt])
}
```

## API-endpoints

| Method | Path | Auth | Beskrivning |
|--------|------|------|-------------|
| POST | `/api/bug-reports` | Inloggad | Skapa buggrapport |
| GET | `/api/admin/bug-reports` | Admin | Lista med filter/sort |
| GET | `/api/admin/bug-reports/[id]` | Admin | Detalj |
| PATCH | `/api/admin/bug-reports/[id]` | Admin | Uppdatera status/prio/note |

## UI-andringar

### BugReportFab (refaktorering)
- Ta bort offline-mode gate, visa for alla inloggade
- Lagg till titel-falt + steg-for-att-aterskapa
- POST till `/api/bug-reports` istallet for `navigator.share()`
- Visa kvittens med referens-ID efter lyckad submit

### Admin (nya sidor)
- `/admin/bug-reports` -- lista med filter (status) + sortering (datum/prio)
- `/admin/bug-reports/[id]` -- detaljvy med redigerbar status, prio, intern kommentar

### AdminNav
- Lagg till "Buggrapporter" i navigationen

## Sakerhet
- `userId` och `userRole` fran session (aldrig request body)
- `userAgent` fran request headers
- Input-sanering via Zod `.trim()` + max-langd
- Admin-endpoints via `requireAdmin()`
- Rate limit: 5 rapporter/timme per anvandare

## Testning
- API-tester: create (auth, validation, rate limit, success)
- Admin list (auth guard)
- Admin update (auth guard, validation)
- Behavior-based testing (response shape, inte implementation)
