---
title: Sprint 3-A — Critical Security Remediation
description: Retro för C1-C4 hardening efter fixes.txt-audit. Push token hijack, ghost user collision, manual-booking IDOR, upload path traversal.
category: retrospective
status: active
last_updated: 2026-05-18
tags: [security, sprint-3a, hardening, c1, c2, c3, c4]
related:
  - docs/retrospectives/2026-05-06-block-2-staging-and-login-incident.md
sections:
  - Sammanfattning
  - Tidslinje
  - Rotorsak per CRITICAL
  - Fix-strategi
  - Regressioner under sprinten
  - Vad smoke-testet fångade (och inte)
  - Säkerhetsmönster att standardisera
  - Föreslagen fortsatt hardening (icke-kritisk)
  - Lärdomar för AI-assisterad utveckling
---

## Sammanfattning

Sprint 3-A åtgärdade fyra CRITICAL-fynd från extern `fixes.txt`-audit. Alla fyra live på staging
mellan 2026-05-17 och 2026-05-18, verifierade via smoke. Inga produktion-deploys utfärdade —
staging är gating för iOS native-rebuild och demo-flöden.

| Issue | Vektor | Status |
|-------|--------|--------|
| **C4** | Push token hijack via ownership-konflikt | ✅ live |
| **C1** | Ghost user collision vid registrerad e-post | ✅ live |
| **C2** | Manual booking / booking-series med okänd `customerId` | ✅ live + hotfix C2.3 |
| **C3** | Upload path traversal via `file.name.split(".").pop()` | ✅ live |

Coverage före: 0/4. Coverage efter: 4/4. Test-suite +33 tests netto (~+0,7% coverage på
upload + supabase-storage). Ingen lansering, ingen prod-deploy.

## Tidslinje

