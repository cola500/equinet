---
title: "Enabler Epic: Prod-lik staging med demo per session"
description: "Koppla loss miljösäkerhet från demo-presentation så staging kan köra prod-lik verifiering medan demo aktiveras per session via demo-knapparna"
category: idea
status: active
last_updated: 2026-07-01
tags: [enabler-epic, staging, demo-mode, environment, discovery]
depends_on:
  - docs/operations/staging-environment-setup.md
related:
  - docs/operations/deployment-verification-guide.md
sections:
  - Nuläge
  - Korrigering efter #419/#420
  - Målbild
  - Arkitekturprincip
  - Föreslagna slices
  - Risker
  - Rollback
  - Verifieringsplan
  - Status
---

# Enabler Epic: Prod-lik staging med demo per session

> **Enabler epic** (teknisk möjliggörare), inte produktfeature. Slicas för att
> kunna levereras och verifieras stegvis utan att äventyra stagings säkerhet mot
> omvärlden. Discovery genomförd 2026-06-15 — **ingen implementation ännu.**

## Mål

Staging ska som standard bete sig **prod-likt för vanliga inloggningar**, medan
demo-läge bara aktiveras via demo-knapparna (leverantör/kund). Samtidigt ska
staging fortsatt vara **säker mot omvärlden**: inga riktiga mejl, inga
push-notiser, ingen SEO-indexering och inga destruktiva demo-risker.

## Problem

`NEXT_PUBLIC_DEMO_MODE` blandar idag ihop två helt olika concerns under en enda
flagga:

1. **Miljösäkerhet** — blockera mejl/push, no-op på destruktiv DELETE, `noindex`.
2. **Demo-presentation** — demo-nav, dolda sidor, demo-login-knappar, hjälp-copy.

Eftersom variabeln dessutom är `NEXT_PUBLIC_*` (inlinad vid **build-tid**) blir
*hela* staging-builden globalt demo-läge. Staging kan därför **inte** användas
för prod-lik verifiering: vanliga inloggningar ser demo-UX, inte den verkliga
produkten.

---

## Nuläge

### Styrning
Demo läses på ett ställe: `src/lib/demo-mode.ts` → `isDemoMode()`
(`= process.env.NEXT_PUBLIC_DEMO_MODE === "true"`). Den deprecated wrappern
`isDemoModeWithFlags()` ignorerar sitt argument och anropar bara `isDemoMode()`.
Ingen feature flag, ingen admin-toggle — helt env-styrt.

### Teknisk rotbegränsning
`NEXT_PUBLIC_*` bakas in vid build-tid → en build är antingen "allt-demo" eller
"inget-demo". Per-session-demo är omöjligt med nuvarande mekanism. Staging sätter
`NEXT_PUBLIC_DEMO_MODE=true` för Preview-builden, vilket gör hela miljön demo.

### 27 call-sites — två olika concern
Den enda flaggan styr två saker som borde ha olika livscykel:

**Concern 1 — Miljösäkerhet (4 st, ändrar verkligt utåtriktat beteende):**

| Fil | Vad som händer i demo |
|-----|----------------------|
| `src/lib/email/email-service.ts:46` | Blockerar **alla** mejl (mock-success) |
| `src/domain/notification/PushDeliveryService.ts:36` | Blockerar **alla** push till APNs |
| `src/app/api/native/customers/[customerId]/route.ts:153` | DELETE blir no-op (raderar inte) |
| `src/app/robots.ts:6` | `disallow: /` (ingen SEO-indexering) |

**Concern 2 — Demo-presentation (~23 st, bara UX/synlighet):**
- Nav filtreras till `DEMO_PRIMARY_PATHS` / `DEMO_MORE_PATHS` (`ProviderNav.tsx`)
- **9 provider-sidor `router.replace()` bort** till profil (voice-log, reviews,
  debug, routes, route-planning, announcements, due-for-service, group-bookings,
  export, verification, settings/integrations)
- Demo-login-knappar på `/login` och `/` + dolt "Glömt lösenord"/"Registrera"
- Hjälp-sektion "Demo" visas (`HelpCenter.tsx`), first-use-tooltips släcks
  (`first-use-tooltip.tsx`), self-reschedule av i profil

