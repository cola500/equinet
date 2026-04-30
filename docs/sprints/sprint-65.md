---
title: "Sprint 65: Sprint 64 follow-through — auth-säkerhet och leveransgarantier"
description: "Sju stories från tech-lead-review av Sprint 64. Tre BLOCKERS i auth/callback + huvudfixet (fire-and-forget) räddar inte leveransen. Sprint 64 är inte release-klar förrän dessa landar."
category: sprint
status: planned
last_updated: 2026-04-30
tags: [sprint, auth, email, security, hotfix, follow-through]
sections:
  - Sprint Overview
  - Stories
---

# Sprint 65: Sprint 64 follow-through — auth-säkerhet och leveransgarantier

## Sprint Overview

**Mål:** Stänga säkerhetsluckor introducerade i Sprint 64 och göra om huvudfixet (fire-and-forget → blocking await) till en faktisk leveransgaranti istället för en fördröjning.

**Källa:** Tech-lead-review post-merge 2026-04-30. Reviewers (security-reviewer + code-reviewer) hittade 3 BLOCKERS, 7 MAJORS och 5 MINORS. Sprint 64 är **inte release-klar** trots att alla stories är `done` — huvudfixet räddar inte leveransen och callback-routen har öppen attack-yta.

**Nuläge:**
- `auth/callback`-routen är mergad men får INTE aktiveras i Supabase Redirect URLs förrän B1+B2+B3 är fixade (open redirect, ovaliderad redirectTo, hardkodad provider-routing).
- Fire-and-forget-fixet i S64-1 byter ut tyst leveransbortfall mot 15s latency + samma tysta leveransbortfall vid Resend-timeout. Användaren får "konto skapat"-success även när mail aldrig kom fram.
- Fire-and-forget kvarstår i 4 routes som ALDRIG adresserades: `bookings/[id]/reschedule` (kunder får inte mail vid bokningsändring — pre-launch blocker), `stable/invites`, `provider/customers/[customerId]/invite`, `booking-series/route`.
- "Byt lösenord" invaliderar inte sessioner på andra enheter. Rate-limiter delas med forgot-password. Endpointen är öppen för alla användare trots att det bara finns UI för leverantörer.
- CI-guard saknar `STRIPE_WEBHOOK_SECRET` (samma kategori som APP_URL-buggen som triggade hela ärendet).

**DoD:** Alla 7 stories done. `auth/callback` aktiverad i Supabase Redirect URLs efter S65-1. Manuell verifiering av leverans (5 password reset i rad → 5 mail) visar 100% efter S65-2.

| Story | Beskrivning | Effort | Prioritet |
|-------|-------------|--------|-----------|
| S65-1 | Hotfix: open redirect + saknad redirectTo + userType-routing i auth/callback | 1-2h | **1 (HÖG, hotfix)** |
| S65-2 | Riktig fire-and-forget-fix: fail loud eller retry-kö (rotorsak) | 0.5-1 dag | **2 (HÖG)** |
| S65-3 | Eliminera kvarstående fire-and-forget i reschedule + invites + booking-series | 1-2h | **3 (HÖG)** |
| S65-4 | Lägg till STRIPE_WEBHOOK_SECRET + audit för fler missade env-vars i CI-guard | 15 min | 4 |
| S65-5 | Session-invalidering på andra enheter vid lösenordsbyte | 30 min | 5 |
| S65-6 | Egen rate-limiter för change-password (inte delad med forgot-password) | 30 min | 6 |
| S65-7 | userType-guard på change-password + synkad lösenordspolicy i UI | 1h | 7 |

**Total effort:** ~2-3 dagar.

**Föreslagen ordning:** 1 → 2 → 3 → 4 → 5 → 6 → 7. Hotfix-storyn (S65-1) först eftersom den blockerar callback-aktivering.

**Pre-existing context:**
- Sprint 64 mergad 2026-04-30 men **inte release-klar** enligt tech-lead-review samma dag.
- Fynd-rapporten finns i sessionshistoriken — referera vid behov.