| Datum | Steg | Slice |
|-------|------|-------|
| 2026-05-17 | Pilot — C4 (push token) live + verifierad | C4 |
| 2026-05-17 | C1.1-C1.4 (ghost user) live; 4 sub-slices, en commit per | C1 |
| 2026-05-17 | C2.1 (BookingService.findProviderCustomerLink/findUserForLink) live | C2.1 |
| 2026-05-17 | C2.2 (BookingSeries surface som 403 + early-abort) live | C2.2 |
| 2026-05-17 | **Staging regression upptäckt:** smoke gav 403 på legitim linked customer | — |
| 2026-05-18 | C2.3 hotfix (`hasBookingRelationshipWith`) live | C2.3 |
| 2026-05-18 | C2-smoke (3 scenarier): alla PASS | — |
| 2026-05-18 | C3 read-only audit (4 upload-endpoints + supabase-storage) | C3 |
| 2026-05-18 | C3 Fix A+B+C implementerad och mergad (PR #337) | C3 |
| 2026-05-18 | Final smoke (8 scenarier): alla CRITICAL-paths PASS | — |

## Rotorsak per CRITICAL

### C4 — Push token hijack
- **Vad:** `device-tokens` / `push-subscriptions` upsert nyttjade native token-värde som key utan
  ownership-check. Användare B kunde lägga in samma token-värde och kapa kanalen från A.
- **Rotorsak:** Upsert-mönstret antog att (userId, token) var unik nyckel, men token är
  device-genererad utan kollisionsskydd mellan användare.

### C1 — Ghost user collision
- **Vad:** `createGhostUser({ email })` återanvände tyst en existerande user-row när e-post
  matchade. Om mottagaren var en registrerad användare övertog provider via stillsam DB-lookup
  effektivt deras booking-history.
- **Rotorsak:** Trust boundary saknades mellan "manual customer" och "registered user". En ghost
  user är logiskt anonym och endast manipulerbar av providern som skapade den. En registrerad
  user är logiskt självägd. Saknad invariant: `existing.isManualCustomer === true` innan retur.

### C2 — Manual booking customerId IDOR
- **Vad:** Provider kunde skicka godtyckligt `customerId` (giltig UUID) i `bookings/manual` eller
  `booking-series` och skapa bokningar i någon annans namn.
- **Rotorsak:** Route passerade `customerId` rakt till `BookingService` utan att verifiera att
  providern hade legitim relation. Service antog ownership via route-lagret.
- **C2.3-twist:** Initial fix krävde explicit `providerCustomer`-länk ELLER `isManualCustomer === true`.
  Detta bröt legitim regression: kunder som syns i `/api/native/customers` aggregerar via
  `booking.groupBy status IN (completed, no_show)` — utan explicit länk. C2.3 lade till tredje
  acceptkriterium `hasBookingRelationshipWith` med samma status-filter som UI:t.

### C3 — Upload path traversal
- **Vad:** `/api/upload` härledde filändelse via `file.name.split(".").pop()`. `file.name =
  "image.png/../../../etc/passwd"` ⇒ `ext = "/etc/passwd"` ⇒ `fileName = "{id}-{ts}./etc/passwd"`
  ⇒ Supabase storage path bryter bucket-namespace.
- **Rotorsak:** Trust boundary saknades på FormData-fält. `file.name` är klient-kontrollerat
  fritt textfält. Native upload-routen hade redan MIME-baserat ext (kommenterad explicit), men
  generic upload-routen hade förbisetts.

## Fix-strategi

Tre genomgående principer fungerade:

1. **Trust boundary först, kod sedan.** Innan implementation: definiera vad servern kontrollerar
   vs vad klienten/användaren kontrollerar. C1 (registered vs manual user), C2 (provider's
   reachable customers), C3 (server-genererad fileName), C4 (token-ägare via DB).
2. **Defense-in-depth utan att ändra arkitektur.** Inga nya abstraktioner, inga "service classes
   för ownership-validering". Bara vassa checks på rätt lager: route-level Zod, service-level
   reachability check, helper-level filename guard.
3. **TDD per slice, commit per sub-slice, samlad push när alla gröna.** C1 hade 4 commits, C3 1
   commit, C2 hade 3 commits inkl. hotfix. Varje slice självständigt verifierbar i staging-deploy.

Sub-slice-storleken (1-2 commits per fix) gjorde det möjligt att rolla tillbaka enskilda
slices utan att förlora andra fixar. Visat värde: C2.2 deploy avslöjade regression som C2.3
kunde hotfixa utan att röra C2.1.

## Regressioner under sprinten

| Slice | Vad gick fel | Hur fångat | Korrigering |
|-------|--------------|------------|-------------|
| C2.2 | Linked customer från `/api/native/customers` rejected med 403 | Staging-smoke (manuell) | C2.3 hotfix — `hasBookingRelationshipWith` med samma status-filter som UI |
| C3 (under TDD) | Befintliga `entityId`-värden i tester (`"horse-1"` etc.) bröt av ny Zod UUID-validering | Vitest RED i lokal körning | Replace_all till UUID v4 i test-fixturen |

Båda regressionerna hade samma underliggande orsak: **UI-semantik och route-semantik divergerade**.
UI:t aggregerar via bokningar; säkerhets-fixen krävde explicit länk. Lärdom under
"säkerhetsmönster" nedan.

## Vad smoke-testet fångade (och inte)

### Final smoke 2026-05-18 (commit 30052a37, staging)

| # | Test | Resultat |
|---|------|----------|
| U1 | Normal upload (giltig fil + UUID entityId) | 500 — **pre-existing Supabase storage infra-issue**, inte C3-regression. "Supabase upload failed" i runtime log. |
| U2 | Upload med `file.name = "../../etc/passwd.jpg"` | 500 (samma som U1 — bevisar att fileName **passerade** assertSafeStorageFileName, Supabase rejectade oberoende) |
| U3 | Encoded traversal `..%2F..%2Fetc%2Fpasswd.jpg` | 500 (samma) |
| U4 | `entityId = "not-a-uuid"` | **400 "Ogiltigt entityId"** ✓ |
| U5 | `entityId = "../../something"` | **400 "Ogiltigt entityId"** ✓ |
| B1 | Legitim manual booking till linked customer | **201** ✓ (cleanup: DELETE → 200) |
| B2 | Manual booking med okänd customerId | **403 "Kunden är inte registrerad hos dig"** ✓ |
| B3 | Booking-series med okänd customerId | **403** + **0 orphan bookings** ✓ |

### Smoke-tester missade

- **Pre-existing Supabase storage misconfiguration på staging-Supabase** (`equinet-uploads`-bucket
  saknas eller service-role permissions). C3-fixen är logiskt verifierad (filename-genereringen
  är säker) men funktionell upload-end-to-end är inte demonstrerbar på staging just nu. Noteras
  som infra-watch.
- **iOS-klienter med cachad gamla URL-format**: Push subscription-rotation under C4 påverkar inte
  redan aktiva sessioner. Inte testat via faktisk iOS-enhet.

## Säkerhetsmönster att standardisera

Tre mönster återkom genom Sprint 3-A och bör formaliseras i `.claude/rules/`:

### 1. Server-genererade identifierare i path-konstruktion

**Aldrig** låt klient-kontrollerat fält (file.name, request-body-strängar, URL-fragment) hamna
i en storage-path direkt. Härled från:
- Server-genererad UUID (för messageId, bookingId-leaf)
- MIME-whitelist (för ext)
- Session-data (för providerId, customerId, userId)

Tillämpning: alla `uploadX()`-helpers, alla path-konstruktioner i `src/lib/storage*`,
filer-skrivning i jobs.

### 2. Reachability check vid resurs-skapande

När en provider/admin/user skapar resurser **å andra användares vägnar**, valider explicit att
relationen finns:
- Provider → Customer: link, manual flag, **eller** existing booking-relationship
- Admin → User: admin-roll i JWT-claim (inte query-param)
- User → User (messaging): existing booking-conversation

Tillämpning: alla routes som accepterar entity-IDs via body, alla cross-entity-bulk-jobs.

### 3. Trust boundary mellan tyst återanvändning och explicit collision

Tysta DB-lookups som "om en row finns med samma X, återanvänd den" är ofta säkerhetshål. Före
återanvändning: verifiera att target-rowen är **typ-kompatibel** (isManualCustomer, ghost-flag,
etc.). Om inte: kasta `EMAIL_BELONGS_TO_REGISTERED_USER`-liknande error, inte tysta retur.

Tillämpning: `createGhostUser` (klart), `createStableInvite`, `createCustomerInvite` (audit
återstår).

## Föreslagen fortsatt hardening (icke-kritisk)

| Issue | Beskrivning | Effort | Sprint |
|-------|-------------|--------|--------|
| V4 (från C3-audit) | UUID-validering av `bookingId` i `messages/attachments/route.ts` | 15 min | 3-B |
| Pre-existing | `services`-bucket i `/api/upload` saknar ownership-validering — vem som helst kan ladda upp om de gissar provider-UUID | 30 min | 3-B |
| Pre-existing | `deleteFile(path)` / `createMessageSignedUrl(path)` är ovaliderade — säkra idag pga DB-källad path, men hardas inte mot framtida caller-misstag | 20 min | 3-C |
| Pre-existing | `Upload.originalName` lagrar `file.name` orenat — ej path-använt men XSS-vektor om framtida vy renderar det | 15 min | 3-C |
| Infrastructure | Staging-Supabase `equinet-uploads`-bucket saknas eller permissions fel → 500 vid upload | TBD | infra-sprint |
| Pre-existing | Dev-fallback i `uploadFile` skriver tyst till `public/uploads/` om Supabase env saknas i prod — bör fail-loud i NODE_ENV=production | 15 min | 3-D |
| H1-H10 | Återstående HIGH-fynd från `fixes.txt` | 1-3h vardera | 3-B |
| M1-M14 + L1-L11 | MEDIUM + LOW hygien-batch | samlat 1 dag | 3-E |

## Lärdomar för AI-assisterad utveckling

Sju observationer som påverkat hur AI:n bör briefas i denna typ av sprint:

### Process

1. **Sub-slice + commit-per-sub-slice gav rätt granularitet för CRITICAL-fixar.** C1 hade 4
   commits, vilket lät C1.4 testa C1.3 utan att blanda concerns. Försök inte slå ihop
   "C1+C2+C3 i en stor PR" — då försvinner möjligheten att hotfixa enskilt.

2. **Read-only audit före kod var värdefull.** För varje CRITICAL: först läsa alla berörda filer,
   identifiera vektorer, **proposera minimal fix och vänta på godkännande**, sedan koda. Den
   audit-fas-rapporten användes som dokumentation och som referens i PR-bodyn. Sparar fram-och-
   tillbaka.

3. **"Smallest safe fix" som princip slog ut "rätt arkitektur"-tankesätt.** Frestelsen att lägga
   till en `CustomerOwnershipService` eller liknande för C2 motstod aktivt. Resultatet (en
   privat `isCustomerReachable`-metod på BookingService) räcker tills tredje liknande
   ownership-check dyker upp.

### Testning

4. **TDD med RED-verifiering före implementation upptäckte bugs i testerna själva.** För C3
   visade RED-körningen att T2 (null-byte i file.name) faktiskt **passerade** redan utan fix —
   eftersom `split(".").pop()` på `"image\x00.png"` ger `"png"`. Det justerade förståelsen av
   exploitability och förändrade not vad fixen behövde lösa.

5. **Staging-smoke fångade vad unit-tester missade.** C2.2 unit-tester var alla gröna och bevisade
   att unknown customerId ger 403. Men de testade INTE den verkliga datakällan
   (`/api/native/customers`-aggregering). C2.3-regressionen var bara synlig genom smoke mot
   riktig data. Lärdom: säkerhets-fixar **måste** verifieras mot produktion-liknande dataflöden,
   inte bara mockade scenarier.

### Briefing

6. **Korta, scope-tighta prompts ("Implement Fix A+B+C exactly as proposed. Keep scope tight.")
   gav bättre resultat än expansiva prompts.** Tendensen att "fixa lite mer medan jag är här"
   är aktiv hos AI-assistenten och måste motverkas av tydliga "Do not fix V4 in this slice".

7. **Be om explicit before/after-redogörelse i rapport-format.** "Show before/after behavior"
   tvingade fram konkretion i mina rapporter och gjorde det enklare för dig att granska. Det
   är samma princip som "Show, don't tell" i tekniska reviews.

## Status efter sprint

- **Branch staging:** `30052a37` (alla fyra CRITICAL live)
- **Branch main:** orörd — staging är gate, prod ej deployad
- **Nästa sprint:** 3-B (HIGH-fynd H1, H4, H7, H10 + V4 + services-bucket-ownership)
- **iOS native-rebuild:** kan fortsätta på staging utan blockerare från säkerhets-spår
- **Demo-läget:** nu klassificerat "TRUSTED EXTERNAL TESTER READY" igen (uppdaterat från
  "INTERNAL TESTERS ONLY" som sattes efter fixes.txt-audit)
