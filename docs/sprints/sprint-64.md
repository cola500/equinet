---
title: "Sprint 64: Auth-leverans och URL-config-uppstädning"
description: "Sju stories från password reset-incidenten 2026-04-30. Säkrar att email-leverans, CSP och URL-config håller i prod."
category: sprint
status: planned
last_updated: 2026-04-30
tags: [sprint, auth, email, csp, env-vars, tech-debt]
sections:
  - Sprint Overview
  - Stories
---

# Sprint 64: Auth-leverans och URL-config-uppstädning

## Sprint Overview

**Mål:** Eliminera de sju brister som upptäcktes under password reset-incidenten 2026-04-30. Tre stories är kritiska för leveranskvalitet (fire-and-forget, CI-guard, env-städning), två fyller saknade auth-features (byt lösenord, callback-route), och två är dokumentation/trivial-fix.

**Källa:** 5 Whys-felsökning 2026-04-30 efter att Johan inte kunde logga in i prod. Felsökningen avslöjade en kedja av sju oberoende fel som maskerade varandra:
1. `APP_URL` saknades i Vercel prod-env (redan fixat)
2. Supabase Site URL/Redirect URLs satta till localhost (redan fixat)
3. Fire-and-forget i `AuthService` dödar Resend-anrop tyst i serverless
4. CSP `connect-src` hade hardkodad gammal Supabase-projekt-URL (hotfixat 2026-04-30, commit 9410dd21)
5. Vercel env-värden hade literal `\n`-suffix
6. Hardkodad fel domän i `data-retention-warning.ts`
7. "Byt lösenord"-funktion + Supabase Auth callback saknas i appen

**Nuläge:** Login fungerar i prod efter dagens hotfixar (APP_URL satt, Supabase URL Configuration uppdaterad, CSP-fix mergad). Men fire-and-forget-buggen påverkar fortfarande tyst leveransen av alla email-notifieringar (bokningsbekräftelser, route-announcements, password reset). De övriga rotorsakerna är dokumenterade i backloggen men kräver implementation.

**DoD:** Alla sju stories done. Inga feature flags i denna sprint (alla är fixar/nya features, inte gating-styrda).

| Story | Beskrivning | Effort | Prioritet |
|-------|-------------|--------|-----------|
| S64-1 | Fixa fire-and-forget i `AuthService` och övriga notifiers | 1-2h | **1 (HÖG)** |
| S64-2 | Städa Vercel env-variabler med literal `\n` (preview + dev) | 15 min | 2 |
| S64-3 | Fixa hardkodad fel domän i `data-retention-warning.ts` | 10 min | 3 |
| S64-4 | CI-guard: kräv kritiska env-variabler i prod-build | 1-2h | 4 |
| S64-5 | "Byt lösenord"-funktion under Inställningar | 0.5 dag | 5 |
| S64-6 | Supabase Auth callback-route för magic link / OAuth | 0.5 dag | 6 |
| S64-7 | URL-konfigurationsmatris i `docs/operations/url-configuration.md` | 30 min | 7 |

**Total effort:** ~2.5 dag.

**Föreslagen ordning:** 1 → 2 → 3 → 4 → 5 → 6 → 7. S64-7 sist eftersom den dokumenterar slutläget av de andra.

**Pre-existing context:** CSP-hotfix landade på main 2026-04-30 (commit `9410dd21`) — Supabase-URL i `connect-src` läses nu från env-variabel istället för hardkodning. Återimplementera INTE detta i någon story.

