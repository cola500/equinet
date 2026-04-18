---
title: "Messaging-säkerhet (Conversation + Message)"
description: "Säkerhetsarkitektur för tvåvägs-meddelanden: RLS, rate limiting, feature flag-gating och kolumn-nivå GRANT"
category: security
status: active
last_updated: 2026-04-18
tags: [security, messaging, rls, rate-limiting, feature-flags]
sections:
  - Översikt
  - Defense-in-depth
  - Rate limiting
  - Feature flag-gating
  - RLS och kolumn-nivå GRANT
  - Ägarskapsmodell
depends_on:
  - docs/architecture/database.md
related:
  - docs/security/rls-findings.md
---

# Messaging-säkerhet

## Översikt

Messaging (S35) implementerar tvåvägs textmeddelanden mellan kund och leverantör per bokning. Säkerhetsmodellen är defense-in-depth med tre lager: applikationslager (route + service), databaslager (RLS + kolumn-GRANT), och infrastrukturlager (rate limiting + feature flag).

Detaljer om domänimplementationen: `src/domain/conversation/ConversationService.ts`.

## Defense-in-depth

| Lager | Mekanism | Fil |
|-------|----------|-----|
| Feature flag | `isFeatureEnabled("messaging")` → 404 om av | `src/app/api/bookings/[id]/messages/route.ts` |
| Auth | `auth()` null-guard → 401 | Route-handler |
| Ägarskap | `bookingId` verifieras mot session | `ConversationService.sendMessage()` |
| Input-validering | Zod `.strict()` på request body | Route-handler |
| RLS | Supabase-policies på Conversation + Message | Prisma-migration S35 |
| Kolumn-GRANT | `Message.readAt` GRANT begränsat till mottagare | Prisma-migration S35 |

## Rate limiting

Två nivåer tillämpas i varje request:

| Limiter | Gräns | Tillämpas på |
|---------|-------|--------------|
| Per-user | 30 meddelanden/min | Avsändare |
| Per-conversation | 10 meddelanden/min | Specifik tråd |

Vid överskridande returneras `429 Too Many Requests`. Rate limiter är fail-closed: `RateLimitServiceError` → `503`.

## Feature flag-gating

Två nivåer:

1. **Route-nivå** (`isFeatureEnabled("messaging")` i route) → 404 om av
2. **Service-nivå** (ConversationService kontrollerar flaggan) → skyddar mot anrop från bakgrundsjobb och admin-verktyg

Standard: `defaultEnabled: true` (sedan S37-3).

## RLS och kolumn-nivå GRANT

Conversation och Message-tabellerna skyddas av Supabase Row Level Security:

- Läs-policy: Endast deltagare (kund + leverantör för aktuell bokning) kan läsa tråden
- Skriv-policy: Endast avsändaren kan skapa meddelanden
- `Message.readAt`: Kolumn-nivå GRANT — bara mottagaren kan sätta läs-tidsstämpel (`column-level-grant-rls-pattern`)

## Ägarskapsmodell

`bookingId` används som scope-nyckel. En konversation är 1:1 med en bokning.

- **Provider**: kan läsa/skriva i alla konversationer kopplade till sina bokningar
- **Kund**: kan läsa/skriva i alla konversationer kopplade till sina bokningar
- **Annan part**: blockeras av RLS (ingen policy matchar)

`providerId` och `customerId` hämtas ALLTID från sessionen, aldrig från request body (IDOR-skydd).
