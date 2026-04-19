---
title: "S46-0 Done: Plan + schema + storage-setup"
description: "Designbeslut D1-D5, Prisma-migration, arkitektur-doc — klart"
category: plan
status: active
last_updated: 2026-04-19
tags: [s46, messaging, attachments, done]
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

# S46-0 Done: Plan + schema + storage-setup

## Acceptanskriterier

- [x] `docs/plans/s46-0-plan.md` committad på main FÖRE feature-branch skapades
- [x] `docs/architecture/messaging-attachments.md` skapad med D1-D5 motivering och säkerhetsmodell
- [x] Schema-migration `20260419100000_add_message_attachment_fields` skapad och markerad applied
- [x] `Message`-modellen har tre nullable fält: `attachmentUrl`, `attachmentType`, `attachmentSize`
- [x] Supabase Storage bucket-setup dokumenterad (manuell action via Dashboard)
- [x] Tech-architect + security-reviewer review körda

## Definition of Done

- [x] Inga TypeScript-fel (typecheck grön)
- [x] Säker (designbeslut granskade, RLS-modell dokumenterad)
- [x] Inga tester behövs — S46-0 är plan + schema + docs (inga src-ändringar)
- [x] Feature branch skapad, committat
- [x] Procedur: plan-commit på main INNAN feature-branch — hook-tes passerat

## Reviews körda

- **tech-architect:** Godkänd med två majors för S46-1-plan (operationsordning + messageId-problem,
  select-block koordination). Inga blockers för S46-0.
- **security-reviewer:** Godkänd utan absoluta blockers för S46-0. Identifierade:
  - BLOCKER-S46-1-A: Upload-specifik rate limiter saknas (`messageUpload` i rate-limit.ts)
  - BLOCKER-S46-1-B: Client-given path måste explicit förhindras i S46-1
  - MAJOR-1: Orphaned file cleanup (transaktionellt mönster)
  - MAJOR-2: Bucket-verifiering i deploy-procedur
  - MAJOR-3: Magic bytes-validering (`file-type`-paketet)
  - MINOR-1: Signed URL IP-binding (redan täckt i arkitektur-doc)
  - MINOR-2: HEIC UX-beslut (whitelist-beslut i S46-1)

**Alla blockers gäller S46-1, inte S46-0.**

## Docs uppdaterade

- [x] `docs/plans/s46-0-plan.md` — skapad (lifecycle-doc)
- [x] `docs/architecture/messaging-attachments.md` — skapad (arkitekturval)
- [x] `prisma/schema.prisma` — patched (Message attachment fields)
- [x] `prisma/migrations/20260419100000_add_message_attachment_fields/migration.sql` — skapad

**Inga** README/NFR/CLAUDE.md-uppdateringar behövs — ingen feature syns för användare ännu.

## Verktyg använda

- Läste patterns.md vid planering: ja — bekräftade att Message-inline-fält är konsekvent med övriga enkla tillägg (t.ex. Booking-extension-mönster)
- Kollade code-map.md för att hitta filer: ja — hittade messaging-filerna snabbt
- Hittade matchande pattern? "Nullable-kolumner på befintlig modell" — konsekvent med t.ex. `attachmentUrl` på `Upload`-modellen

## Arkitekturcoverage

Designdokument: `docs/architecture/messaging-attachments.md` (skapad i denna story)
Alla numrerade beslut implementerade: ja (D1-D5)

## Modell

sonnet

## Lärdomar

- **Plan-commit-hooken fungerar:** Pre-commit körde plan-commit-gate — inga brott. S45-process-hardening bevisar sig.
- **Supabase shadow DB + auth-schema:** Standardgotcha — `prisma migrate dev` misslyckas, kräver `--create-only` eller manuell migrationsfil. Se gotchas.md #XX.
- **Upload EFTER createMessage:** Tech-architect identifierade att D5-path-strukturen kräver att messageId existerar vid upload-tidpunkten. S46-1-plan måste specificera: API genererar cuid i minne → createMessage med externt ID → upload med path → ev. rollback om upload failar.
- **Service role = inga bucket-RLS behövs:** Tydligt dokumenterat mönster. IDOR-skyddet sitter i API-routen. Reviewers godkände det under förutsättning att `loadBookingForMessaging` alltid körs INNAN storage-anrop.
- **Bucket-skapning är manuell action:** Dokumenterat i arkitektur-doc. Lägg till i deploy-checklistan (S46-1-blocker).
