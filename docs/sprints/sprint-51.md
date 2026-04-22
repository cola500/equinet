---
title: "Sprint 51: Pre-launch-härdning"
description: "Sista stora pre-launch-blockern (MFA admin) + S50-uppföljning (bucket-verify) + fresh-dev-setup-fix + iOS auth-polish-kedja avklarad."
category: sprint
status: planned
last_updated: 2026-04-22
tags: [sprint, pre-launch, mfa, ios, auth, hardening]
sections:
  - Sprint Overview
  - Stories
  - Risker
  - Definition of Done
---

# Sprint 51: Pre-launch-härdning

## Sprint Overview

**Mål:** Ta de sista bitarna som står mellan oss och lansering. Efter S51 är det bara externa köp (Vercel Pro + Apple Developer) som återstår.

**Tema:** Pre-launch-härdning. Blanda pre-launch-blocker (MFA) med tekniska skulder som samlats (bucket-verify, seed-sync, iOS auth-polish).

**Scope-princip:** Ingen ny feature. Bara härdning och uppföljning.

**Procedurbrott-mål:** ≤ 2 (fortsätt S48/S49-trenden).

---

## Stories

### S51-0: MFA för admin

**Prioritet:** 0
**Effort:** 1 dag
**Domän:** `src/app/admin/*`, `src/lib/supabase/*`, `src/app/api/admin/*`

**Bakgrund:** Admin-konton har idag bara lösenord. Pre-launch-blocker: alla admin-åtgärder är spårade i `AdminAuditLog` + 15 min session-timeout, men om ett admin-lösenord läcker finns inget andra steg. Supabase stödjer TOTP native sedan 2025 — vi aktiverar det.

**Aktualitet verifierad:**
- Bekräfta att admin-flödet inte redan har MFA (grep `enrollFactor` + `verifyFactor`)
- Kolla att `custom_access_token_hook` redan sätter `isAdmin`-claim (inte del av MFA men bör finnas)
- Verifiera att Supabase-projektet har MFA aktiverat i dashboard (Authentication → MFA)

**Implementation:**

**Del 1 — MFA-enrollment-UI:**
- Ny sida `/admin/security/mfa` (eller flik i befintlig security-sida)
- `supabase.auth.mfa.enroll({ factorType: 'totp' })` → QR-kod (otpauth-URL)
- Användare scannar med Authenticator-app → skriver in 6-siffrig kod
- `supabase.auth.mfa.challenge()` + `verify()` → factor aktiverad
- Visa backup-koder vid enrollment (10 st), varna att spara dem

**Del 2 — MFA-challenge vid admin-login:**
- Efter lösenords-login: om `user.factors[]` innehåller aktiv TOTP → kräv challenge
- Vy: "Ange 6-siffrig kod från din Authenticator-app"
- Success → AAL2 (Authentication Assurance Level 2) → admin-claim tillgängligt
- Failure: 3 försök, sedan 15 min rate-limit (reuse befintlig rate-limiter)

**Del 3 — Backend-enforcement:**
- `withApiHandler({ auth: "admin" })` kollar `session.aal === 'aal2'` — inte bara `isAdmin`
- Admin-routes returnerar 403 "MFA krävs" om AAL1
- `AdminAuditLog` loggar MFA-enrollment + MFA-success/failure som event-typer

**Del 4 — Rollback-väg:**
- Om admin tappar authenticator: dokumenterat process i `docs/operations/admin-recovery.md`
- Just nu: DB-admin kan rensa `auth.mfa_factors` för user manuellt (via Supabase Dashboard)
- Backup-koder fungerar en gång vardera

**Acceptanskriterier:**
- [ ] Admin kan enrolla TOTP-factor via UI
- [ ] Admin-login kräver TOTP-kod efter lösenord om factor aktiv
- [ ] Admin-API-routes returnerar 403 utan AAL2
- [ ] 3 failed MFA-försök → 15 min rate-limit
- [ ] `AdminAuditLog` loggar MFA-events
- [ ] Rollback-process dokumenterad i `docs/operations/admin-recovery.md`
- [ ] Integration-tester: enrollment, challenge, AAL-check, failure rate-limit

**Reviews:**
- `code-reviewer` (obligatorisk, nya routes)
- `security-reviewer` (obligatorisk, auth + admin)
- `cx-ux-reviewer` (obligatorisk, nya UI-sidor)

**Arkitekturcoverage:** Designdokument behövs inte — följer Supabase MFA-standard. Docs-leverans: `docs/security/mfa-admin.md`.

---

### S51-1: Verifiera `message-attachments` bucket i staging + prod

**Prioritet:** 1
**Effort:** 10-15 min
**Domän:** Supabase Dashboard (inga kod-ändringar)

**Bakgrund:** S50-0 hittade att `supabase/config.toml` hade `storage.enabled=false` lokalt och att bucket saknades. Staging och prod är separat från local config. Vi måste bekräfta att bucket faktiskt existerar och har rätt RLS-policies där användare faktiskt kommer ladda upp bilder.

