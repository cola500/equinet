---
title: "Equinet — Project Health Review (2026-08-06)"
description: "Fullständig Tech Lead-genomlysning: miljöer, arkitektur, säkerhet, produktstatus, dokumentation, teknisk skuld och rekommenderad roadmap."
category: product-audit
status: active
last_updated: 2026-08-06
tags: [health-review, tech-lead, architecture, security, product, roadmap]
depends_on:
  - docs/security/supabase-rls-security-audit-2026-08-06.md
related:
  - docs/roadmap.md
  - docs/sprints/backlog.md
  - docs/architecture/patterns.md
  - docs/architecture/database.md
  - NFR.md
  - README.md
sections:
  - Executive Summary
  - Miljöstatus
  - Arkitektur
  - Säkerhet
  - Produktstatus
  - Dokumentation
  - Teknisk skuld
  - Rekommenderad roadmap
  - Beslut
  - Bilagor
---

# Equinet — Project Health Review (2026-08-06)

> Metod: read-only genomlysning. Utförd som om en nytillträdd Tech Lead/Staff Engineer tar över projektet efter några månaders utveckling. Två Explore-agenter täckte kodbas-arkitektur/teknisk skuld respektive dokumentation/backlog/produktmognad; miljöer och säkerhet verifierades direkt mot Supabase/Vercel. Inga ändringar gjordes under genomlysningen.

## Executive Summary

**Mognad:** Detta är inte en prototyp — det är en produktionsdriven MVP med riktig trafik, riktiga betalningsförberedelser och en ovanligt disciplinerad utvecklingsprocess (gotchas-dokumentation på 1545 rader, 102 retrospectives, konsekvent strukturerad loggning). Samtidigt bär den tydliga spår av organisk tillväxt under några månaders intensivt arbete: två parallella auth-system (dual NextAuth→Supabase-migrering, ej avslutad), två sätt att skriva API-routes (`withApiHandler` i 24 % av routes, manuellt i resten), och dokumentation som ibland motsäger sig själv om datum.

**Arkitekturell konsekvens:** Delvis. Kärnprincipen (routes → domain → infrastructure) är tydligt dokumenterad och följs för de flesta kärndomäner (booking, horse, follow, stable, subscription), men efterlevnaden är inte total — 108 av 182 routes går direkt via Prisma. Enligt CLAUDE.md är detta avsiktligt för enkel CRUD, men gränsen mellan "enkelt" och "kärndomän som borde ha repository" beror på omdöme snarare än en hård regel.

