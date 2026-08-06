---
title: "Supabase RLS- och behörighetsaudit 2026-08"
description: "Full read-only RLS/grants-audit av staging + production, de fynd som åtgärdats (BookingSeries + 6 server-only-tabeller) och de som kvarstår inför nästa slice."
category: security
status: active
last_updated: 2026-08-06
tags: [rls, supabase, postgresql, authorization, audit, staging, production]
depends_on:
  - docs/security/rls-findings.md
related:
  - docs/architecture/database.md
  - docs/security/rls-findings.md
  - docs/security/staging-security-audit-2026-05.md
  - docs/operations/staging-environment-setup.md
sections:
  - Executive Summary
  - Scope
  - Åtgärdade fynd
  - Kvarvarande fynd
  - Rekommenderad nästa slice
  - Lessons Learned
  - Slutstatus
---

# Supabase RLS- och behörighetsaudit 2026-08

## Executive Summary

**Varför auditen gjordes:** Under en rutinmässig statuskoll av Supabase-projekten (`npm`-fri, via Supabase MCP) flaggade Security Advisor att tabellen `BookingSeries` hade RLS-policies definierade men RLS själv var avstängt på tabellen — en tyst regression som gjorde att `anon`- och `authenticated`-roller hade fullt oautentiserat CRUD på tabellen via PostgREST, trots att fyra policies såg ut att skydda den. Fyndet triggade en fullständig read-only genomgång av RLS, policies, grants, views, functions/RPC och storage i båda Supabase-projekten (staging `zzdamokfeenencuggjjp` och production `xybyzflfxnqqyxnvjklv`).

**Kritiska problem som hittades:**
- `BookingSeries` (production): policies fanns men verkställdes inte alls eftersom RLS var av. Root cause: tabellen skapades *efter* den ursprungliga bulk-RLS-migrationen och missades där.
- Sex ytterligare tabeller (`PasswordResetToken`, `CustomerInviteToken`, `StableInviteToken`, `MobileToken`, `AdminAuditLog`, `StripeWebhookEvent`) hade RLS helt avstängt samtidigt som Supabase defaultar till fullt CRUD-grant till `anon`/`authenticated`/`service_role` vid tabellskapande. Två av dessa läckte **verifierat riktig data live**: `AdminAuditLog` hade 52 anon-läsbara rader i production (admin-händelser inkl. IP-adresser) och 8 i staging; `StripeWebhookEvent` hade 4 anon-läsbara rader i staging (och kunde i teorin användas för att tysta riktiga Stripe-webhooks via dedup-mekanismen).
- Två av token-tabellerna (`PasswordResetToken`, `CustomerInviteToken`, `StableInviteToken`) lagrar **råa, direkt användbara tokens** (inte hashade) — läsbarhet via anon-nyckeln hade varit direkt kontokapning.

