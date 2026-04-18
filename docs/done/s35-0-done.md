---
title: "S35-0 Done: Plan-review av Conversation-domän"
description: "Arkitekturbeslut för messaging-domänen, godkänt av tech-architect och security-reviewer"
category: plan
status: active
last_updated: 2026-04-18
sprint: 35
story: S35-0
sections:
  - Sammanfattning
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Modell
  - Lärdomar
---

# S35-0 Done: Plan-review av Conversation-domän

## Sammanfattning

Designdokument för ny kärndomän `Conversation` + `Message` (messaging-epic Slice 1). Schema, API, RLS och rate limiting designat. Tech-architect och security-reviewer har granskat och godkänt utan blockers. S35-1 kan nu påbörjas med konkreta implementationsinstruktioner.

## Acceptanskriterier

- [x] `docs/architecture/messaging-domain.md` finns med schema + API + RLS-skiss
- [x] tech-architect har godkänt (inga blockers, 0 majors efter fix)
- [x] security-reviewer har godkänt (inga blockers, 0 majors efter fix)
- [x] Prisma schema-utkast inkluderat (faktisk migration i S35-1)
- [x] Epic-dokumentet uppdaterat med länk till arkitekturbeslut

## Definition of Done

- [x] Designen matchar epicens Slice 1 (per bokning, text, polling)
- [x] Alla reviews avklarade (inga blockers)
- [x] Docs validerar (messaging-domain.md frontmatter korrekt)
- [x] Epic-dokument uppdaterat och länkat
- [x] Plan committad på feature branch innan implementation påbörjad
- [x] Sessionsfil uppdaterad

## Reviews körda

- **tech-architect (plan-review):**
  - 0 blockers
  - 3 majors identifierade och åtgärdade:
    - M1: `COMPLETED_PENDING_REVIEW` finns inte i BookingStatus → ersatte med faktiska lowercase-värden (`pending`, `confirmed`, `cancelled`, `completed`, `no_show`)
    - M2: N+1-risk i inkorg-query → specificerade dedikerad `getInboxForProvider`-metod med två strategi-alternativ + 200ms benchmark-gräns
    - M3: WITH CHECK saknades i RLS UPDATE-policy → lade till WITH CHECK i alla UPDATE-policies för defense-in-depth
  - Verdikt: "Arkitekturen är solid. Domänplaceringen som självständig kärndomän är rätt motiverad."

- **security-reviewer (plan-review):**
  - 0 blockers
  - 1 major identifierad och åtgärdad:
    - M1: RLS saknar kolumn-nivå check → kombinerade REVOKE/GRANT på kolumn-nivå med WITH CHECK i policy
  - Verdikt: "Klarmarkering: Med M1 åtgärdad (kolumn-nivå GRANT + policy-dokumentation) är planen klar för S35-1."

- **code-reviewer:** Ej relevant (ingen kod, bara design-doc)
- **cx-ux-reviewer:** Ej relevant (inget UI i denna story)

## Docs uppdaterade

- **Nya:** `docs/architecture/messaging-domain.md` (schema, API-kontrakt, RLS-policies, rate limiting, notifier-integration, 12 numrerade beslut D1-D12, review-historik)
- **Uppdaterade:** `docs/ideas/epic-messaging.md` (status draft → active, länk till arkitekturbeslut, "Nästa steg" markerat klar)
- **Inte uppdaterade (motivering):**
  - README.md: Ingen användarvänd feature än (S35-1 uppdaterar)
  - NFR.md: Inga nya NFR-krav från designen
  - CLAUDE.md: Inga nya key learnings (messaging-domain.md är själva referensen)

## Verktyg använda

- **Läste patterns.md vid planering:** Nej (ingen kod i denna story)
- **Kollade code-map.md för att hitta filer:** Ja (för att hitta domain-struktur och RLS-mönster)
- **Hittade matchande pattern?** Ja:
  - RLS-mönster från `Review`/`CustomerReview` migrations (rls_read_policies, rls_write_policies)
  - Repository pattern från `Booking` (för Conversation att följa i S35-1)
  - Fire-and-forget notifier från `RouteAnnouncementNotifier` (för MessageNotifier i S35-3)

## Modell

`opus`

Varför opus: Arkitekturbeslut kräver djup förståelse av befintlig kodbas (BookingStatus, RLS-strategier, Prisma-patterns), plus att tech-architect och security-reviewer är av natur komplexa granskningsuppgifter där fel kan ge dyra omarbetningar i S35-1.

## Lärdomar

### Design-validering mot faktisk kod är obligatorisk
- Tech-architect hittade 2 faktafel där design-dokumentet påstod saker om `BookingStatus` och `Booking`-schema som inte stämde. Hade sluppit båda genom att grep:a `BookingStatus` + läsa `prisma/schema.prisma` innan första utkast. Från nästa gång: verifiera ALLT som refererar faktiska enum-värden och kolumner innan design-doc skickas till review.

### PostgreSQL RLS har ingen kolumn-nivå check inuti policy
- `UPDATE ... USING ... WITH CHECK` kan INTE begränsa vilka kolumner som får uppdateras. Defense-in-depth kräver att man kombinerar `REVOKE UPDATE ON tbl FROM role` + `GRANT UPDATE (col) ON tbl TO role` PÅ SIDAN OM policyn. Security-reviewer fångade detta. Applicerbart på framtida migrationer där vi vill låta en roll uppdatera ETT fält utan att kunna röra övriga.

### Prisma `@updatedAt` triggas inte av child-inserts
- `Conversation.updatedAt @updatedAt` uppdateras inte automatiskt när en `Message` skapas. Man måste explicit sätta `lastMessageAt: new Date()` i samma transaction som message-inserten. Viktigt för inkorg-sortering.

### Dubbel rate limiting (user + konversation) ger bättre skydd
- En enda rate limiter per user räcker inte: en illvillig user kan ändå spamma en enda konversation. Två lager: `messageUserLimiter` (30/min/user) + `messageConversationLimiter` (10/min/conversation). Mönster värt att överväga för andra kärndomäner där multi-tenancy möts i samma endpoint.

### Aktualitet-verifieringen fångar skenproblem tidigt
- Pre-commit hook rejekterade planen för saknad "Aktualitet verifierad"-sektion. Bra att den är tvingande -- tvingar session att explicit bekräfta att problemet fortfarande finns innan planering startar. S27/S29 hade sluppit slösad tid om vi haft hooken då.

### Docs-matris kräver bara motivering när uppdatering uteblir
- Jag noterade varför README/NFR/CLAUDE inte uppdaterades. Det räcker enligt `auto-assign.md`. Inga onödiga icke-ändringar för att "fylla checklistan".
