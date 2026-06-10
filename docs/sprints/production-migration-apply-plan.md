---
title: Production Migration Apply-plan (Workstream A)
description: Körbar apply-plan för de 7 saknade prod-migrationerna (sedan 4 april). Exakt ordning, verifierings-SQL före/efter, backup, risker per migration, rollback. Planering — ingen körning förrän Go/No-Go grön.
category: sprint
status: draft
last_updated: 2026-06-10
tags: [production, migration, prisma, supabase, rls, parity]
depends_on:
  - docs/sprints/production-relaunch-plan.md
related:
  - .claude/rules/prisma.md
  - docs/operations/incident-runbook.md
sections:
  - Scope och status
  - Pre-flight (verifierade fakta)
  - 1. Apply-ordning
  - 2. Apply-metod
  - 3. Per-migration detalj
  - 4. Backup / checkpoint
  - 5. Riskregister per migration
  - 6. Rollback / forward-fix-strategi
  - 7. Go/No-Go — Workstream A
---

# Production Migration Apply-plan (Workstream A)

> Detaljering av **Workstream A** i [Production Parity-planen](production-relaunch-plan.md).
> **STATUS: KÖRD OCH KLAR 2026-06-10** — alla 7 migrationer applicerade på prod utan
> avvikelse. Se [§Utfall](#utfall-körning-2026-06-10) nedan. Ingen kod-deploy gjord;
> deploy kräver nytt PO-beslut.

## Utfall (körning 2026-06-10)

Workstream A kördes 2026-06-10 efter explicit PO-Go. Resultat: **alla 7 migrationer
applicerade rent, inga avvikelser, prod-data oförändrad.**

| Steg | Migration | Verifierat utfall |
|------|-----------|-------------------|
| 1 | admin_audit_log | `AdminAuditLog` + 3 index. 40 applied. |
| 2 | pg_cron_maintenance | pg_cron installerad, 3 cron-jobb (inga dubbletter). 41 applied. |
| 3 | stripe_webhook_event | `StripeWebhookEvent` + unikt `eventId`-index. 42 applied. |
| 4 | add_conversation_message | `Conversation` + `Message` + enum + 2 FK. 43 applied. |
| 5 | conversation_rls_policies | RLS på båda; 4+6 policies; column-GRANT på `readAt`. 44 applied. |
| 6 | add_message_attachment_fields | 3 nullable-kolumner på `Message`. 45 applied. |
| 7 | horse_provider_booking_read | RLS-policy på `Horse`. 46 applied. |

**Slutläge:** 46 applied / 0 failed/pending. Full paritet repo↔prod (46=46, noll diff i
båda riktningar). Prod-data oförändrad: Booking=72, Provider=7, User=21 (= checkpoint).

**Metod använd:** Supabase MCP `apply_migration` per steg + manuell `_prisma_migrations`-
registrering med checksums (§1). En migration i taget, verifierings-SQL efter varje.

**Avvikelse från plan (PO-godkänd):** §4/§7 krävde verifierat återställbar backup/PITR före
apply. Det kunde **inte** tas — Supabase free tier ger inte PITR/on-demand-backup. PO
beslutade 2026-06-10 att medvetet köra utan formell backup eftersom prod-data bedöms som
gammal test-/demo-data (Fas 0). Logisk checkpoint (migration-topp + counts) togs som referens.

**Lärdomar:**
- Högst-risk-migrationen (pg_cron, steg 2) gick rent — `available=1` pre-flight var korrekt signal; inga duplicerade jobb (kördes exakt en gång).
- Migration 5:s funktionsberoenden (`auth.uid()` + `rls_provider_id()`) var verifierat närvarande pre-flight → ingen blockare. Pre-flight-kontrollen av RLS-hjälpfunktioner var värd tiden.
- Ingen rollback behövdes. Inget steg avvek.

**Kvarstår (kräver nytt PO-beslut):** ingen kod-deploy, ingen seed, ingen flag-ändring,
ingen staging→main-merge har gjorts. Nästa workstream (B/C/E/F) startar separat.

---

## Scope och status

Prod-DB (`xybyzflfxnqqyxnvjklv`, Zürich) står på `20260404150000` (4 april). **39 applicerade,
0 pending/failed, 7 saknade.** Detta dokument applicerar de 7 saknade så prod når schema-paritet
med staging.

## Pre-flight (verifierade fakta)

Read-only-kontroller mot prod 2026-06-10 (inga ändringar gjorda):

| Kontroll | Resultat | Betydelse |
|----------|----------|-----------|
| Applicerade migrationer | 39 applied, 0 failed | Ren bas, inga stuck-poster att rensa |
| Mål-tabeller redan på prod? | **Nej** (AdminAuditLog, StripeWebhookEvent, Conversation, Message saknas) | Ingen "already exists"-konflikt vid CREATE |
| Token-tabeller (cron-beroenden) | Alla 10 finns (EmailVerificationToken, …, MobileToken, Notification, NotificationDelivery, Booking, Horse) | pg_cron-jobbens bodies refererar befintliga tabeller |
| pg_cron-extension | **available=1, installed=0** | Migration 2 installerar den fräscht → inga duplicerade jobb |
| RLS-hjälpfunktioner | `rls_provider_id()` finns; **ingen** `rls_customer_id` | OK — customer-policies använder inbyggda `auth.uid()`, ej saknad funktion |
| Migration 5 funktionsberoenden | `auth.uid()` (inbyggd) + `rls_provider_id()` (finns) | Inga saknade beroenden → migration 5 kan appliceras |

**Slutsats pre-flight:** Inga blockerande beroenden saknas. Alla 7 kan appliceras i ordning.

## 1. Apply-ordning

Apply-ordning = **kronologisk** (timestamp-ordning löser samtidigt beroendekedjan):

| Steg | Migration | Beroende | SHA-256 checksum |
|------|-----------|----------|------------------|
| 1 | `20260405000000_admin_audit_log` | — | `c350ab12d856890a87d6d19f22280f4f60517c02ce0dfb420900c2894857b920` |
| 2 | `20260405100000_pg_cron_maintenance` | token-tabeller (finns) | `189790a180cd7ad60f14499ec0fcba857aa0492a7d7ec8a1e7993e83a301efb4` |
| 3 | `20260411103204_stripe_webhook_event` | — | `28d82fb2e51f28e8217528ba132d0cfb7cebd0a90457df7985a92ff0a4f3142f` |
| 4 | `20260418100000_add_conversation_message` | Booking (finns) | `5f30f3371ef316410450fd4eec0b71ca9f3c7afaf838ff4b7992bc9299878a65` |
| 5 | `20260418200000_conversation_rls_policies` | **steg 4** + `rls_provider_id()` | `ae965e7bb8732ffb3b11829d9f1566f41ac63b1827ef4f37f04bd6cf7ba95bce` |
| 6 | `20260419100000_add_message_attachment_fields` | **steg 4** | `fb6cb792326c451deff5c3c4b09d65c5b67fd4525b2464e93c39418eb120896a` |
| 7 | `20260608120000_horse_provider_booking_read` | Horse + `rls_provider_id()` (finns) | `8f802eb7b8e22e938d133b38f6e353807b526dfb11c76fc6b08c3dcdfc178094` |

**Kritisk beroendekedja:** steg 4 (Conversation/Message-tabeller) MÅSTE före steg 5 (RLS på dem)
och steg 6 (kolumner på Message). Kronologisk ordning uppfyller detta automatiskt.

## 2. Apply-metod

> **Branch-not:** Steg 1–6 finns på `main`. **Steg 7 finns ENDAST på `staging`** (ej mergad till
> main ännu). Kör därför apply från en **checkout av `staging`-branchen** (har alla 7), eller
> applicera steg 7 separat via MCP. Workstream E (kod-merge staging→main) sker EFTER denna apply.

**Primär metod — `prisma migrate deploy` (rekommenderad):**
- Från en `staging`-checkout, med prod `DIRECT_DATABASE_URL`: applicerar alla pending i ordning,
  registrerar `_prisma_migrations` med korrekt checksum atomiskt. Minst felbenägen.
- Kör `npm run migrate:status` mot prod före + efter.

**Alternativ metod — Supabase MCP `apply_migration` per steg (branch-agnostisk):**
- Applicera varje SQL via MCP i ordning 1→7, registrera sedan varje i `_prisma_migrations`
  med checksum-tabellen i §1 (samma mönster som migration 7 fick på staging 2026-06-09).
- Använd denna om ingen direkt DB-anslutning finns, eller för att applicera ENBART steg 7.

Oavsett metod: **en migration i taget**, verifiera (§3) innan nästa.

## 3. Per-migration detalj

För varje steg: objekt som skapas, **före**-verifiering (förväntat: saknas) och
**efter**-verifiering (förväntat: finns).

### Steg 1 — admin_audit_log
- **Skapar:** tabell `AdminAuditLog` (8 kolumner) + 2 index (`createdAt`, `userId`).
- **Före:** `SELECT to_regclass('public."AdminAuditLog"');` → förväntat `NULL`
- **Efter:** `SELECT to_regclass('public."AdminAuditLog"'); SELECT count(*) FROM pg_indexes WHERE tablename='AdminAuditLog';` → tabell finns, 2 (+pkey) index

### Steg 2 — pg_cron_maintenance
- **Skapar:** extension `pg_cron`, `GRANT USAGE ON SCHEMA cron`, 3 cron-jobb (cleanup-expired-tokens, cleanup-old-notification-deliveries, cleanup-old-read-notifications).
- **Före:** `SELECT count(*) FROM pg_extension WHERE extname='pg_cron';` → 0; `SELECT count(*) FROM cron.job;` (om schema saknas → bekräftar fräsch install)
- **Efter:** `SELECT extname FROM pg_extension WHERE extname='pg_cron'; SELECT jobname, schedule FROM cron.job ORDER BY jobname;` → 1 extension + 3 jobb
- **OBS:** `cron.schedule` är icke-idempotent — kör ALDRIG steg 2 två gånger (skapar dubbletter/fel). Verifiera 0 jobb före.

### Steg 3 — stripe_webhook_event
- **Skapar:** tabell `StripeWebhookEvent` (4 kolumner) + unikt index på `eventId` + index på `processedAt`.
- **Före:** `SELECT to_regclass('public."StripeWebhookEvent"');` → `NULL`
- **Efter:** `SELECT to_regclass('public."StripeWebhookEvent"'); SELECT indexname FROM pg_indexes WHERE tablename='StripeWebhookEvent';` → tabell + `StripeWebhookEvent_eventId_key` (unik)

### Steg 4 — add_conversation_message
- **Skapar:** enum `MessageSenderType`, tabeller `Conversation` + `Message`, index, 2 FK (Conversation→Booking, Message→Conversation, ON DELETE CASCADE).
- **Före:** `SELECT to_regclass('public."Conversation"'), to_regclass('public."Message"'); SELECT 1 FROM pg_type WHERE typname='MessageSenderType';` → båda `NULL`, enum saknas
- **Efter:** `SELECT to_regclass('public."Conversation"'), to_regclass('public."Message"'); SELECT conname FROM pg_constraint WHERE conname LIKE 'Conversation_%fkey' OR conname LIKE 'Message_%fkey';` → båda tabeller + 2 FK

### Steg 5 — conversation_rls_policies
- **Skapar:** `ENABLE RLS` på Conversation + Message; ~10 policies (customer/provider read/insert + read-update); `REVOKE UPDATE … FROM authenticated` + `GRANT UPDATE("readAt")` (column-level).
- **Identitet:** customer = `auth.uid()::text`, provider = `rls_provider_id()` (verifierat finns).
- **Före:** `SELECT relrowsecurity FROM pg_class WHERE relname IN ('Conversation','Message');` → `false`; `SELECT count(*) FROM pg_policies WHERE tablename IN ('Conversation','Message');` → 0
- **Efter:** `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('Conversation','Message');` → `true`; `SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('Conversation','Message') ORDER BY 1,2;` → policies listade; `SELECT grantee, privilege_type FROM information_schema.column_privileges WHERE table_name='Message' AND column_name='readAt';`

### Steg 6 — add_message_attachment_fields
- **Skapar:** 3 nullable-kolumner på `Message` (`attachmentUrl` TEXT, `attachmentType` TEXT, `attachmentSize` INTEGER).
- **Före:** `SELECT column_name FROM information_schema.columns WHERE table_name='Message' AND column_name LIKE 'attachment%';` → 0 rader
- **Efter:** samma query → 3 rader (alla nullable)

### Steg 7 — horse_provider_booking_read
- **Skapar:** RLS-policy `horse_provider_booking_read` på `Horse` (SELECT, authenticated, EXISTS-via-Booking med `rls_provider_id()`). Idempotent (`DROP POLICY IF EXISTS` + `CREATE`).
- **Före:** `SELECT policyname FROM pg_policies WHERE tablename='Horse' AND policyname='horse_provider_booking_read';` → 0 rader
- **Efter:** samma query → 1 rad; kontrollera `qual` innehåller `rls_provider_id()`

**Slutverifiering (alla 7):**
```
-- Förväntat: 46 applied, 0 failed/pending
SELECT count(*) FILTER (WHERE finished_at IS NOT NULL) AS applied,
       count(*) FILTER (WHERE finished_at IS NULL) AS failed_or_pending
FROM "_prisma_migrations";
```
Samt `npm run migrate:status` mot prod = inga pending/drift.

## 4. Backup / checkpoint

FÖRE steg 1 (obligatoriskt även om prod-data bedöms testdata):
- [ ] Bekräfta Supabase **PITR/automatisk backup** är aktiv på prod-projektet; notera senaste backup-tidpunkt
- [ ] Ta en **manuell checkpoint** (logisk dump av berörda + näraliggande tabeller) eller Supabase-dashboard-backup; dokumentera tidsstämpel + var den ligger
- [ ] Anteckna nuläge: `_prisma_migrations`-toppen (`20260404150000`) + tabell-counts (Booking=72, Provider=7, User=21) som referens
- [ ] Verifiera att backupen är **återställbar** (inte bara att den finns)

## 5. Riskregister per migration

| Steg | Risk | Sannolikhet | Konsekvens | Mitigering |
|------|------|-------------|------------|------------|
| 1 | CREATE TABLE failar om delvis applicerad | Låg | Migration stannar | Före-verifiering (tabell saknas); ren bas bekräftad |
| 2 | pg_cron-extension placeras fel / `WITH SCHEMA extensions` krockar med Supabase-setup | Låg–Medel | Migration failar | **Redan applicerad OK på staging**; available=1 bekräftat; om fel: enable pg_cron via dashboard först, kör sedan om |
| 2 | `cron.schedule` körs två gånger → dubbla jobb | Låg | Dubbla cleanup-jobb | Kör steg 2 exakt en gång; verifiera 0 jobb före |
| 2 | Cron-jobb-body refererar saknad tabell | Mycket låg | Jobb failar 03:00 (ej migration) | Alla 10 tabeller verifierade finns |
| 3 | — (enkel tabell) | Mycket låg | — | Före/efter-verifiering |
| 4 | CREATE TYPE/FK failar om enum/tabell finns | Låg | Migration stannar | Före-verifiering (enum + tabeller saknas) |
| 5 | Policy refererar saknad funktion (`rls_provider_id`) | **Eliminerad** | — | Verifierat: funktionen finns; customer-policies använder `auth.uid()` |
| 5 | RLS-regression (för snäv/vid åtkomst) | Låg | Dataläcka/blockad messaging | Efter-verifiering av policies; messaging-flagga styr exponering; smoke-test i Workstream F |
| 5 | Kräver steg 4 först | — | FK/tabell saknas | Kronologisk ordning garanterar det |
| 6 | ADD COLUMN på stor tabell låser | Mycket låg | Kort lås | Nullable-kolumner (ingen default-omskrivning); Message litet på prod |
| 7 | Idempotent policy | Mycket låg | — | `DROP IF EXISTS`; verifierat mönster (kördes på staging 2026-06-09) |

## 6. Rollback / forward-fix-strategi

Prisma stödjer **inte** automatisk down-migration. Strategi:

- **Per steg failar mitt i:** migrationen är inte registrerad i `_prisma_migrations` → fixa orsaken, kör om samma steg. Om en post hamnat med `finished_at = NULL` (stuck): `DELETE FROM "_prisma_migrations" WHERE migration_name='<namn>' AND finished_at IS NULL;` innan omkörning (per `.claude/rules/prisma.md`).
- **Behöver backa ett objekt:** skriv en **forward-fix-migration** (t.ex. `DROP TABLE`, `DROP POLICY`, `ALTER TABLE DROP COLUMN`) — backa aldrig genom att radera filer. Specifika reverse-snippets:
  - Steg 1/3/4: `DROP TABLE … CASCADE` (+ `DROP TYPE "MessageSenderType"` för steg 4)
  - Steg 2: `SELECT cron.unschedule('<jobname>')` ×3
  - Steg 5: `DROP POLICY … ON …` per policy + `ALTER TABLE … DISABLE ROW LEVEL SECURITY`
  - Steg 6: `ALTER TABLE "Message" DROP COLUMN "attachmentUrl", DROP COLUMN "attachmentType", DROP COLUMN "attachmentSize";`
  - Steg 7: `DROP POLICY IF EXISTS horse_provider_booking_read ON public."Horse";`
- **Katastrof (data/struktur trasig):** återställ från PITR/backup till checkpoint-tidpunkten (§4). Acceptabelt eftersom prod-data bedöms testdata — men bekräfta inget annat skrivits sedan checkpoint.
- **Koppling till deploy:** dessa migrationer appliceras FÖRE kod-deploy (Workstream E). Om något failar är prod-koden oförändrad (gammal) → ingen användarpåverkan under apply.

## 7. Go/No-Go — Workstream A

Apply får STARTA endast när:
- [ ] §2-besluten (Fas 0) bekräftade — prod-data = testdata, parity som mål
- [ ] Backup/PITR-checkpoint tagen och **verifierad återställbar** (§4)
- [ ] Pre-flight-queries omkörda direkt före (bekräfta fortf. 39 applied / 0 failed / mål-tabeller saknas)
- [ ] Apply-metod vald (migrate deploy från staging-checkout, ELLER MCP per steg)
- [ ] Verifierings-SQL (§3) förberedd att köras mellan varje steg
- [ ] Fönster valt då ingen annan skriver mot prod-DB
- [ ] Johan ger explicit klartecken

Apply räknas KLAR när (alla uppfyllda 2026-06-10):
- [x] Alla 7 steg applicerade i ordning, var och en efter-verifierad
- [x] Slutverifiering: 46 applied, 0 failed/pending
- [x] Migrate-status-ekvivalent: full paritet repo↔prod (46=46, noll diff båda riktningar)
- [x] Nyckeltabeller + RLS bekräftade (AdminAuditLog, StripeWebhookEvent, Conversation, Message, Horse-policy)
- [x] Prod-data oförändrad jämfört med checkpoint (Booking=72, Provider=7, User=21)

> **Efter Workstream A:** prod-DB har schema-paritet. Nästa: Workstream B (flags) → C (env) →
> E (kod-deploy) → F (smoke). Ingen kod-deploy förrän A är KLAR-verifierad.