**Aktualitet verifierad:**
- Login till Supabase Dashboard
- Staging: `https://supabase.com/dashboard/project/zzdamokfeenencuggjjp/storage/buckets`
- Prod: `https://supabase.com/dashboard/project/xybyzflfxnqqyxnvjklv/storage/buckets`

**Implementation:**

1. **Staging** (`zzdamokfeenencuggjjp`):
   - Storage → Buckets → bekräfta att `message-attachments` finns
   - Kontrollera RLS-policies (INSERT för auth-users, SELECT begränsad till meddelande-deltagare)
   - Om saknas: skapa bucket manuellt (public=false, file-size-limit 10MB, allowed-mime-types image/jpeg,image/png,image/heic)

2. **Prod** (`xybyzflfxnqqyxnvjklv`):
   - Samma kontroll som staging
   - Om saknas: skapa identiskt

3. **Dokumentera** i `docs/operations/environments.md`:
   - Miljömatris-raden för "Storage" per miljö
   - Manuell setup-instruktion för framtida miljöer

**Acceptanskriterier:**
- [ ] Bucket `message-attachments` bekräftat existerande i staging + prod
- [ ] RLS-policies verifierade (INSERT/SELECT enligt förväntad design)
- [ ] `docs/operations/environments.md` har Storage-rad

**Reviews:**
- `code-reviewer` — ej tillämplig (ingen kod)
- Tech-lead-review av docs-delen räcker

**Arkitekturcoverage:** N/A (verifikation)

---

### S51-2: `seed-test-users.ts` auth-sync

**Prioritet:** 2
**Effort:** 30-45 min
**Domän:** `scripts/seed-test-users.ts` + `docs/guides/gotchas.md`

**Bakgrund:** Efter `db:nuke` skapar `seed-test-users.ts` bara Prisma-`User`-rader, inte Supabase-`auth.users`. Webb-registrering failar tyst (inbucket kan vara avstängd) → användare kan inte logga in efter fresh setup. Tech lead löste manuellt via admin-API med matchande UUIDs — det bör ske automatiskt.

**Aktualitet verifierad:**
- Läs `scripts/seed-test-users.ts` — använder bara Prisma idag?
- Kolla `scripts/nuke-db.ts` — rensar den både Prisma + auth?
- Verifiera att Supabase service-role-key finns i `.env` (behövs för admin-API)

**Implementation:**

1. **Utöka `seed-test-users.ts`:**
   - Före Prisma-insert: anropa `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { ... }, id: <uuid> })`
   - ID:t från Supabase blir `User.id` i Prisma (FK-kompatibilitet)
   - Om auth-user redan finns: hämta via `listUsers` och återanvänd ID
   - Logga vad som skapats/återanvänts

2. **Uppdatera `nuke-db.ts` om det behövs:**
   - Om den bara rensar Prisma: lägg till Supabase admin-delete-kaskad via `auth.admin.deleteUser(id)` för alla test-users
   - Dokumentera att det INTE rensar alla auth-users (bara test-users för säkerhets skull)

3. **Gotcha-rad** i `docs/guides/gotchas.md`:
   - "Seed skapar Prisma-rad men inte auth.users → tyst inloggnings-fail" → hänvisa till seed-scriptet som lösning

**Acceptanskriterier:**
- [ ] `seed-test-users.ts` skapar både auth.users + Prisma-User
- [ ] Befintliga test-users (`test@example.com`, `provider@example.com`) kan logga in efter `db:nuke` + seed
- [ ] `nuke-db.ts` städar både (om applicerbart)
- [ ] Gotcha dokumenterad
- [ ] Integration/smoke-test verifierar login-flödet efter seed (valfritt men bra)

**Reviews:**
- `code-reviewer` (obligatorisk, scripts/)
- `security-reviewer` (obligatorisk — service-role-key hanteras)

**Arkitekturcoverage:** N/A

---

### S51-3: iOS auth-polish continued (S49-1-fynd)

**Prioritet:** 3
**Effort:** 1.5-2h
**Domän:** `ios/Equinet/Equinet/AuthManager.swift` + `AuthManagerTests.swift` + `WebView.swift`

**Bakgrund:** S49-1-reviews (code-reviewer + ios-expert) identifierade 6 minor defense-in-depth-fynd. Alla är icke-blockerande men värda att avklara innan lansering.

**Aktualitet verifierad:**
- Läs senaste `AuthManager.swift` — är något redan fixat i efterföljande commits?
- Grep efter `// TODO` i auth-filer
- Kör `xcodebuild test -only-testing:EquinetTests/AuthManagerTests` — baseline

**Fynd att adressera:**

