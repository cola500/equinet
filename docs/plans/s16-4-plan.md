---
title: "S16-4: Admin-härdning (audit log + session-timeout)"
description: "Audit log på admin-operationer och tidbegränsade admin-sessioner"
category: plan
status: active
last_updated: 2026-04-05
sections:
  - Syfte
  - Design
  - Faser
  - Avgränsning
---

# S16-4: Admin-härdning (audit log + session-timeout)

## Syfte

Stärk admin-rollen med automatisk audit-loggning och kortare sessionstid.
MFA noteras i backlog för framtida story.

## Design

### AdminAuditLog (Prisma-modell)

```prisma
model AdminAuditLog {
  id         String   @id @default(uuid())
  userId     String
  userEmail  String
  action     String   // "POST /api/admin/feature-flags"
  ipAddress  String?
  userAgent  String?
  statusCode Int
  createdAt  DateTime @default(now())

  @@index([createdAt])
  @@index([userId])
}
```

Ingen FK till User -- loggen ska överleva om user raderas.

### Automatisk loggning

`withApiHandler` utökas: när `auth: "admin"`, logga request efter att
handlern kört. Fire-and-forget via `.catch(logger.error)`.

### Admin-sida

`/admin/audit-log` -- tabell med senaste 100 poster. Paginering via cursor.

### Session-timeout

`requireAdmin()` i `src/lib/roles.ts` utökas: kontrollera `iat` i JWT.
Om token äldre än 15 min -> 401 "Admin-session utgången".

## Faser

### Fas 1: Prisma-modell + migration
- Lägg till AdminAuditLog i schema.prisma
- Skapa migration

### Fas 2: Audit-loggning i withApiHandler (TDD)
- RED: test att admin-request loggas
- GREEN: auditAdminRequest() i api-handler.ts
- RED: test att non-admin-request INTE loggas
- GREEN: villkorlig loggning

### Fas 3: Session-timeout i requireAdmin (TDD)
- RED: test att gammal token ger 401
- GREEN: iat-check i requireAdmin()

### Fas 4: Admin-sida för audit log
- API: GET /api/admin/audit-log (paginering, cursor)
- UI: tabell med datum, email, action, IP, statuskod

### Fas 5: Verifiering
- check:all
- E2E smoke

## Avgränsning

- I scope: audit log, session-timeout, admin-sida
- Inte i scope: MFA (backlog), granulära roller
