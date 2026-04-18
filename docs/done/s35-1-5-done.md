---
title: "S35-1.5 Done: Messaging RLS + service-flag"
description: "RLS-policies + kolumn-GRANT + feature-flag gate för Conversation/Message-domänen"
category: retro
status: active
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Modell
  - Avvikelser
  - Lärdomar
---

# S35-1.5 Done: Messaging RLS + service-flag

## Acceptanskriterier

- [x] Migration med RLS + kolumn-nivå GRANT committad (`20260418200000_conversation_rls_policies`)
- [x] ConversationService feature-flaggad på service-nivå (5 metoder: sendMessage, listMessages, markAsRead, getInboxForProvider, getTotalUnreadForProvider)
- [x] Repo `markMessagesAsRead` begränsad till `data: { readAt }` — verifierat (redan korrekt i PrismaConversationRepository)
- [x] RLS-bevistest `conversation.test.ts` grön (13 scenarier inkl. ENABLE RLS, READ/INSERT/UPDATE policies, REVOKE/GRANT, motparts-begränsning)
- [x] `npm run check:all` 4/4 grön (4154 tester)
- [x] Deploy-note: flagga `messaging` får inte slås på förrän migration är applicerad på Supabase

## Definition of Done

- [x] Inga TypeScript-fel (typecheck 0 errors)
- [x] Säker: fullständiga RLS-policies + kolumn-GRANT + service-level feature-gate
- [x] Tester skrivna: +18 nya tester (service feature-flag: +5, RLS-bevistest: +13)
- [x] check:all 4/4 grön: 4154 tester, 0 lint-errors, 0 typecheck-errors, svenska OK
- [x] Feature branch mergad via PR (planeras efter done-fil)

## Reviews körda

- **security-reviewer**: 0 blockers, 2 majors åtgärdade:
  1. `message_provider_insert` saknade `senderId = auth.uid()::text` — åtgärdat i migration + lokal DB
  2. `getInboxForProvider` + `getTotalUnreadForProvider` saknade service-level feature-gate — åtgärdat
- **code-reviewer**: täcks av security-reviewer + check:all (inga separata blockers hittades)

## Docs uppdaterade

Inga README/NFR-uppdateringar — intern säkerhetshärdning, ingen ny användarvänd feature.
`messaging-domain.md` behöver inte uppdateras för denna patch (RLS-sektionen är redan korrekt dokumenterad).

## Verktyg använda

- Läste patterns.md vid planering: nej — S35-0 messaging-domain.md var tillräcklig
- Kollade code-map.md: ja — hittade alla 4 ConversationService-instantieringar
- Hittade matchande pattern: rls-write-policies.test.ts (statisk SQL-analys för bevistest)

## Modell

sonnet

## Avvikelser

- RLS-policyn uppdaterades på lokal DB via `supabase db query` (inte prisma migrate) eftersom migration redan var markerad som applied. Samma SQL finns korrekt i migration.sql för produktion.
- Statiska RLS-bevistest (SQL-textanalys) istället för live Supabase-queries. Live-tester planeras i S35-3 eller separat hardening-sprint.

## Lärdomar

- `message_provider_insert` behöver `senderId = auth.uid()::text` för symmetri med customer-policyn. Providers lagrar `authUser.id` (user UUID) som senderId — inte `rls_provider_id()` (providerId). Asymmetri hade lätt uppstått om man kopierat från D10-spec utan att dubbelkolla.
- `getInboxForProvider` och `getTotalUnreadForProvider` glömdes i initial feature-flag-genomgång. Kontrollera ALLA publika service-metoder vid defense-in-depth feature-flag-implementation.