**Dashboard-beroenden (Dev har inte access — koordinera med Johan):**
- S64-2 kräver att Johan ändrar Vercel UI för preview + development env-variabler. Bygg din kod-del först (om någon), kontakta sedan Johan med exakt instruktion på vad som ska ändras och vänta på bekräftelse innan storyn markeras done.
- S64-6 kräver att `https://equinet-app.vercel.app/auth/callback` läggs till i Supabase Redirect URLs allowlist ([dashboard](https://supabase.com/dashboard/project/xybyzflfxnqqyxnvjklv/auth/url-configuration)). Bygg routen först, be sedan Johan uppdatera dashboarden, verifiera manuellt.

---

## Stories

### S64-1: Fixa fire-and-forget i AuthService och övriga notifiers

**Prioritet:** 1 (HÖG)
**Effort:** 1-2h
**Domän:** webb

**Problem:** `AuthService.requestPasswordReset` (`src/domain/auth/AuthService.ts:396-401`) skickar `emailService.sendPasswordReset(...).catch(() => {})` och returnerar response omedelbart. I Vercel/Fluid Compute kan function-instansen termineras innan fetch-anropet mot Resend slutförs → mail skickas aldrig. Bevis 2026-04-30: tre password reset-försök, mail #1 vann racen mot termination, mail #2 och #3 hann ALDRIG fram till Resend (token i DB, inget i Resend dashboard). **Tyst leveransbortfall i prod.**

**Påverkan:** Drabbar potentiellt alla fire-and-forget-anrop i kodbasen. Andra kandidater: `RouteAnnouncementNotifier`, ev. fler notifiers.

**Fix:** Ersätt `.catch(() => {})` med `await waitUntil(...)` från `@vercel/functions`, eller blockerande `await`. Vercels `waitUntil` håller function-instansen vid liv tills promisen löser sig utan att blockera response.

**Filer:**
- `src/domain/auth/AuthService.ts` — fixa `requestPasswordReset` och eventuellt andra metoder
- `src/domain/notification/RouteAnnouncementNotifier.ts` — audit + fixa
- Alla träffar för `grep -rn "\.catch(() => {})" src/` — audit + fixa kritiska

**Beroenden:** Lägg till `@vercel/functions` om det inte redan finns (`npm install @vercel/functions`).

**Acceptanskriterier:**
- [ ] `AuthService.requestPasswordReset` använder `waitUntil` eller blockerande `await`
- [ ] `RouteAnnouncementNotifier` audit:erad — fire-and-forget bytt till `waitUntil` där relevant
- [ ] **Manuell prod-verifiering** efter deploy: trigga 5 password reset-försök i rad mot prod, verifiera att alla 5 syns i Resend dashboard. Lägg verifieringen som steg i PR-beskrivningen.
- [ ] Test: integration-test verifierar att routen inte returnerar förrän Resend-anropet är klar (eller med `waitUntil`-mock)
- [ ] Audit-kommentar i done-fil: lista alla fire-and-forget i kodbasen och vilka som behåller `.catch()` med motivering

---

### S64-2: Städa Vercel env-variabler med literal `\n` (preview + dev)

**Prioritet:** 2
**Effort:** 15 min
**Domän:** infra

**Problem:** `NEXT_PUBLIC_SUPABASE_URL` och `NEXT_PUBLIC_SUPABASE_ANON_KEY` i Vercel prod hade literal backslash-n (`\n`) på slutet av värdena (städat 2026-04-30 i prod). Preview och development-miljöerna har troligen samma problem. När `vercel env pull` körs lokalt skrivs det som literal `\n` i `.env`-filen vilket bryter direktanrop mot Supabase API från lokala scripts.

**Fix:** Vercel UI → respektive variabel → ta bort `\n`-suffixet → spara → redeploy.

**Steg:**
1. Logga in på Vercel → Project Settings → Environment Variables
2. För `NEXT_PUBLIC_SUPABASE_URL` (preview, development): edit → kontrollera värdet → ta bort eventuellt `\n` på slutet → save
3. Samma för `NEXT_PUBLIC_SUPABASE_ANON_KEY` (preview, development)
4. Verifiera med `vercel env pull --environment=preview` och `vercel env pull --environment=development`

**Acceptanskriterier:**
- [ ] `vercel env pull --environment=preview` ger värden utan trailing `\n`
- [ ] `vercel env pull --environment=development` ger värden utan trailing `\n`
- [ ] Production redan fixad 2026-04-30 — verifiera

---

### S64-3: Fixa hardkodad fel domän i `data-retention-warning.ts`

**Prioritet:** 3
**Effort:** 10 min
**Domän:** webb

**Problem:** `src/lib/email/templates/data-retention-warning.ts:4` har fallback `https://equinet.vercel.app` (utan `-app`) — fungerar inte. Bör använda samma logik som övriga email-templates: `process.env.APP_URL || 'http://localhost:3000'`. Hittad 2026-04-30 vid felsökning av password reset.

**Fix:** Byt fallback-strängen till samma mönster som övriga template-filer:

```ts
const baseUrl = process.env.APP_URL || 'http://localhost:3000'
```

**Filer:**
- `src/lib/email/templates/data-retention-warning.ts:4`

**Acceptanskriterier:**
- [ ] Fallback använder `APP_URL`-pattern
- [ ] Snapshot-test eller motsvarande verifierar att rätt URL används

---

### S64-4: CI-guard: kräv kritiska env-variabler i prod-build

**Prioritet:** 4
**Effort:** 1-2h
**Domän:** infra

**Problem:** `APP_URL` saknades i Vercel prod-env i månader → alla email-länkar pekade på `http://localhost:3000`. Ingen build-time-check hade fångat det. Risken finns att andra kritiska variabler (DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, RESEND_API_KEY, STRIPE_SECRET_KEY) också skulle kunna saknas tyst.

**Fix:** Lägg till build-time-validering som faller om kritiska env-variabler saknas i prod. Förslag: `scripts/check-prod-env.ts` körs i `prebuild` när `VERCEL_ENV=production`.

**Variabler att kräva:**
- `APP_URL`
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Filer:**
- `scripts/check-prod-env.ts` (ny) — TypeScript-skript som listar required vars och faller med tydligt felmeddelande om någon saknas
- `package.json` — lägg till `prebuild`: `"prebuild": "tsx scripts/check-prod-env.ts"` — körs ENBART när `VERCEL_ENV=production`

**Acceptanskriterier:**
- [ ] Skript faller med exit code 1 om någon required variabel saknas i prod-build
- [ ] Skript skippar check i development och preview (eller varnar utan att falla)
- [ ] Test: kör i CI med en variabel borttagen → build failar
- [ ] Felmeddelande listar VILKEN variabel som saknas (lättfelsökt)

---

### S64-5: "Byt lösenord"-funktion under Inställningar

**Prioritet:** 5
**Effort:** 0.5 dag
**Domän:** webb

**Problem:** Inloggade användare kan inte ändra sitt lösenord från profilen/inställningar. Enda vägen idag är "Glömt lösenord"-flödet (som dessutom är trasigt pga fire-and-forget) eller manuellt via Supabase Dashboard. Hittad 2026-04-30 vid felsökning av password reset.

**Fix:** Bygg `/api/auth/change-password`-route som tar gammalt + nytt lösenord, verifierar gammalt mot Supabase Auth, uppdaterar via `auth.admin.updateUserById`. UI under Inställningar/Profil.

**Filer:**
- `src/app/api/auth/change-password/route.ts` (ny) — POST-route
- `src/domain/auth/AuthService.ts` — ny metod `changePassword(userId, oldPassword, newPassword)`
- `src/components/profile/ChangePasswordDialog.tsx` (ny) — UI-komponent
- Profil-/inställningssida — knapp/länk "Byt lösenord"

**Säkerhet:**
- Verifiera gammalt lösenord innan byte (skydd mot session hijacking)
- Rate-limit på `/api/auth/change-password`
- Zod-schema med samma lösenordsregler som registrering

**Acceptanskriterier:**
- [ ] Felaktigt gammalt lösenord ger 401 + svensk felmeddelande
- [ ] Nytt lösenord uppfyller samma regex-regler som registrering
- [ ] BDD dual-loop-test: integration via route + unit på service
- [ ] Mobil-först UI: ResponsiveDialog
- [ ] After-byt: success-toast + automatisk re-login (eller bara stäng dialog)

---

### S64-6: Supabase Auth callback-route för magic link / OAuth

**Prioritet:** 6
**Effort:** 0.5 dag
**Domän:** webb

**Problem:** Magic link och OAuth-callback från Supabase Auth landar bara på root-page utan att session etableras. Vi har egen email/password-flow så det är inte affärskritiskt idag, men blockerar framtida features (social login, magic link login, Supabase egna reset-mail). Hittad 2026-04-30 vid felsökning av password reset (vi försökte använda magic link men det fungerade inte i appen).

**Fix:** Bygg `/auth/callback`-route som anropar `supabase.auth.exchangeCodeForSession(code)` och redirectar till `/dashboard`.

**Filer:**
- `src/app/auth/callback/route.ts` (ny) — GET-route som tar `code`-query-param

**Implementation:**
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

**Acceptanskriterier:**
- [ ] Route exchanges code för session
- [ ] Cookies sätts korrekt (HTTP-only)
- [ ] Vid fel: redirect till /login med error-param
- [ ] Manuellt test: skicka magic link via admin API → klicka → loggas in
- [ ] Lägg till `https://equinet-app.vercel.app/auth/callback` i Supabase Redirect URLs allowlist

---

### S64-7: URL-konfigurationsmatris

**Prioritet:** 7
**Effort:** 30 min
**Domän:** docs

**Problem:** URL-konfiguration är tribal knowledge. Vi har precis brunnit oss på trippel-miss (APP_URL i Vercel + Supabase Site URL + Supabase Redirect URLs alla satta fel) plus en hardkodad CSP-URL i `next.config.ts`. Inget dokumenterar var alla URL-config-platser finns och vad varje styr.

**Fix:** Skapa `docs/operations/url-configuration.md` som listar alla URL-config-platser och vad varje styr.

**Innehåll:**
- **Vercel `APP_URL`** — bas-URL för all email-genererad länk i applikationskoden (`process.env.APP_URL`)
- **Vercel `NEXT_PUBLIC_SUPABASE_URL`** — Supabase REST/auth-endpoint, används i klient-bundle
- **Supabase Site URL** — fallback-redirect-URL efter login om `redirect_to` inte matchar allowlist
- **Supabase Redirect URLs allowlist** — tillåtna `redirect_to`-värden vid magic link/OAuth
- **CSP `connect-src`** i `next.config.ts` — vilka externa domäner browsern får anropa (måste inkludera Supabase). **Detta var rotorsaken till password reset-incidenten 2026-04-30** — hardkodad gammal projekt-URL → browser blockerade alla auth-anrop. Hotfixad i commit `9410dd21` att läsa från `NEXT_PUBLIC_SUPABASE_URL`.
- **Stripe webhook endpoint** — URL Stripe POST:ar webhooks till
- **Resend domän-verifiering** — DKIM/SPF för `FROM_EMAIL`-domänen
- **iOS prod-URL** i `ios/Equinet/AppConfig.swift` — WKWebView start-URL

För varje rad: vad styr den, var ändrar man (Vercel UI / Supabase Dashboard / kod), vilken story brann ifall fel.

**Filer:**
- `docs/operations/url-configuration.md` (ny)
- Länka från CLAUDE.md eller `docs/INDEX.md`

**Acceptanskriterier:**
- [ ] Dokument skapat med matris-tabell
- [ ] Checklista för "byte av prod-domän" inkluderad
- [ ] Frontmatter följer `documentation.md`-standarden
- [ ] Länkad från CLAUDE.md eller INDEX.md

---

## Risker

- **S64-1** (fire-and-forget): Om `waitUntil` inte fungerar som förväntat i Vercel kan vi behöva blockerande `await` istället, vilket adderar ~300ms latency på password reset-routen. Acceptabelt.
- **S64-4** (CI-guard): Risk att skriptet är för aggressivt och blockerar legitima preview-deploys där en variabel medvetet saknas. Lösning: skippa check i preview eller göra den varnande snarare än blockerande där.
- **S64-6** (auth callback): Kräver att `https://equinet-app.vercel.app/auth/callback` läggs till i Supabase Redirect URLs allowlist innan storyn kan testas i prod.

## Beroenden mellan stories

- S64-7 dokumenterar slutläget — kör SIST.
- S64-2 och S64-3 är trivial — kan göras i vilken ordning som helst.
- S64-1, S64-4, S64-5, S64-6 är oberoende av varandra.

## Förväntad demo (efter alla 7 stories)

1. Trigga 5 password reset-mail i rad → alla 5 levereras (S64-1 verifierad)
2. Inloggad användare kan byta lösenord från Inställningar → fungerar (S64-5)
3. Magic link via Supabase admin API → loggas in i appen (S64-6)
4. Försök bygga prod utan `APP_URL` → CI failar med tydligt felmeddelande (S64-4)
5. Visa `docs/operations/url-configuration.md` — komplett matris (S64-7)