**1. Banner-UI för exchange-fel** (medel-effort, 30-45 min)
- Idag: `webCookieExchangeFailed` har TODO, AC #2 från S49 delvis uppfyllt
- Fix: Skapa `WebCookieErrorBanner` SwiftUI-vy, bind till `authManager.webCookieExchangeFailed` published-property
- Retry-knapp: triggar `exchangeSessionForWebCookies` igen
- Dismiss-knapp: döljer banner tills nästa exchange-failure

**2. Tester verifierar cookie-injection faktiskt** (20 min)
- Idag: `cookieStorage` DI-parametern används inte i test
- Fix: Använd `MockHTTPCookieStorage` som tracker `setCookie()`-anrop, assert att förväntade cookies sätts med rätt domain/path/name

**3. `filterCookies` hasSuffix edge-case** (10 min)
- Idag: `hasSuffix(".vercel.app")` matchar `evil.equinet.vercel.app.evil.com`
- Fix: Använd `HTTPCookie.isDomainMatch(host)` eller kontrollera att domän börjar med `.` + match
- Lägg till test för edge-case

**4. Retry särskiljer 4xx/5xx** (15 min)
- Idag: 401 retryas 3 ggr fast det är permanent
- Fix: Short-circuit i `performExchange`-retry-loop vid 4xx (utom 408 Request Timeout och 429 Too Many Requests)
- Logga "skipping retry due to client error: \(code)"

**5. `authStateChanges`-stream reconnect** (20-30 min)
- Idag: Stream dör tyst vid nätverksfel, bara warning
- Fix: Wrap i outer Task med exponential backoff (1s → 2s → 4s → max 30s), reset på lyckad re-connect
- Test: inject failing stream → verifiera reconnect-försök

**6. Test-fragilitet: `Task.sleep 300ms`** (10 min)
- Idag: `testLogout_clearsCookiesFromInjectedStore` väntar 300ms
- Fix: Använd `XCTestExpectation` med `fulfill()` från mock-callback istället

**Acceptanskriterier:**
- [ ] Fynd 1: Banner visar + retry fungerar
- [ ] Fynd 2: Cookie-injection-tester verifierar setCookie-anrop
- [ ] Fynd 3: `filterCookies` avvisar `evil.equinet.vercel.app.evil.com`-liknande, test finns
- [ ] Fynd 4: 401/403 retryas inte, 408/429/5xx retryas
- [ ] Fynd 5: Stream reconnectar vid nätverksfel
- [ ] Fynd 6: Inga `Task.sleep` i auth-tester
- [ ] Alla tester gröna (`xcodebuild test`)

**Reviews:**
- `code-reviewer` (obligatorisk, .swift)
- `ios-expert` (obligatorisk)
- `security-reviewer` (domän-match + auth — manuellt, auth-UI-gap)

**Arkitekturcoverage:** N/A (polish)

---

## Risker

| Risk | Sannolikhet | Mitigering |
|------|-------------|-----------|
| Supabase MFA-flödet kräver mer än dokumenterat | Medel | Gör en spike på en timme innan vi commitar till full implementation |
| Bucket saknas i prod och skapas med fel policies | Låg | Dokumentera exakta policy-SQL i environments.md; använd staging som template |
| `seed-test-users.ts`-ändring bryter befintligt dev-flöde | Låg | Kör dry-run först, committa separat från schema-ändringar |
| iOS auth-polish-kedjan växer (S48-0 → S49 → S51-3 → S52?) | Medel | Acceptera att fler minor kan hittas vid reviews. Om ≥3 nya: egen story i S52. |
| MFA kräver Supabase-projekt-konfiguration utanför kod | Hög | Johan aktiverar MFA i Dashboard → sprint-plan dokumenterar steget |

---

## Definition of Done (sprintnivå)

- [ ] S51-0 done: MFA aktivt för admin, testat end-to-end på staging
- [ ] S51-1 done: Bucket verifierat i staging + prod, environments.md uppdaterad
- [ ] S51-2 done: `seed-test-users.ts` skapar auth.users, fresh-setup verifierat
- [ ] S51-3 done: Alla 6 S49-1-fynd adresserade, tester gröna
- [ ] `npm run check:all` 4/4 grön
- [ ] iOS `xcodebuild test` grön
- [ ] Procedurbrott ≤ 2 (fortsätt trend)
- [ ] Sprint-avslut via feature branch + PR (S47-5-regel)
- [ ] Retro identifierar om vi är redo för lansering eller behöver S52

**Inte i scope:**
- E-postverifiering Resend (skippad per Johan 2026-04-22)
- Vercel Pro-upgrade (köp-beslut)
- Apple Developer Program (köp-beslut)
- Egen domän

**Post-S51-kandidater (kan bli S52 eller lansering):**
- Pre-launch-go-beslut (är vi klara?)
- MessagingDialog headless-undersökning (30 min)
- iOS WebView login-bypass för mobile-mcp (45 min)
- Versionera `.claude/skills/` (1-2h)