**Stabilitet:** God, med en viktig brasklapp. CI är omfattande (8 jobb, migration-from-scratch mot verklig Supabase-stack). De senaste dagarna visade en mogen incident-till-fix-process: en RLS-läcka hittades, verifierades och åtgärdades i tre kontrollerade slices utan driftstopp (se [Säkerhet](#säkerhet)). Men samma incident är också beviset på att stabilitet ≠ fullständig säkerhetstäckning — mönstret (ny tabell missar bulk-RLS-migration) upprepades minst 13 gånger innan det upptäcktes.

**Största styrkorna:**
1. Incident-till-fix-till-verifiering-disciplinen — gotchas, retrospectives och dagens RLS-arbete visar en process som faktiskt lär sig av misstag och skriver ner det konkret.
2. Strukturerad loggning och observability redan på plats (Sentry, `logger`/`clientLogger`, i praktiken noll `console.*` i produktionskod).
3. Ovanligt mogen feature-flag-infrastruktur för ett soloprojekt (Redis-backad, admin-UI, rollout-checklist, redan genomförd källa-till-sanning-migrering).

**Största riskerna:**
1. RLS-mönstret är ett symptom, inte bara ett enskilt fynd — utan en processfix (CI-gate som failar om en ny tabell saknar RLS) kommer det hända igen vid nästa schemaändring.
2. Stripe-livebetalning är den enda kvarvarande P0-blockeraren enligt NFR.md — men den är affärsmässig (företagsverifiering), inte teknisk.
3. Dokumentationsdrift — flera toppnivådokument (README, roadmap.md, docs/INDEX.md) har inbördes motsägande datum och pekar på varandra istället för att vara aktuella i sig själva.
4. Ensam utvecklare — imponerande output, men ingen redundans i kunskap, review eller beslut.

**Viktigaste rekommendationerna:** Bygg en processfix för RLS innan nästa schemaändring (inte fler punktfixar); behandla Stripe-blockaden som ett affärsbeslut att eskalera, inte ett engineering-backlogitem; konsolidera dokumentationssanningen till en källa.

---

## Miljöstatus

| | **Lokal** | **Staging** | **Production** |
|---|---|---|---|
| **Deployment** | Ingen (utvecklarmaskin) | `equinet-staging-app` (Vercel), bygger endast `staging`-branchen | `equinet-app` (Vercel), bygger `main`. Separata Vercel-projekt, korrekt isolerade |
| **Databas** | Lokal Postgres via Supabase CLI (127.0.0.1:54322), status vid granskning: stoppad | Egen Supabase-instans `zzdamokfeenencuggjjp` (eu-central-1), ACTIVE_HEALTHY | Egen Supabase-instans `xybyzflfxnqqyxnvjklv` (eu-central-2), ACTIVE_HEALTHY |
| **Migrationer** | 49 filer i repo | 49/49 applicerade (`_prisma_migrations`) | 49/49 applicerade |
| **Auth** | Supabase Auth + Custom Access Token Hook | Samma mekanism, egen `auth.users`-instans | Samma mekanism, egen instans |
| **Feature flags** | Samma kodbas, lokal Redis/DB | Supabase DB källa-till-sanning (Edge Config borttaget) | Samma, men ett prod-DB-reconcile-steg (`follow_provider`/`municipality_watch` → true) återstår innan vissa flaggor kan slås på säkert utan regression |
| **Demo-mode** | `NEXT_PUBLIC_DEMO_MODE=true` manuellt vid behov | `NEXT_PUBLIC_DEMO_MODE=false` sedan Slice 3b — demo aktiveras per session via demo-knappar, inte globalt | `IS_LIVE_PRODUCTION=true` sedan 2026-07-02 (Slice 3c) — `isStagingSafe()=false`, demo-knappar syns aldrig |
| **Säkerhet (RLS)** | Ej relevant (ingen extern anon-nyckel-exponering) | 0 ERROR bland de tabeller som delas med prod; 10 tabeller har fortfarande RLS av (staging-only-drift, lägre datakänslighet, redan i backlog som nästa säkerhetsslice) | **0 kvarvarande `rls_disabled_in_public`-ERROR** efter den tredje säkerhetsslicen (2026-08-06) |

**Paritet:** Migrationsmässigt är `main`, staging-DB och prod-DB i **full paritet** — 49/49 verifierat 2026-08-06. Kod-mässigt är `main`↔`staging` nästan i synk; den enda kända avvikelsen är en äldre "prod-lik staging"-epiks docs/deps-ändringar som ännu bara finns i staging. Den enda **avsiktliga** kvarvarande skillnaden är de 10 staging-only RLS-av-tabellerna (staging mindre säkert där) och att `equinet-uploads`-bucketen har striktare gränser i staging än i produktion (omvänd riktning — production bör hämta upp).

---

## Arkitektur

| Lager | Bedömning |
|---|---|
| **Frontend** | Route-grupper per roll (customer/provider/admin) är rimligt organiserade. `CustomerLayout`-konventionen ("wrappa ALLTID kundsidor") syns bara i 17 filer trots fler kundsidor — värt en snabb audit av efterlevnad. |
| **Backend/domän** | 21 underdomäner i `src/domain`. Väl avgränsat för booking, horse, follow, stable, subscription, group-booking (Service + Repository + tydliga routes). Svagare för `payment` (inget repository trots att det rör pengar) och `notification` (inget repository) — kandidater enligt CLAUDE.md:s egen kärndomän-lista men saknar mönstret idag. |
| **API** | Konsekvent i sak (Zod `.strict()`, `select` inte `include`, svenska felmeddelanden, `logger`) men inkonsekvent i form — `withApiHandler` används i bara 44 av 182 routes. En pågående, inte avslutad, migrering. Publik/skyddad URL-konvention (`/api/stable/*` vs `/api/stables/*`) är dock tydlig och konsekvent följd. |
| **Datamodell (Prisma)** | 45 models, ovanligt väl kommenterad — nästan varje icke-trivial modell har en syftesskommentar. Inga ad-hoc-tecken vid genomläsning; par som `Review`/`CustomerReview` är avsiktlig separation, inte duplicering. |
| **Prisma (drift)** | Ansluter till Supabase som `postgres`-rollen (kringgår RLS helt). Migrationshistorik hanteras manuellt (`prisma migrate dev` fungerar inte mot Supabase pga shadow-DB-gotcha: saknar `auth`-schema) — fungerar men kräver disciplin, vilket är precis vad som brast för de 13 RLS-tabellerna (se [Säkerhet](#säkerhet)). |
| **Supabase** | Används primärt för Auth + RLS-som-defense-in-depth, inte för direkt klientåtkomst. Bekräftat: 0 rå Supabase-klient `.from()`-anrop och 0 Realtime-prenumerationer i hela `src/`. Konsekvent, medveten arkitekturprincip. |
| **Auth** | Supabase Auth + Custom Access Token Hook (PL/pgSQL) för JWT-claims. Dual-auth-rester (NextAuth→Supabase) syns fortfarande i filnamn (`auth-dual.ts`) och gotchas-dokumentet — en pågående, inte avslutad, migrering. |
| **Deployment** | Två separata Vercel-projekt (prod/staging) med separata Supabase-instanser — korrekt isolerat idag, men det krävde flera dokumenterade incidenter (env-variabel-fällor) för att nå dit. |
| **Teststrategi** | ~390 testfiler mot ~1116 källfiler i `src/` (~35 % filandel). BDD dual-loop för API-routes/domain services, enkel TDD för utilities/hooks. E2E och offline-smoke körs bara mot `main` (kostnadsmedveten CI-design). |

**Vad som fungerar bra:** Datamodellens kommentarsdisciplin; den konsekventa `select`-över-`include`-regeln; RLS/Prisma-gränsen är arkitekturellt ren (vilket gjorde dagens säkerhetsfix enkel trots allvaret); i praktiken utrotad `console.*` i produktionskod.

**Teknisk skuld:** `withApiHandler`-migreringen (76 % kvar), dual-auth-resterna, inget `.nvmrc`/`engines`-fält trots att CI hårdkodar Node 20, `payment`/`notification`-domäner utan repository.

**Förbättringsmöjligheter:** Slutför `withApiHandler`-migreringen (minskar risk att auth/rate-limiting glöms i manuell variant); lägg repository-lager på `payment` givet att det rör pengar; pinna Node-version.

---

## Säkerhet

Fullständig detalj i [Supabase RLS- och behörighetsaudit](../security/supabase-rls-security-audit-2026-08-06.md) — denna sektion sammanfattar.

**Vad som åtgärdats (tre kontrollerade slices, verifierade i staging och production separat):**
- `BookingSeries` — policies fanns men RLS var av; production hade fullt anon-CRUD på riktiga bokningsserier.
- 6 server-only-tabeller (`PasswordResetToken`, `CustomerInviteToken`, `StableInviteToken`, `MobileToken`, `AdminAuditLog`, `StripeWebhookEvent`) — `AdminAuditLog` läckte **52 riktiga rader** i produktion (admin-händelser + IP-adresser), `StripeWebhookEvent` läckte 4 i staging.
- 6 ytterligare server-only-tabeller (`BugReport`, `DeviceToken`, `MunicipalityWatch`, `ProviderSubscription`, `Stable`, `StableSpot`).

**Resultat:** Security Advisor i production visar nu **noll** `rls_disabled_in_public`-ERROR.

**Återstående Medium/Low-fynd:**
- 10 staging-only RLS-av-tabeller (ren miljödrift, production redan säkert på samma tabeller).
- `custom_access_token_hook()`-miljödrift (production `SECURITY INVOKER`, staging `SECURITY DEFINER`).
- `equinet-uploads`-bucket saknar storleks-/mime-gränser i production (staging har det).
- `handle_new_user()` har en onödig `EXECUTE`-grant till `anon`/`authenticated` (ej praktiskt exploaterbar — trigger-only-funktion).
- Leaked password protection avstängt i Supabase Auth.

**Rekommenderade nästa steg:**
1. Städa de 10 staging-only-tabellerna — trivialt, samma bevisade mönster.
2. **Bygg en processfix**: en CI- eller pre-commit-check som failar om `prisma/schema.prisma` innehåller en ny model utan motsvarande `ENABLE ROW LEVEL SECURITY` i migrationshistoriken. Detta är den enskilt viktigaste säkerhetsåtgärden — utan den är nästa schemaändring garanterat sårbar för samma mönster.
3. Payment Security Review + Stripe Idempotency Keys/Restricted Keys innan riktiga betalningar (redan i backlog som "måste göras").

---

## Produktstatus

**Färdiga funktioner:** Bokningsflöde (inkl. återkommande bokningar, gruppbokningar), kundinbjudningar, iOS native-app (kalender, kunder, tjänster, röstloggning med AI), offline PWA, kundinsikter/affärsinsikter, säkerhetslagret (RLS, rate-limiting, admin-audit).

**MVP-delar (kod klar, extern blockerare):** Stripe-betalning (väntar företagsverifiering), push-notiser (väntar Apple Developer/APNs), ruttplanering/annonsering (väntar Mapbox-token), stallprofiler (kod klar men flaggad av, aldrig testad med riktiga användare).

**Experimentella delar:** `provider_subscription` (prismodell inte beslutad), `demo_mode` som koncept (osäkert om det behövs efter lansering).

**Vilande initiativ (kräver PO-beslut):** Messaging-epic (leverantör↔leverantör-delen), Fortnox-fakturering.

**Mest värdeskapande just nu:** Bokningsflödet + kundinbjudningar (kärnloopen som redan är live), och iOS-röstloggningen — ett tydligt AI-differentierande feature som redan är produktionsklart.

---

## Dokumentation

**Inventering:**
- README.md — omfattande funktionslista, men frontmatter-datum (2026-04-11) släpar efter faktiskt arbete (senaste leveranser fram till 2026-07-02).
- docs/roadmap.md — självdeklarerat inaktuell ("se backlog.md för aktuellt läge").
- docs/sprints/backlog.md — kanonisk och relativt aktuell (2026-07-02), men docs/sprints/status.md (2026-06-07) visar ingen tydlig bild av vad som pågår just nu.
- docs/security/ — nu välhållet efter dagens arbete; `rls-findings.md` (2026-03) är sakligt inaktuell och flaggad som företrädd av augusti-auditen, men inte omskriven.
- docs/operations/ — 33 filer, god täckning (deployment, incident-response, backup, monitoring), men 10+ demo/staging-relaterade dokument känns oproportionerligt många för ett soloprojekt.
- docs/ideas/ (epics) — 9 filer, status-fält ej synkat med faktiskt leveransläge (flera epics markerade "active" trots att delar redan är levererade).
- docs/INDEX.md — saknade 6 av 9 idea-filer och hade internt motsägande "senast uppdaterad"-datum (delvis åtgärdat för security-sektionen 2026-08-06).

**Vad saknas:**
- En enda auktoritativ "nuläge"-sida som ersätter det spridda README/roadmap/backlog/status-mönstret.
- Formell stängning av Sprint 65 (7 stories pending sedan 2026-04-30, aldrig återupptagen).
- En omskrivning eller arkivering av `docs/security/rls-findings.md`.

---

## Teknisk skuld

Prioriterad ordning:

1. **RLS-processfix** — inte "dependency debt" i sig, men den mest akuta strukturella skulden (se [Säkerhet](#säkerhet)).
2. **Node-versionspinning** (`.nvmrc`/`engines` saknas) — litet, snabbt, löser ett redan dokumenterat friktionsproblem (Node 26 kraschar ~32 jsdom-tester lokalt, tvingar `node@20`-workaround).
3. **Dependency management** — 23 kvarvarande npm-audit-advisories (3 critical, 8 high, 11 moderate, 1 low enligt backlog), inga drift-blockerande men bör städas medvetet innan Stripe går live.
4. **DX** — Node-versionsdrift (se ovan) är den huvudsakliga friktionskällan just nu; i övrigt gedigen tooling (check:all, pre-commit/pre-push-hooks).
5. **`withApiHandler`-migrering** — 76 % av routes kvar på det äldre mönstret, ökar kognitiv last och säkerhetsrisk (rate-limiting/auth kan glömmas i manuell variant).
6. **Dual-auth-rester** (NextAuth→Supabase) — källa till svårupptäckta buggar om lämnad ofullständig för länge.
7. **Testning** — ~35 % filandel har motsvarande testfil; ingen krisnivå, men ingen coverage-siffra fanns tillgänglig vid denna genomlysning för radnivå-bedömning.
8. **Observability/logging** — redan starkt (Sentry, structured logging via `logger`/`clientLogger`, i praktiken noll `console.*` i produktionskod) — lägst prioritet att förbättra ytterligare just nu.
9. **Monitoring/performance** — inget larmerande hittat vid denna genomlysning, men inte djupt granskat; `docs/operations/load-testing.md` finns som grund för en framtida djupare genomgång.

---

## Rekommenderad roadmap

**Nästa två veckor:**
- RLS-processfix (CI-gate: ny model kräver RLS)
- Stäng de 10 staging-only RLS-av-tabellerna
- GDPR data retention-cron (lagkrav)
- Fixa fire-and-forget-notifier-buggen (bevisat att lösenordsåterställnings-mail missat Resend)
- `.nvmrc`/`engines`-pinning

**Nästa månad:**
- Payment Security Review + Stripe Idempotency Keys/Restricted Keys
- Dependency maintenance-vågen (23 advisories, flera små PR:er)
- Konsolidera dokumentationssanningen (README/roadmap/backlog/status → en källa)
- Beslutsmöte: `provider_subscription`-prismodell (blockerar en hel produktlinje tills beslut tas)

**Nästa kvartal:**
- Slutför `withApiHandler`-migreringen
- Stripe live-mode så snart företagsverifiering är klar, fullt produktionssatt betalningsflöde
- PO-beslut om Messaging-epic (leverantör↔leverantör) och Fortnox-fakturering
- Utvärdera om `demo_mode` som koncept fortfarande behövs efter att live-betalning är på plats

---

## Beslut

Strategiska slutsatser dragna under genomgången:

1. **RLS-mönstret behandlas som ett processproblem, inte en serie punktfixar.** Att samma rotorsak (ny tabell missar bulk-RLS-migration) upprepades 13 gånger visar att manuell disciplin inte räcker — en automatiserad spärr prioriteras före ytterligare enskilda tabellfixar.
2. **Stripe-livebetalning är en affärsblockerare, inte en teknisk backloggpost.** Företagsverifieringen ska eskaleras och bevakas som ett affärsbeslut; ingenjörsarbetet (idempotency, restricted keys, security review) förbereds parallellt men kan inte lösa själva blockern.
3. **De 10 staging-only RLS-tabellerna prioriteras lägre än de redan åtgärdade 13**, trots att fixen är lika enkel — eftersom risken (staging, lägre datakänslighet, ingen bekräftad läcka) är lägre. Sekvensering baseras på faktisk risk, inte på hur lätt en fix är.
4. **`provider_subscription`-prismodellen fryses tills ett produktbeslut tagits.** Vidare kodarbete på den produktlinjen utan prisbeslut riskerar att bygga fel sak.
5. **Dokumentationssanningen konsolideras till en källa** istället för att spridas över README, roadmap.md, backlog.md och status.md med separata (och ibland motsägande) datumstämplar — annars blir varje ny genomlysning (mänsklig eller AI-assisterad) tvungen att göra samma detektivarbete på nytt.
6. **Denna rapportserie (`docs/product-audit/`) återupptas som en levande, daterad genomgång** snarare än en engångsinsats — nästa genomlysning bör kunna jämföra mot detta dokument istället för att börja om från noll.

---

## Bilagor

- [Supabase RLS- och behörighetsaudit 2026-08](../security/supabase-rls-security-audit-2026-08-06.md)
- [docs/roadmap.md](../roadmap.md)
- [docs/sprints/backlog.md](../sprints/backlog.md)
- [docs/architecture/patterns.md](../architecture/patterns.md)
- [docs/architecture/database.md](../architecture/database.md)
- [docs/architecture/ddd-light-pattern.md](../architecture/ddd-light-pattern.md)
- [docs/architecture/auth-rls-defense-in-depth-pattern.md](../architecture/auth-rls-defense-in-depth-pattern.md)
- [docs/operations/deployment.md](../operations/deployment.md)
- [docs/operations/environments.md](../operations/environments.md)
- [docs/operations/incident-runbook.md](../operations/incident-runbook.md)
- [docs/operations/feature-flag-rollout-checklist.md](../operations/feature-flag-rollout-checklist.md)
- [NFR.md](../../NFR.md)
- [README.md](../../README.md)