**Dashboard-beroenden (Dev har inte access — koordinera med Johan):**
- S65-1 kräver att Johan **inte** lägger till `https://equinet-app.vercel.app/auth/callback` i Supabase Redirect URLs förrän B1+B2+B3 är fixade. När storyn är klar: Johan aktiverar i [Supabase URL Configuration](https://supabase.com/dashboard/project/xybyzflfxnqqyxnvjklv/auth/url-configuration).

---

## Stories

### S65-1: Hotfix auth/callback — open redirect + redirectTo + userType-routing

**Prioritet:** 1 (HÖG, hotfix)
**Effort:** 1-2h
**Domän:** webb

**Problem (3 BLOCKERS från review):**
- **B1**: `route.ts:18-20` använder `origin` från `request.url` som redirect-base. Vercel preview kan ha manipulerad Host-header → open redirect till främmande domän.
- **B2**: Ingen `redirectTo`/`next`-param-stöd. Hardkodad redirect till `/provider/dashboard`. När parametern läggs till senare saknas vit-listning (`startsWith("/")` + ingen `//`-prefix). Login-sidan har checken redan — callback ärver inte.
- **B3**: Alla användare skickas till `/provider/dashboard` oavsett `userType`. Kund som klickar magic link landar på provider-yta → 403/blank screen + skräp i error-loggar.

**Plus 3 MINORS samlade:**
- **Mi1**: `Cache-Control: no-store`-header saknas. Auth-svar ska aldrig cachas.
- **Mi2**: Bara unit-test, inget integration-test. BDD dual-loop bruten på auth-route.
- **Mi4**: Dubbel-klick på magic link → Supabase-error på engelska läcker via redirect-URL ("code already used"). Mappa till svenska generiska meddelanden.

**Fix:**
- Använd `process.env.APP_URL` som canonical redirect-base.
- Lägg till `next`/`redirectTo`-parameter med vit-listning (`startsWith("/") && !startsWith("//")`).
- Hämta `userType` från `auth.users` claims efter session-exchange. Routa: `provider` → `/provider/dashboard`, `customer` → `/dashboard`, `admin` → `/admin`. Default fallback: `/dashboard`.
- Sätt `Cache-Control: no-store`.
- Skriv integration-test som anropar Supabase auth-endpoint (eller mockar med realistiskt response).
- Mappa Supabase-felmeddelanden ("code already used", "invalid code") till svenska generiska ("Länken har redan använts eller är inte giltig").

**Filer:**
- `src/app/auth/callback/route.ts` — refaktorera enligt ovan
- `src/app/auth/callback/route.test.ts` — utöka eller ersätt med integration-test
- `src/app/auth/callback/route.integration.test.ts` (ny) — om separation behövs

**Acceptanskriterier:**
- [ ] PoC: manipulerad Host-header redirektar INTE till främmande domän
- [ ] `?next=/customer/bookings` redirektar dit; `?next=//evil.com` avvisas
- [ ] Kund-användare landar på `/dashboard` (eller customer-yta), inte `/provider/dashboard`
- [ ] Header `Cache-Control: no-store` på alla responses
- [ ] Dubbel-klick på samma magic link → svenskt felmeddelande, ingen Supabase-engelska läcker
- [ ] Integration-test täcker happy path + error path + open redirect-försök
- [ ] Efter merge: Johan aktiverar callback-URL i Supabase Redirect URLs allowlist

---

### S65-2: Riktig fire-and-forget-fix — fail loud eller retry-kö

**Prioritet:** 2 (HÖG)
**Effort:** 0.5-1 dag
**Domän:** webb

**Problem (M4 från review):** Sprint 64 bytte `.catch(() => {})` till blocking `await` med 15s timeout. Men:
- Vid Resend-timeout: `email-service.ts:58` returnerar `{ success: false, error }`.
- `AuthService` (`AuthService.ts:300-303`) loggar bara felet och returnerar `Result.ok({ sent: true })` till klienten.
- Användaren får "konto skapat"-success även om mailet aldrig levererades.
- **Resultat:** samma symptom som incidenten 2026-04-30 — bara med 15s extra latency. Sprint 64 räddar inte leveransen.

**Fix-alternativ (välj efter omdöme):**

**Alt A — Fail loud:** AuthService kastar `EMAIL_DELIVERY_FAILED` när `email-service.send()` returnerar `success: false`. Routen mappar till HTTP 502 + svenskt meddelande. Användaren ser "Vi kunde inte skicka mailet just nu — försök igen om en stund". Konto skapas/lösenord-reset-token kvarstår, så användaren kan retry:a.

**Alt B — Retry-kö:** Lägg till en `EmailDeliveryQueue`-tabell. Vid send-fel: skriv rad och returnera success till användaren. Cron-job retryar var 5:e min med exponential backoff. Dead letter efter N försök → Sentry alert.

**Rekommendation:** Alt A är enklare och tillräckligt för pre-launch. Alt B är "rätt" långsiktigt men ger nya fel-modes (kö-tabell-retention, race condition vid ny send + queue-replay). Börja med Alt A. Om mail-volym växer eller Resend har dålig SLA → bygg Alt B i en framtida sprint.

**Filer (Alt A):**
- `src/domain/auth/AuthService.ts` — alla email-send-call-sites: returnera `EMAIL_DELIVERY_FAILED` vid fail
- `src/domain/auth/mapAuthErrorToStatus.ts` — mappa till HTTP 502
- `src/lib/email/email-service.ts` — verifiera att `success: false` alltid bubblar via tydlig felkod
- Tester på alla berörda routes — happy path + email-fail path

**Acceptanskriterier:**
- [ ] Resend-timeout under registrering → användaren får 502 + svenskt felmeddelande
- [ ] Resend-timeout under password reset → användaren får 502
- [ ] Konto/token kvarstår i DB efter email-fel — användaren kan retry:a
- [ ] Sentry får alert när email-fel sker
- [ ] Manuell prod-verifiering: simulera Resend-down (felaktig API-key) och verifiera att routen returnerar 502 till användaren

---

### S65-3: Eliminera kvarstående fire-and-forget

**Prioritet:** 3 (HÖG)
**Effort:** 1-2h
**Domän:** webb

**Problem (M5 från review):** Sprint 64-commit nämner "kvarstående fire-and-forget i routes (stable/invites, customers/invite, booking-series/route, bookings/reschedule) noterade för separat åtgärd" — men ingen story skapades. Reschedule är extra allvarligt: kunder får inte mail vid bokningsändring → direkt missad service. Pre-launch blocker.

**Fix:** Audit + ersätt `.catch(() => {})` med blocking `await` (samma mönster som S64-1) i alla 4 routes. Använd S65-2:s fail-loud-pattern (eller dess retry-kö om den landar först).

**Filer:**
- `src/app/api/stable/invites/route.ts:72-78`
- `src/app/api/provider/customers/[customerId]/invite/route.ts:102-109`
- `src/app/api/bookings/[id]/reschedule/route.ts:103-112`
- `src/app/api/booking-series/route.ts` — sökning krävs (inte verifierad i review)
- `grep -rn "\.catch(() => {})" src/` — fullständig audit, fixa alla träffar i routes

**Acceptanskriterier:**
- [ ] Inga `.catch(() => {})` i `src/app/api/**/route.ts`-filer (eller motivering per kvarvarande)
- [ ] Tester verifierar att email-fel bubblar till användaren
- [ ] Manuell prod-verifiering: trigga reschedule + invite + booking-series, verifiera mail-leverans i Resend

---

### S65-4: Komplettera CI-guard env-lista

**Prioritet:** 4
**Effort:** 15 min
**Domän:** infra

**Problem (M6 från review):** `scripts/check-prod-env.ts` saknar `STRIPE_WEBHOOK_SECRET`. `StripeSubscriptionGateway.ts:34-36` kastar runtime-error om missing. Subscription-flödet är aktivt via flag → samma kategori som APP_URL-buggen som triggade hela hotfix-spåret.

**Fix:** Lägg till `STRIPE_WEBHOOK_SECRET`. Audit övriga env-användande filer för att fånga andra missade variabler.

**Audit-kommando:** `grep -rn "process.env\." src/ scripts/ --include="*.ts" | grep -oE "process\.env\.[A-Z_]+" | sort -u`

**Filer:**
- `scripts/check-prod-env.ts` — utöka REQUIRED-listan
- `scripts/check-prod-env.test.ts` — uppdatera test

**Acceptanskriterier:**
- [ ] `STRIPE_WEBHOOK_SECRET` finns i listan
- [ ] Audit-resultat dokumenterat i done-fil/PR — vilka variabler exkluderades medvetet och varför
- [ ] Test verifierar att alla nya variabler triggar fel om missade

---

### S65-5: Session-invalidering vid lösenordsbyte

**Prioritet:** 5
**Effort:** 30 min
**Domän:** webb

**Problem (M1 från review):** `auth.admin.updateUserById(userId, { password })` invaliderar INTE sessioner på andra enheter. Klassiskt UX-säkerhetskrav: byter du lösenord pga misstänkt intrång ska andra enheter loggas ut.

**Fix:** Anropa `auth.admin.signOut(userId, "others")` direkt efter `updateUserById`. Behåll aktuell session.

**Filer:**
- `src/app/api/auth/change-password/route.ts` — lägg till signOut(others)-anrop
- `src/app/api/auth/change-password/route.integration.test.ts` — verifiera att andra sessioner invalideras

**Acceptanskriterier:**
- [ ] Test: skapa två sessioner för samma användare → byt lösenord i ena → andra sessionen loggas ut
- [ ] Aktiv session består (användaren slipper logga ut sig själv)
- [ ] Manuell verifiering: två fönster (Chrome + Safari) inloggade, byt lösenord i ena → Safari fönstret tappar session vid nästa anrop

---

### S65-6: Egen rate-limiter för change-password

**Prioritet:** 6
**Effort:** 30 min
**Domän:** webb

**Problem (M2 från review):** Change-password använder `rateLimiters.passwordReset` (3/h per IP) — delas med forgot-password. Resultat:
- Användare på CGNAT/delad IP som tidigare i timmen klickade "glömt lösenord" 3 ggr blockeras tyst från att byta lösenord när de loggat in.
- Angripare som spammar `change-password` bränner offers IP:s "glömt lösenord"-kvot.

**Fix:** Skapa `rateLimiters.passwordChange` med separat limit (förslag: 5/h per användarId — mer permissivt eftersom användaren är auth:ad). Nyckel: `${userId}` (inte IP) för att undvika delade-IP-problem.

**Filer:**
- `src/lib/rate-limit.ts` — ny limiter `passwordChange`
- `src/app/api/auth/change-password/route.ts` — använd nya limitern
- Tester på rate-limiter-applicering

**Acceptanskriterier:**
- [ ] Forgot-password och change-password har separata kvoter
- [ ] Rate-limit-nyckel är `userId`, inte IP
- [ ] Test: 5 change-password-försök för samma user → 6:e returnerar 429

---

### S65-7: userType-guard på change-password + synkad lösenordspolicy i UI

**Prioritet:** 7
**Effort:** 1h
**Domän:** webb

**Problem (M3 + Mi5 från review):**
- M3: `change-password`-endpoint är öppen för **alla auth:ade användare** (kund eller provider). Commit-meddelandet säger "för leverantörer". UI är begränsad till provider-profilen, men routen är inte. Kund kan POST:a direkt.
- Mi5: `ChangePasswordDialog.tsx:29-33` validerar bara `length >= 8`. Routen kräver upper/lower/digit/special. Användaren får server-fel istället för klient-side feedback.

**Fix:**
- **M3**: Antingen (a) öppna feature för båda userType (uppdatera dokumentation + lägg till UI under kund-profil), eller (b) blockera kund i routen med 403. Beslut tas i storyn — fråga Johan om scope.
- **Mi5**: Synkronisera Zod-schemat i `ChangePasswordDialog` med samma regex-regler som routen och registreringen (samma som S62-1 etablerade). Använd shared validator.

**Filer:**
- `src/app/api/auth/change-password/route.ts` — userType-guard om beslut är "endast provider"
- `src/components/profile/ChangePasswordDialog.tsx` — synka lösenordspolicy
- Eventuellt `src/lib/auth/passwordPolicy.ts` (ny) — shared regex för registrering + change-password

**Plus från review:**
- **Mi3**: Migrera change-password till `withApiHandler` istället för manuell try-catch. Kan göras i samma story.

**Acceptanskriterier:**
- [ ] Beslut dokumenterat: provider-only ELLER båda userType
- [ ] Om provider-only: kund som POST:ar `change-password` får 403 + svenskt meddelande
- [ ] UI-validering matchar routen — användaren får inline-fel direkt vid svagt lösenord
- [ ] (Bonus) Använder `withApiHandler`-pattern

---

## Risker

- **S65-2** (fail loud): adderar nytt fel-mode för användare. Behöver tydlig svensk text + kanske retry-knapp i UI så att registrering inte upplevs trasig. UX-koll innan release.
- **S65-3** (kvarstående fire-and-forget): bredare ändring än det ser ut — fyra routes med olika test-täckning. Risk för regression.
- **S65-1** (callback hotfix): Johan måste vänta med att aktivera callback-URL i Supabase tills storyn är mergad. Annars är open redirect tillgänglig i prod.

## Beroenden mellan stories

- S65-2 är fundament för S65-3 (samma fail-mönster). Kör S65-2 först.
- S65-1 är fristående hotfix.
- S65-5, S65-6, S65-7 är fristående change-password-stories — kan göras i valfri ordning.

## Förväntad demo (efter alla 7 stories)

1. Manipulerad Host-header på callback → ingen open redirect (S65-1)
2. Kund-användare loggas in via magic link → landar på kund-yta, inte provider (S65-1)
3. Resend-timeout → användaren får 502 + tydligt svenskt meddelande, inte tyst success (S65-2)
4. 5 reschedule-events i rad → 5 mail i Resend (S65-3)
5. CI-guard fångar STRIPE_WEBHOOK_SECRET som missing (S65-4)
6. Byt lösenord på en enhet → annan enhet tappar session vid nästa anrop (S65-5)
7. Forgot-password-spamming bränner inte change-password-kvot (S65-6)
8. Kund POST:ar change-password → 403 (S65-7)