**Vad som redan är åtgärdat:** Samtliga sju tabeller ovan har fått `ENABLE ROW LEVEL SECURITY` (plus matchande policy) applicerat i **både staging och production**, och migrationshistoriken är synkad i `main`. Se [Åtgärdade fynd](#åtgärdade-fynd).

**Nuvarande säkerhetsstatus:** Inga kända aktiva dataläckor. Sex tabeller (`BugReport`, `DeviceToken`, `MunicipalityWatch`, `ProviderSubscription`, `Stable`, `StableSpot`) har fortfarande RLS avstängt i båda miljöerna och delar exakt samma sårbarhetsklass som de redan fixade — de är nästa steg, inte en aktiv krisnivå, eftersom ingen av dem hittills är bekräftat exploaterad. Se [Kvarvarande fynd](#kvarvarande-fynd) och [Rekommenderad nästa slice](#rekommenderad-nästa-slice).

---

## Scope

Read-only genomgång (inga ALTER/GRANT/REVOKE utfördes under själva auditen — endast under de separat godkända fix-stegen efteråt) av:

- **RLS-status** (`relrowsecurity`, `relforcerowsecurity`) för alla tabeller i exponerade scheman
- **Policies** (`pg_policies`) — kommando, roller, `USING`/`WITH CHECK`-uttryck
- **Grants** till `anon`, `authenticated`, `service_role`, `public` (`information_schema.role_table_grants`)
- **Views** och materialized views — om de kringgår RLS på underliggande tabeller
- **Functions/RPC** — `SECURITY DEFINER` vs `INVOKER`, `search_path`, executable-grants till `anon`/`authenticated`
- **Storage** — buckets (public/private), `storage.objects`-policies, RLS-status på `storage.buckets`/`storage.objects`
- **Kodåtkomst** — grep genom hela `src/`, `scripts/`, `e2e/` efter Prisma-anrop, rå Supabase-klient (`.from()`), Edge Functions, Realtime-prenumerationer och triggers, för att avgöra faktisk (inte teoretisk) exponering
- **Staging vs. production** — parallell verifiering och parity-jämförelse i varje steg

**Projekt:** Production = `xybyzflfxnqqyxnvjklv` (schema: `public`). Staging = `zzdamokfeenencuggjjp` (scheman: `public` + ett separat `staging`-schema utan grants till `anon`/`authenticated`/`service_role`, alltså inte nåbart via Data API oavsett RLS-status — se Kvarvarande fynd).

---

## Åtgärdade fynd

### BookingSeries

- **Upptäckt:** Security Advisor (`get_advisors`, type `security`) flaggade `policy_exists_rls_disabled` i production: fyra policies (`booking_series_customer_read`, `booking_series_provider_insert`, `booking_series_provider_read`, `booking_series_provider_update`) fanns, men `relrowsecurity = false`.
- **Root cause:** Tabellen skapades i migration `20260217181129_add_booking_series`, *efter* att den stora bulk-RLS-migrationen (`20260204120000_enable_rls`) redan hade körts — den missades alltså i den ursprungliga utrullningen. Policies lades till senare (`20260404120000_rls_read_policies`, `20260404130000_rls_write_policies`) utan att någon `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` följde med, troligen under antagandet att tabellen redan var RLS-skyddad likt övriga kärntabeller.
- **Risk:** `anon`/`authenticated` hade fullt CRUD (SELECT/INSERT/UPDATE/DELETE) på riktiga bokningsserier via PostgREST, helt utan autentisering — bekräftat via `information_schema.role_table_grants`.
- **Fix:** `ALTER TABLE public."BookingSeries" ENABLE ROW LEVEL SECURITY;` (migration `20260805090430_enable_rls_booking_series`). Ingen ny policy behövdes — de fyra befintliga policyerna blev aktiva direkt.
- **Verifiering:**
  - `relrowsecurity = true` bekräftat i både staging och production.
  - `SET ROLE anon; SELECT count(*)` → 0 rader trots att riktig data fanns i tabellen.
  - `SET ROLE anon; INSERT ...` → avvisad med `42501: new row violates row-level security policy`.
  - Applicerad separat mot båda databaserna via `prisma migrate deploy` (session-mode pooler), `prisma migrate status` gick från "1 pending" till "up to date" i båda.
  - Migrationsfilen synkad till `main` (PR #467 → staging, PR #469 → main, cherry-pick-baserad för att hålla diffen ren).

### Server-only-tabeller (deny-all-slice)

**Tabeller:** `MobileToken`, `AdminAuditLog`, `StripeWebhookEvent`, `PasswordResetToken`, `CustomerInviteToken`, `StableInviteToken`

**Varför de var sårbara:**

| Tabell | Sårbarhet |
|---|---|
| `PasswordResetToken` | RLS av + full anon-grant. Token lagras **rått** (`randomBytes(32).toString('hex')`, ingen hashning) → direkt kontokapning om läst. |
| `CustomerInviteToken` | Samma mönster — rå invite-token, oauktoriserad kontokoppling om läst. |
| `StableInviteToken` | Samma mönster. |
| `MobileToken` | RLS av. Token lagras som SHA-256-hash (lägre läsrisk), men skriv/radera-åtkomst kunde ändå användas för att ogiltigförklara sessioner. Bekräftad **dödkod** — ingen aktiv server-route skapar/läser tabellen längre (klientens fetch mot `/api/auth/mobile-token` 404:ar tyst; verkligt native-auth-flöde går via `native-session-exchange` och rör aldrig tabellen). |
| `AdminAuditLog` | RLS av. **Live-exponering bekräftad:** 52 anon-läsbara rader i production, 8 i staging (admin-händelser inkl. IP-adresser) — samt raderbar/ändringsbar, vilket bryter spårbarhet vid missbruk. |
| `StripeWebhookEvent` | RLS av. **Live-exponering bekräftad:** 4 anon-läsbara rader i staging. Skrivbar tabell kunde användas för att förskriva Stripe event-ID:n och trigga dedup-mekanismens `skipDuplicates`, vilket tyst hade kunnat blockera riktiga webhooks. |

**Kodåtkomst-discovery (samma metod för alla sex, samt en bredare sweep av hela `src/`):**
- Grep efter Supabase browser/admin-klient (`.from("Tabellnamn")`) för alla sex tabeller: **0 träffar.**
- Bredare sweep: grep efter **alla** `.from()`-anrop och Realtime/`postgres_changes`-prenumerationer i hela `src/`: **0 träffar för hela appen.** All dataåtkomst går via Next.js API-routes → Prisma.
- Prismas databasanslutning (`DATABASE_URL`/`DIRECT_DATABASE_URL`) autentiserar som Postgres-rollen `postgres` (`rolbypassrls = true`, bekräftat via `pg_roles`) — RLS påverkar den anslutningen aldrig, oavsett policy.
- Ingen Edge Function, ingen trigger, rör någon av de sex tabellerna.
- Slutsats: RLS är i denna app ren defense-in-depth utan funktionellt beroende — att aktivera deny-all har **noll risk att bryta serverkod**, eftersom ingen kodväg någonsin ansluter som `anon`/`authenticated`.

**Åtgärd:** `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY "Deny all via API" ON <tabell> FOR ALL TO public USING (false);` — identiskt mönster som redan användes på `Booking`, `User`, `Payment`, `Route` m.fl. sedan tidigare. En migration (`20260805100939_enable_rls_deny_all_token_and_audit_tables`), sex tabeller.

**Verifiering (per tabell, i båda miljöerna):**
- `SET ROLE anon`/`SET ROLE authenticated` → 0 rader på samtliga sex.
- `SET ROLE anon; INSERT ...` → `42501`-avvisning (testat explicit på `AdminAuditLog`).
- Riktade testsviter körda under Node 20: forgot-password, reset-password, accept-invite, provider-customer-invite, stable-invite, admin-audit-log, Stripe-webhook (unit + integration) — 14 filer / 104 tester gröna.
- `npm run check:all` under Node 20 — 4/4 gröna (typecheck, test:run 4653 passed, lint, check:swedish).
- CI grönt på PR #468 (staging) och PR #469 (main), inklusive `Migration From Scratch` (kör om alla migrationer från noll).
- Security Advisor omkörd efter fix: alla sex tabeller borta från `rls_disabled_in_public` i båda miljöerna.
- Applicerad separat mot staging- och production-databaserna via `prisma migrate deploy`; `_prisma_migrations`-raden bekräftad (`applied_steps_count: 1`, `rolled_back_at: null`) i båda.

---

## Kvarvarande fynd

### High

Samma sårbarhetsklass och samma "server-only, noll funktionsrisk"-bevisning som de redan fixade sju — men ännu inte åtgärdade. Ingen bekräftad live-läcka på dessa (till skillnad från `AdminAuditLog`/`StripeWebhookEvent`), men samma exploaterbarhet via publik anon-nyckel.

| Tabell | Risk | Server-only bekräftat? |
|---|---|---|
| `BugReport` | Anon kan läsa/skriva/radera buggrapporter (fritext, ev. PII) | Ja — `POST /api/bug-reports` kräver session, admin-routes admin-only |
| `DeviceToken` | Anon kan enumerera/kapa/radera push-tokens | Ja — kräver `getAuthUser()` |
| `MunicipalityWatch` | Anon kan läsa e-post/bevakningsdata, skapa spam | Ja — `withApiHandler({auth:"customer"})` |
| `ProviderSubscription` | Anon kan förfalska/läsa billing-/prenumerationsstatus | Ja — ingen egen API-route, endast Stripe-webhook (server-till-server) + auth-gated provider-routes |
| `Stable` | Anon kan skapa/ändra/radera stalldata | Ja — publik läsning (`GET /api/stables`) går via appens egen route/Prisma, inte via rå Supabase-klient |
| `StableSpot` | Samma mönster som Stable | Ja — samma repository |

### Medium

- **10 staging-only RLS-disabled-tabeller** (`public`-schemat): `CustomerHorseServiceInterval`, `FeatureFlag`, `Follow`, `HorseServiceInterval`, `NotificationDelivery`, `ProviderCustomer`, `ProviderCustomerNote`, `PushSubscription`, `_RouteOrderToService`, `_prisma_migrations`. Production har redan RLS på (0 policies = implicit deny) på samtliga — ren staging/prod-drift, lägre datakänslighet än High-listan.
- **`custom_access_token_hook()` miljödrift:** production är `SECURITY INVOKER` + `search_path` NOT SET (WARN); staging är `SECURITY DEFINER` + `search_path` explicit satt till `public`. Ej direkt exploaterbar (endast `service_role`/`supabase_auth_admin` har EXECUTE), men bör harmoniseras.
- **`equinet-uploads`-bucket saknar gränser i production:** `file_size_limit`/`allowed_mime_types` är `null`/`null` i production, medan staging har `5MB` + mime-whitelist. Appens magic-bytes-validering finns fortfarande, men bucket-nivå-gränsen är ett defense-in-depth-lager som saknas i prod.

### Low

- **`handle_new_user()`** har `EXECUTE`-grant till `anon`/`authenticated`/`PUBLIC`, men är `RETURNS trigger` — Postgres blockerar direktanrop utanför trigger-kontext. WARN kvarstår i Advisor men är inte praktiskt exploaterbar. Städ-rekommendation: `REVOKE EXECUTE`.
- **`rls_provider_id()`** har `search_path` NOT SET (WARN) — men returnerar bara anroparens egen JWT-claim, ingen eskaleringsrisk.
- **Leaked password protection** avstängt i Supabase Auth (båda miljöerna) — enkel Dashboard-inställning, ingen kodändring.

### Intended / No action

- Alla tabeller med riktiga owner-scoped policies (`Booking`, `Horse`, `Message`, `Payment`, `User`, `Conversation`, `CustomerReview`, `Service`) — konsekvent `auth.uid()`/`rls_provider_id()`-filtrering, inga `USING(true)`-hål hittade.
- `Service.service_public_read` (`isActive = true`, ingen ägarfiltrering) — medveten publik marketplace-policy, inte ett fynd.
- Storage-lockout-mönstret: `storage.objects` har RLS på men 0 policies → alla klient-direkta writes blockerade i båda miljöer; uploads går enbart via `service_role` server-side. Säkert och avsiktligt.
- `_prisma_migrations`/`_RouteOrderToService` i **production** (RLS på, 0 policies = redan implicit deny) — redan säkert, ingen åtgärd.

---

## Rekommenderad nästa slice

Samma mönster som de två redan genomförda slicearna (migration → PR → CI → merge → `prisma migrate deploy` mot båda databaserna → `SET ROLE anon`-probe → Advisor-omkörning).

| Tabell | Risk | Motivering | Föreslagen åtgärd | Uppskattad risk att bryta funktionalitet |
|---|---|---|---|---|
| `BugReport` | High | Anon full CRUD på användarinskickad fritext (möjlig PII) | `ENABLE ROW LEVEL SECURITY` + `Deny all via API` | Ingen — bekräftat server-only |
| `DeviceToken` | High | Anon kan kapa/radera push-registreringar | Samma | Ingen |
| `MunicipalityWatch` | High | Anon kan läsa e-post + skapa spam-bevakningar | Samma | Ingen |
| `ProviderSubscription` | High | Anon kan förfalska/läsa billing-status | Samma | Ingen |
| `Stable` | High | Anon kan skriva/radera stalldata | Samma — **appens publika läsning påverkas inte** eftersom den går via Prisma, inte PostgREST | Ingen |
| `StableSpot` | High | Samma mönster som Stable | Samma | Ingen |
| 10 staging-only-tabeller | Medium | Drift mot production; production visar redan att "RLS på + 0 policies" är korrekt läge | `ENABLE ROW LEVEL SECURITY` (ingen ny policy behövs — matcha production) | Ingen |

**Ur scope för denna nästa slice** (kräver separat beslut/granskning): `custom_access_token_hook`-harmonisering, `equinet-uploads`-bucket-gränser i prod, `handle_new_user`-grant-städning, leaked-password-protection-inställning — inga av dessa är server-only-CRUD-hål och passar inte i samma "trivialt säkra deny-all"-kategori.

---

## Lessons Learned

- **Små, verifierbara security-slices fungerade bra** eftersom varje slice kunde bevisas säker (`SET ROLE anon`-probe, INSERT-avvisning, full testsvit, `check:all`) *innan* nästa steg — istället för en stor "fixa allt RLS på en gång"-ändring där en enskild felaktig policy kunnat blockera legitim trafik utan att det märkts förrän i produktion. Att hålla scope till en migration per slice gjorde varje PR-diff trivial att granska (77 rader, två filer).
- **Verifiera faktisk användning innan RLS aktiveras — gissa inte.** Den avgörande insikten var att grep:a hela `src/` efter rå Supabase-klientanrop och Realtime-prenumerationer (0 träffar för hela appen) samt bekräfta att Prisma ansluter som `postgres`-rollen (`rolbypassrls = true`). Utan den verifieringen hade "deny-all är säkert" varit en gissning, inte ett bevis — och `Stable`/`StableSpot` hade kunnat felaktigt bedömas som riskabla att låsa ner bara därför att de har en publik-lässide i appen (som i själva verket aldrig rör PostgREST).
- **Staging och production hölls synkade i varje steg** (inte bara koden — migrationshistoriken i respektive databas) eftersom `prisma migrate deploy` mot en miljö inte påverkar den andra. Att köra samma verifiering (Advisor + anon-probe) i båda efter varje steg fångade att staging faktiskt hade *fler* RLS-luckor än production (10 extra tabeller) — en drift som annars hade blivit osynlig tills den orsakade ett problem i fel miljö.
- **Migrationshistoriken är viktig** därför att `git merge` av kod och faktisk databasändring är två helt separata operationer i det här projektet (Vercel-deploy rör aldrig databasen). Utan att explicit köra `prisma migrate deploy` mot varje databas separat — och utan att sedan synka migrationsfilerna tillbaka till `main` via en scope-ren cherry-pick-PR (för att undvika att dra in orelaterad staging-drift) — hade `main`, `staging` och production kunnat divergera på ett sätt som bara upptäcks vid nästa `prisma migrate deploy`-krock.

---

## Slutstatus

- **Migrationer:** 48 totalt i `prisma/migrations/`, identiskt antal applicerat i både staging- och production-databasen (`_prisma_migrations`-radantal matchar exakt).
- **Paritet:** `main`, `staging`, staging-databasen och production-databasen är i full paritet avseende de två säkerhetsmigrationerna (`20260805090430_enable_rls_booking_series`, `20260805100939_enable_rls_deny_all_token_and_audit_tables`).
- **Git:** Rent arbetsträd på `main`, inga öppna PR:er för detta arbete (PR #467, #468, #469 mergade och branchar raderade).
- **Återstående arbete:** Se [Rekommenderad nästa slice](#rekommenderad-nästa-slice) — sex High-prioriterade tabeller (`BugReport`, `DeviceToken`, `MunicipalityWatch`, `ProviderSubscription`, `Stable`, `StableSpot`) samt tio Medium-prioriterade staging-only-drift-tabeller kvarstår, plus tre lägre-prioriterade härdningspunkter (auth-hook-drift, storage-bucket-gränser, `handle_new_user`-grant).