### Varför detta blockerar målet
Concern 1 (säkerhet) **får inte** hänga på "är detta en demo-session" — på
staging vill man *aldrig* skicka riktiga mejl/push, oavsett om en vanlig
testanvändare eller demo-Lisa är inloggad. Concern 2 (presentation) är däremot
precis det som ska aktiveras *bara* via demo-knapparna.

Att naivt sätta `NEXT_PUBLIC_DEMO_MODE=false` på staging idag skulle släppa loss
riktiga mejl/push, tillåta radering av manuella kunder och göra staging
indexerbart. Säkerheten måste därför kopplas loss **först**.

---

## Korrigering efter #419/#420

> Discoveryns ursprungliga Slice 1-design (PR #419) byggde på ett **felaktigt
> antagande om stagings miljövariabler** och fick backas ut (PR #420). Detta
> avsnitt dokumenterar rotorsaken och den korrigerade signalen. Arkitekturprincip
> och Slice 1 nedan är uppdaterade enligt detta.

### Rotorsak

PR #419 införde `isStagingSafe()` = `process.env.VERCEL_ENV !== "production"` och
pekade de fyra säkerhets-call-sitesen dit. Antagandet var: "staging har
`VERCEL_ENV=preview`, prod har `VERCEL_ENV=production` → uttrycket skiljer dem
åt."

Det stämmer inte. Vercel-projektet `equinet-staging-app` deployar
`staging`-branchen som sitt **production-target**, så Vercel sätter
`VERCEL_ENV="production"` även på staging. Uttrycket blev därför `false` på
staging → "inte safe" → **alla fyra miljöguards stängdes av samtidigt** efter
merge: `robots.txt` flippade från `Disallow: /` till indexerbar, mejl/push gick
ut på riktigt, och native customer-DELETE blev destruktiv. Staging rullades
tillbaka via Vercel instant rollback och #420 reverterade koden (exakt invers,
+42/−170).

### Varför `VERCEL_ENV` inte får användas som staging/prod-signal

- **Signalen kan i princip inte skilja prod från staging.** Prod
  (`equinet-app`) och staging (`equinet-staging-app`) är **separata Vercel-
  projekt**, båda med production-target → **båda rapporterar
  `VERCEL_ENV=production`**. Ingen jämförelse på den variabeln kan separera dem.
- **Befintlig kod dolde felet.** `src/lib/supabase-storage.ts` kollar
  `VERCEL_ENV === "production" || === "preview"` (fångar *båda*), så ingen
  befintlig call-site avslöjade att staging faktiskt rapporterar `"production"`.
  Epiken citerade just den filen som "signalen finns redan" — men den filen är
  immun mot felet; #419 var det inte.
- **Testerna kunde aldrig fånga det.** Lokalt/CI saknar `VERCEL_ENV` → koden
  defaultade till "safe" → testerna blev gröna. "Beteende-neutralt"-beviset
  gällde bara lokalt; buggen var bara observerbar på live staging.

**Regel:** Använd ALDRIG `VERCEL_ENV` (eller `NODE_ENV`) för att skilja staging
från prod i denna kodbas. Se minnesnoteringen
`reference-staging-vercel-env-is-production`.

---

## Målbild

- Vanlig login i staging → prod-lik UX (alla sidor nåbara, registrera/glömt
  lösenord synliga), men omvärlden skyddad.
- Demo-knapp (leverantör/kund) → demo-nav/-flöde/demo-presentation.
- Production → oförändrad; båda signaler säkra/av.

---

## Arkitekturprincip

Dela den ena flaggan i två signaler med olika livscykel:

### `isStagingSafe()` — miljöbaserad (runtime), explicit positiv prod-signal

Drivs av en **explicit positiv produktionssignal** — INTE `VERCEL_ENV` (se
"Korrigering efter #419/#420"):

```ts
isStagingSafe() = process.env.IS_LIVE_PRODUCTION !== "true"
```

- `IS_LIVE_PRODUCTION=true` sätts **enbart** på det riktiga production-projektet
  (`equinet-app`). Runtime-var (INTE `NEXT_PUBLIC_*` — alla fyra call-sites är
  server-side).
- **Saknad env → safe.** Endast ett explicit `"true"` opt-ar in i riktiga
  sidoeffekter.
- **staging / lokalt / test → safe** (ingen `IS_LIVE_PRODUCTION` satt där).
- **Endast live prod med `IS_LIVE_PRODUCTION=true` → inte safe** (riktiga
  mejl/push tillåts, destruktiv DELETE körs, `robots.txt` indexerbar).

Styr de 4 säkerhets-call-sitesen. **Oberoende av demo** — på staging vill man
aldrig skicka riktiga mejl/push oavsett om en vanlig testanvändare eller
demo-Lisa är inloggad. Gör staging prod-likt för upplevelsen men säkert för
omvärlden.

> **Fail-safe-princip:** miljösäkerhet defaultar till skyddad. Den "farliga"
> konfigurationen (riktiga sidoeffekter) kräver en enda explicit opt-in på det
> enda projekt som ska ha den. En misskonfigurerad eller ny miljö är aldrig av
> misstag osäker.

### `isDemoSession()` — sessionsbaserad (runtime per request)
En cookie (t.ex. `equinet-demo=true`) sätts av `DemoLoginButton` vid demo-ingång
och rensas vid logout. Läses server-side via `cookies()` (mönster finns i
`src/lib/supabase/server.ts`) och exponeras till klienten via en
context-provider i `layout.tsx` — samma SSR→context-mönster som
`FeatureFlagProvider` redan använder. Styr all demo-presentation.

> Demo-personerna är redan dedikerade konton (`lisa.andersson`,
> `erik.jarnfot`). Alternativ/komplement: härled `isDemoSession()` från
> konto-attribut i JWT. Cookie är dock enklare eftersom landning/login är
> pre-auth.

---

## Föreslagna slices

Sliceat enligt Major Effort + Simple/Complex — gör det *riskabla men osynliga*
först, så att senare steg blir säkra.

### Slice 1 (MVP, ~½ dag): Koppla loss miljösäkerhet från demo-mode

> **Korrigerad design efter #419/#420.** Samma scope som #419 men med korrekt
> signal (`IS_LIVE_PRODUCTION`, inte `VERCEL_ENV`) och regressionstest som hade
> fångat buggen.

1. **Inför `isStagingSafe()`** i `src/lib/environment.ts`:
   `process.env.IS_LIVE_PRODUCTION !== "true"` (saknad env → safe).
2. **Flytta de 4 säkerhets-call-sitesen** (email-service, PushDeliveryService,
   native customers DELETE, robots) från `isDemoMode()` till `isStagingSafe()`.
   Behåll log-taggar/messageId-prefix/felmeddelanden för identiskt observerbart
   beteende.
3. **Regressionstest för stagings faktiska runtime:** sätt
   `VERCEL_ENV="production"` **utan** `IS_LIVE_PRODUCTION` och assertera
   `isStagingSafe() === true`. Detta är exakt fallet #419 missade — testet hade
   varit rött mot #419:s implementation.
4. **Prod-test:** med `IS_LIVE_PRODUCTION="true"` → `isStagingSafe() === false`.
5. **Local/test-default:** ingen env satt → `isStagingSafe() === true` (safe).

Eftersom `IS_LIVE_PRODUCTION` ännu **inte** är satt någonstans defaultar alla
miljöer (staging, lokalt, prod) till "safe" tills prod-env-sättningen körts som
separat operation (se nedan). Beteendet på staging blir därmed **identiskt** med
idag efter slicen.

- **Värde:** ~60% (tar bort den farliga kopplingen som blockerar allt annat).
- **TDD:** unit-test per call-site att säkerheten följer `isStagingSafe()`, inte
  demo; plus de tre miljötesterna ovan.

> **Separat, explicit verifierad prod-operation:** att sätta
> `IS_LIVE_PRODUCTION=true` på `equinet-app` (production) är **inte** del av
> kod-PR:en. Det görs som egen, explicit operation via Vercel REST API
> (`POST type:"plain"`) och verifieras med
> `vercel env pull --environment=production` — enligt MEMORY-gotchorna om
> fällbenägen Vercel-env-skrivning. Tom flagg-rad tolkas som `false` = safe,
> vilket är ofarligt här. Denna operation måste vara genomförd och verifierad
> innan prod kan skicka riktiga sidoeffekter via den nya signalen.

### Slice 2 (~1 dag): Demo-presentation per session via cookie/context
Cookie + context-provider; byt presentations-call-sites från `isDemoMode()` till
`isDemoSession()`. `DemoLoginButton` sätter cookie, logout rensar.

- **Risk att bevaka:** SSR/hydration-mismatch om klient och server är oense om
  demo-state.

> **Uppdelad i 2a + 2b (PO-beslut 2026-07-01).** Kartläggningen visade att
> Slice 2 buntar en tredje concern: **demo-ENTRÉ** (persona-kort på landning,
> demo-knappar, dölj registrera/glömt på login) är pre-auth/pre-cookie och kan
> INTE gatas på `isDemoSession()` (falskt före login) — den ska gatas på
> `isStagingSafe()`. Presentationen delades därför från entré-affordancen.

#### Slice 2a (KLAR): Demo-session-infra + provider-arbetsyta
Infrastruktur (`isDemoSession()`-cookie + SSR→context, speglar
`FeatureFlagProvider`), `DemoLoginButton` sätter `equinet-demo`-cookien, Header-
logout rensar den. Migrerade provider-arbetsytan (`ProviderNav`, 11
`router.replace`-redirect-sidor, 6 gating-sidor) från `isDemoMode()`/
`isDemoModeWithFlags()` → `useDemoSession()`.

- **Status:** Klar — PR #432, merge `780e89e6`, mergad till `staging`.
- **Staging-verifierat (2026-07-01):** vanlig provider-login (formulär) → full,
  prod-lik arbetsyta (alla sidor nåbara, `equinet-demo` ej satt); demo-knapp →
  demo-session (cookie satt, 4-tabbars demo-nav, `/provider/reviews` redirectar
  till profil); logout rensar cookien; ny vanlig login blir inte demo; refresh
  bevarar state utan hydration-fel. Slice 1-säkerhetsguarden fortsatt grön
  (`robots.txt` = `Disallow: /` live ⇒ `isStagingSafe() === true`, vilket driver
  alla fyra säkerhets-call-sites).

#### Slice 2b (återstår): Auth-front-door + entré-affordance
Login-sida, registrera/glömt-lösenord, `Header`/`BugReportFab`/`DevBanner`, och
omdesign av entré-affordancen till `isStagingSafe()`-gating (demo-knappar syns på
staging men aldrig på prod). Här landar "registrera/glömt synliga för vanlig
login".

### Slice 3 (~30 min): Flippa staging till prod-lik default
Sätt `NEXT_PUBLIC_DEMO_MODE=false` (eller pensionera variabeln) på staging via
Vercel REST API. Demo lever nu enbart via knapparna.

> **Ordningskrav:** Slice 1 MÅSTE vara levererad och verifierad före Slice 3,
> annars läcker säkerheten.

---

## Risker

- **Högst:** flippa demo av på staging *innan* Slice 1 → riktiga mejl/push/
  radering, indexerbar staging. Mitigeras genom att Slice 1 går först.
- **Fel miljösignal (rotorsaken bakom #419/#420):** `VERCEL_ENV` skiljer INTE
  staging från prod (båda = `production`). Mitigeras av explicit positiv
  `IS_LIVE_PRODUCTION`-signal + regressionstest för `VERCEL_ENV=production` utan
  `IS_LIVE_PRODUCTION`.
- **Saknad/tom `IS_LIVE_PRODUCTION` → safe** är avsiktligt fail-safe. Risken är
  inverterad mot #419: om prod-env-sättningen glöms blir prod *för säker*
  (blockerar riktiga mejl/push) — synligt och ofarligt, till skillnad från #419
  som gjorde staging *osäker*.
- **Prod-env-skrivning är fällbenägen** (se MEMORY-gotchor) — sätt
  `IS_LIVE_PRODUCTION=true` via Vercel REST API och verifiera med
  `vercel env pull --environment=production`. Separat operation, inte del av
  kod-PR.
- Build-time→runtime-skifte (Slice 2) kan ge SSR/hydration-mismatch om demo-state
  skiljer mellan server och klient.
- Vercel env-skrivning är fällbenägen (se MEMORY-gotchor) — använd REST API och
  verifiera med `vercel env pull` i Slice 3.

---

## Rollback

- **Slice 1:** ren refaktorering bakom samma observerbara beteende → revert av en
  PR räcker. Inga datamigreringar, ingen env-ändring.
- **Slice 2:** revert av PR; cookien blir oläst och presentation faller tillbaka
  på env-flaggan tills Slice 3 körts.
- **Slice 3:** sätt `NEXT_PUBLIC_DEMO_MODE=true` igen via Vercel REST API
  (`POST` med korrekt typ) + verifiera via `vercel env pull --environment`.

---

## Verifieringsplan

1. **Slice 1, lokalt:** kör testsviten en gång; de 4 säkerhetstesterna gröna,
   regressionstestet (`VERCEL_ENV=production` utan `IS_LIVE_PRODUCTION` → safe)
   grönt, prod-testet (`IS_LIVE_PRODUCTION=true` → inte safe) grönt, inga
   befintliga demo-tester regredierar. `npm run check:all` 4/4.
2. **Slice 1, staging (efter merge):** verifiera **explicit** att `robots.txt`
   fortsatt är `Disallow: /` (det var detta som flippade i #419), inga mejl/push
   går ut, native-delete fortsatt no-op — dvs. exakt som idag. Detta steg
   hoppades reellt över vid #419 och måste göras denna gång.
3. **Prod-env-operation (separat, före riktiga sidoeffekter via ny signal):**
   sätt `IS_LIVE_PRODUCTION=true` på `equinet-app` via Vercel REST API, verifiera
   med `vercel env pull --environment=production`. Bekräfta att prod fortsatt
   skickar riktiga mejl/push (signalen aktiv).
4. **Slice 3, staging:** vanlig login → prod-lik UX (alla provider-sidor nåbara,
   registrera/glömt-lösenord synliga); demo-knapp → demo-nav; verifiera att
   mejl/push *fortfarande* blockeras trots demo=av.

> Demo-UX kan bara verifieras på staging (efter merge) eller via lokal
> demo-server — se `docs/operations/deployment-verification-guide.md`.

---

## Status

**Discovery klar 2026-06-15.** Slice 1 (PR #419) mergades till staging och fick
backas ut (PR #420) — rotorsak: `VERCEL_ENV` skiljer inte staging från prod. Se
"Korrigering efter #419/#420".

**Status 2026-06-22:** Slice 1-designen korrigerad (PO-beslut: explicit positiv
`IS_LIVE_PRODUCTION`-signal). Ingen ny implementation, inga env-ändringar, ingen
merge/deploy genomförd. Nästa steg: PO-godkännande att starta om Slice 1 enligt
korrigerad design ovan.

**Status 2026-07-01:**
- **Slice 1 KLAR** — korrigerad `IS_LIVE_PRODUCTION`-design implementerad och
  mergad till `staging` (PR #428). Alla 4 säkerhets-call-sites använder
  `isStagingSafe()`; regressionstestet (`VERCEL_ENV=production` utan
  `IS_LIVE_PRODUCTION` → safe) grönt.
- **Slice 2 uppdelad i 2a + 2b** (PO-beslut) — se Slice-sektionen.
- **Slice 2a KLAR** — PR #432, merge `780e89e6`, mergad till `staging` och
  verifierad live på `equinet-staging.johanlindengard.com`: vanlig provider-login
  ger full/prod-lik arbetsyta, demo-knapp ger demo-session, logout/refresh
  verifierat, Slice 1-säkerhetsguarden fortsatt grön (`robots.txt = Disallow: /`).
- **Prod oförändrad.** Ingen env-ändring gjord (`IS_LIVE_PRODUCTION` ännu inte
  satt på prod; `NEXT_PUBLIC_DEMO_MODE` oförändrad på staging).
- **Nästa steg:** Slice 2b (auth-front-door + entré-affordance), därefter Slice 3
  (flippa `NEXT_PUBLIC_DEMO_MODE=false` på staging). Ingen av dessa påbörjad.
