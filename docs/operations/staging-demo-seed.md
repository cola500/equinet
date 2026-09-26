---
title: "Säker Staging Demo Seed"
description: "Runbook för att säkert återställa demo-provider-data (Erik Järnfot) på staging via helper-scriptet — med project-ref-guard, dry-run och verifiering."
category: operations
status: active
last_updated: 2026-09-26
sections:
  - Syfte
  - Säkerhetsmodell
  - Normal användning
  - Verifiering efter seed
  - Felsökning
  - Beslutslogg
  - Se även
tags:
  - staging
  - demo
  - seed
  - safety
  - supabase
depends_on:
  - docs/operations/demo-setup.md
  - docs/operations/staging-environment-setup.md
related:
  - docs/operations/demo-setup.md
---

# Säker Staging Demo Seed

Runbook för att återställa leverantördemons data (Erik Järnfot) på **staging** utan att
riskera att råka skriva mot **produktion**. All seedning går via ett helper-script som
validerar målet innan en enda rad skrivs.

> **TL;DR:** `npm run db:seed:staging-demo:safe -- --dry-run` för att torrköra, sedan
> `npm run db:seed:staging-demo:safe` för skarp körning. Du klistrar in staging-databasens
> connection string i en tyst prompt (ekar aldrig). Verifiera efteråt enligt [checklistan](#verifiering-efter-seed).

---

## Syfte

### Varför helper-scriptet finns

Demo-provider-seeden (`scripts/seed-demo-provider.ts`) skapar Erik Järnfot via Supabase
Admin API **och** skriver kunder/hästar/bokningar via Prisma. Den läser `DATABASE_URL`
från miljön. Tre problem gör en rå körning riskabel:

1. **Ingen inbyggd prod-guard (tidigare).** `prisma/seed-guard.ts` (`assertSeedSafe`) var
   bara inkopplad i `prisma/seed.ts` — **inte** i demo-provider-seeden. Pekade `DATABASE_URL`
   fel kunde demon seedas rakt in i prod-DB:n (dokumenterad risk "D" i
   [staging-environment-setup.md](./staging-environment-setup.md)).
2. **`DATABASE_URL` går inte att hämta automatiskt.** Den är markerad *sensitive* i Vercel
   och returneras **tom** av `vercel env pull` (write-only). Den måste matas in manuellt.
3. **Den dokumenterade metoden var osäker.** Tidigare runbook använde `export DATABASE_URL=…`
   i skalet, vilket läcker connection-stringen till shell-history.

Helper-scriptet (`scripts/seed-staging-demo.sh`) löser alla tre: tyst prompt (ingen
history-läcka), project-ref-validering före körning, och ingen connection string skriven
till `.env`-filer eller disk.

### Varför "vanlig" demo-seed är riskabel

`npm run db:seed:demo-provider:reset` kör seeden mot vad `DATABASE_URL` än pekar på, utan
att fråga. Lokalt pekar den på localhost (ofarligt), men om du exporterat eller klistrat in
fel URL kan den träffa prod. Använd därför **alltid** helper-scriptet för staging.

---

## Säkerhetsmodell

### Project-refs

| Miljö | Supabase project ref | Region |
|-------|----------------------|--------|
| **Staging** (tillåten) | `zzdamokfeenencuggjjp` | Frankfurt (eu-central-1) |
| **Produktion** (vägras alltid) | `xybyzflfxnqqyxnvjklv` | Zürich (eu-central-2) |
| **Lokal** | — (`127.0.0.1`) | localhost |

Project-ref extraheras ur connection-stringen (`extractSupabaseProjectRef` i
`prisma/seed-guard.ts`) från tre format: pooler (`postgres.<ref>@…pooler…`), direct
(`@db.<ref>.supabase.co`) och API-URL (`https://<ref>.supabase.co`).

### Guard-beteende (`assertStagingSeedSafe`)

Körs **först i `main()`**, före varje DB-skrivning och Supabase Admin-anrop:

| Mål | Default (`SEED_TARGET` osatt) | `SEED_TARGET=staging` (helpern) |
|-----|-------------------------------|----------------------------------|
| localhost | ✅ tillåts (lokal dev) | ❌ vägras |
| staging-ref `zzdamokfeenencuggjjp` | ✅ tillåts | ✅ tillåts |
| prod-ref `xybyzflfxnqqyxnvjklv` | ❌ vägras (PRODUCTION) | ❌ vägras |
| okänd hostad Supabase | ❌ vägras | ❌ vägras |

Defense-in-depth: helper-scriptet gör **dessutom** en egen bash-nivå-kontroll (vägrar prod,
localhost och icke-staging) **innan** det ens hämtar övrig env eller anropar Node.

### `--dry-run` och `--check-only`

- **`scripts/seed-staging-demo.sh --dry-run`**: kör hela kedjan (prompt → bash-guard →
  `vercel env pull` → TS-guard) men anropar seeden med `--check-only` → **ingen DB-skrivning**.
- **`scripts/seed-demo-provider.ts --check-only`**: kör guarden och avslutar med
  `"Guard OK"` innan första skrivningen. Används av `--dry-run` och kan köras fristående.

---

## Normal användning

Förutsättningar: Vercel CLI inloggad och projektet länkat (`.vercel/project.json` finns).
Du behöver staging-databasens **direct**-URL (port `5432`, host `db.zzdamokfeenencuggjjp.supabase.co`).

### 1. Torrkör (rekommenderat först)

```bash
npm run db:seed:staging-demo:safe -- --dry-run
# eller: bash scripts/seed-staging-demo.sh --dry-run
```

Klistra in staging-`DATABASE_URL` i prompten (ekar inte). Förväntat:

```
✓ URL pekar på staging (zzdamokfeenencuggjjp), host: db.zzdamokfeenencuggjjp.supabase.co
✓ Hämtade Supabase-env för staging (service-role-nyckel: 219 tecken, aldrig utskriven)
Guard OK — target verifierat. (--check-only: ingen seed körd.)
DRY-RUN klar: validering OK, ingen seed körd, ingen DB-skrivning.
```

### 2. Skarp seed

```bash
npm run db:seed:staging-demo:safe
# eller: bash scripts/seed-staging-demo.sh
```

Samma prompt, sedan en `(y/N)`-bekräftelse innan databasen rörs. `--reset` raderar och
återskapar demo-kunder/hästar/bokningar/recensioner/meddelanden. **Erik-kontot och hans
tjänster berörs inte.** Connection-stringen skrivs aldrig till `.env`-filer; temp-filen från
`vercel env pull` städas via `trap`.

> **Interaktiv prompt:** `read -rsp` kräver en riktig terminal. Kör i ett eget terminalfönster
> (eller med `!`-prefix i Claude Code om klienten ger TTY). Klistra **aldrig** in URL:en som
> vanlig text — bara i den tysta prompten.

### 3. Inkludera en inloggningsbar demokund (för kundhemmet `/hem`)

Default-seeden skapar kunderna som **ghost** (ingen login). För att kunna demonstrera
**hästägarens hem** (`/hem`) krävs en inloggningsbar kund. Opt-in-flaggan `--customer-login`
gör **en** kund (Lisa Andersson) inloggningsbar via Supabase Auth (samma säkra mönster som
Erik). Default-beteendet är oförändrat — flaggan måste anges explicit.

```bash
npm run db:seed:staging-demo:customer:safe
# eller: bash scripts/seed-staging-demo.sh --customer-login
```

| Fält | Värde |
|------|-------|
| E-post | `lisa.andersson@gmail.com` |
| Lösenord | `DemoOwner123!` |
| Roll | kund (hästägare) |
| Data | 2 hästar (Molly, Storm), kommande + genomförda bokningar, försenat besök, vårdhistorik |

> Detta är en **demo-uppgift** för staging (ej hemlighet), i nivå med Eriks `DemoProvider123!`.
> Det är **inte** ett nytt kund-demoläge — ingen DemoLoginButton/demo-nav. Provider-demon (Erik)
> påverkas inte. Prod vägras av guarden.

---

## Verifiering efter seed

> **Detta är intern verifiering av seed-datan** — manuell inloggning är OK här (du vill se
> allt: bokningsstatusar, testmeddelanden, etc). Det är **inte** hur demot ska visas för en
> extern mottagare (t.ex. en pilot-leverantör) — då gäller ALLTID knappen "Demo som
> leverantör" i en ren/privat flik, se [demo-setup.md](./demo-setup.md#hur-en-extern-demo-mottagare-ska-öppna-demon).

Logga in på staging som Erik (uppgifter i [demo-setup.md](./demo-setup.md)) och kontrollera:

| Vy | Förväntat |
|----|-----------|
| **Dashboard** | "Kommande bokningar" > 0 (t.ex. 8), "Nya förfrågningar" > 0, intäktsgraf visar data |
| **Kalender** | Veckovyn visar full 7-dagarsgrid med bokningsblock (verifierat 2026-09-26). Banner "X bokningar väntar". |
| **Bokningar** | Mix av status: Väntar / Bekräftade / Genomförda / Avbokade |
| **Meddelanden** | Realistiska konversationer, **inga** test-strängar (t.ex. "3B.2 smoke-test") |
| **Kundhem `/hem`** (om `--customer-login`) | Logga in som Lisa → landar på `/hem`; statusrad (lugnt/larm), hästkort, aktiv Hem-flik |

> **Tom kalender ≠ UI-bugg:** Om veckovyn ser tom ut, kontrollera FÖRST att `Bokningar`-sidan
> verkligen visar >0 bokningar (och att seeden faktiskt slutförde utan fel — se Felsökning
> nedan) innan du misstänker ett renderingsproblem. Den tidigare noterade "veckovyn visar bara
> en dagkolumn"-gotchan gick inte att reproducera 2026-09-26 med korrekt seedad data — misstänkt
> redan åtgärdad eller feldiagnostiserad ursprungligen (troligen samma orsak: 0 bokningar pga
> ofullständig seed, se P2003-posten nedan).

---

## Felsökning

| Symptom | Trolig orsak | Åtgärd |
|---------|--------------|--------|
| **Inga kommande bokningar** på Dashboard/Kalender | Seeden kördes för länge sedan; de relativa bokningarna (`offsetDays: 2..14`, resolverade av `DemoBookingScheduler`) har blivit dåtid | Kör om med `--reset` (helpern gör alltid reset) |
| **Gammal seed-data uppdateras inte** vid omkörning | `upsert` med `update: {}` + skip-logik (`scripts/seed-demo-provider.ts`) hoppar över befintliga rader | Måste köras med `--reset` — vilket helpern gör |
| **Test-/smoke-sträng** ("3B.2 smoke-test") syns i Meddelanden | Manuellt inmatad data i staging-DB (finns ej i seed-koden) | `--reset` raderar demo-kunders konversationer och återskapar rena. Om strängen kommer från ett **icke**-demo-konto: radera den konversationen manuellt i DB |
| **"Demo som hästägare" ger tyst 401 → tillbaka till `/login`** (Supabase-login lyckas, men appen studsar) | Föräldralöst Supabase Auth-konto för Lisa: en tidigare körning med `--customer-login` skapade auth-kontot, men en SENARE `--reset` UTAN `--customer-login` tog bort hennes `public.User`-rad utan att röra auth-kontot. Se beslutslogg 2026-09-26 nedan | Kör om med `npm run db:seed:staging-demo:customer:safe` (MED `--customer-login`) — dess `createCustomerAuth()` upptäcker och läker det föräldralösa kontot automatiskt |
| **Guard-fel: "is PRODUCTION"** | URL:en pekar på prod-ref `xybyzflfxnqqyxnvjklv` | Du har fel connection string. Hämta staging-direct-URL från Supabase Dashboard (projekt `zzdamokfeenencuggjjp`) |
| **Guard-fel: "not the allowed staging project"** | Okänd/fel hostad Supabase-ref | Samma som ovan — verifiera project-ref |
| **Guard-fel: "points to localhost but staging was required"** | Du körde helpern men gav en localhost-URL | Ange staging-URL, inte `127.0.0.1` |
| **"vercel env pull misslyckades"** | CLI ej inloggad eller projekt ej länkat | `vercel login` + `vercel link`, kontrollera `.vercel/project.json` |
| **`NEXT_PUBLIC_SUPABASE_URL`/service-role saknas** | Preview-env saknar variablerna | Verifiera i Vercel UI att Preview-raderna finns för branch `staging` |

> **Fel miljö generellt:** Kör aldrig `npm run db:seed:demo-provider:reset` direkt mot
> staging/prod utan guarden. Använd alltid helpern. Kör `npm run env:status` för att se vilken
> DB som är aktiv lokalt.

---

## Beslutslogg

- **2026-06-01:** Staging-demon visade 0 kommande bokningar — Dashboard och Kalender såg
  tomma ut. Rotorsak: seeden hade körts veckor tidigare, och dess relativa
  `daysFromNow(+2..+14)`-bokningar hade hunnit bli historiska.
- En **`--reset`** krävdes (en vanlig omkörning hoppar över befintliga rader pga idempotent
  `upsert`/skip-logik och uppdaterar därför inte datumen).
- En **guard** byggdes (`assertStagingSeedSafe` + `extractSupabaseProjectRef`) och kopplades
  in i `scripts/seed-demo-provider.ts`, eftersom demo-provider-seeden saknade prod-skydd
  (`assertSeedSafe` fanns men var bara inkopplad i `prisma/seed.ts`). Detta minskar risken att
  råka seeda prod.
- Ett **helper-script** (`scripts/seed-staging-demo.sh` + `npm run db:seed:staging-demo:safe`)
  ersatte den tidigare osäkra `export DATABASE_URL=…`-metoden: tyst prompt, project-ref-koll,
  ingen connection string på disk, `--dry-run`.
- `DATABASE_URL` bekräftades vara *sensitive* i Vercel (kom tillbaka tom från
  `vercel env pull`) → därför den manuella prompten istället för auto-hämtning.
- **2026-09-25 (hovslagar-pivot):** En verklig potentiell användare (hovslagare) ska få se
  staging. Seeden utökades med 6 `HorseNote`-poster (häst-journal) i
  `scripts/seed-demo-provider.ts` för att visa funktionaliteten en hovslagare efterfrågade
  (journalföring per häst) — ingen ny funktionalitet byggdes, `HorseNote`-modellen och alla
  vyer fanns redan men saknade demo-data. Verifierat lokalt: leverantören ser bara
  `veterinary`/`farrier`/`medication`-kategorier på häst-tidslinjen, ägaren ser alla 6. Se
  [demo-setup.md](./demo-setup.md#hästjournal-6-anteckningar). Kör `--reset` mot staging
  igen inför det faktiska demotillfället eftersom bokningsdatumen är relativa
  (`daysFromNow`) och blir historiska efter några veckor (samma gotcha som 2026-06-01 ovan).
- **2026-09-26:** Första skarpa körningen efter hovslagar-pivoten kraschade: `prisma.user.deleteMany()`
  i `resetDemoData()` kastade `P2003` (`Booking_customerId_fkey`) — en bokning kopplad till en
  demo-kunds email men en annan/äldre leverantörs-post (historisk staging-data) blockerade
  kund-raderingen eftersom bokningsrensningen filtrerade på `providerId`. Fix (PR #493): rensa
  ALLA bokningar/serier/kundanteckningar för demo-kunderna oavsett leverantör innan `User`-raden
  tas bort — dessa e-postadresser ägs uteslutande av seed-scriptet. Omkörning efter fix lyckades
  (9 kunder, 14 hästar, 18 bokningar, 6 hästanteckningar). Detta var även orsaken till att
  kalendern såg tom ut i en tidigare verifiering (0 bokningar fanns, inte en renderingsbugg).
- **2026-09-26 (feature-synlighet + PWA-cacheläckage):** Vid manuell verifiering syntes
  buggrapport-knappen och röstloggnings-knappen (`Logga arbete`) trots att de var tänkta att
  vara dolda i demot. Rotorsak: BÅDA gate:as av en cookie (`isDemoSession`) som **bara** sätts
  av knappen "Demo som leverantör/hästägare" — inte av vanlig e-post/lösenord-inloggning, även
  med samma konto. All tidigare manuell verifiering i denna session hade loggat in manuellt,
  vilket exponerade dem. Se [demo-setup.md](./demo-setup.md#hur-en-extern-demo-mottagare-ska-öppna-demon)
  för den nya, obligatoriska instruktionen till externa demo-mottagare.
- **2026-09-26 (bokningar på stängda dagar):** `daysFromNow(N)` i `seed-demo-provider.ts` tog
  ingen hänsyn till leverantörens seedade `Availability` (mån–fre) eller `AvailabilityException`
  — en seed-körning kunde placera en bokning på en lördag/söndag då leverantören är stängd.
  Fix: nytt, testat modul `scripts/lib/demo-booking-scheduler.ts` (`DemoBookingScheduler`) som
  läser leverantörens faktiska öppettider och resolverar varje `offsetDays` till närmaste öppna
  dag + en icke-överlappande tid inom öppettiderna (deterministiskt per seed-körning). Se
  [demo-setup.md](./demo-setup.md#bokningar-20-st) för hur datumlogiken fungerar. Samma
  omkörning avslöjade också att det redan dokumenterade föräldralösa-Supabase-konto-problemet
  (raden ovan om `--customer-login`) kräver att `--reset` och `--customer-login` körs i **samma**
  invokering — en separat `--reset` följt av en separat `--customer-login` kan skapa en
  `public.User`-rad med samma e-post men annat ID än det gamla auth-kontot innan
  `createCustomerAuth()` hinner läka det, vilket gör att inloggningen fortsätter peka på fel
  användare. `npm run db:seed:staging-demo:customer:safe` kör redan båda flaggorna tillsammans
  och påverkas inte av detta.
  Separat, allvarligare fynd under samma utredning: appens PWA-service worker (`src/sw.ts`)
  cachade `auth-session`, `/api/*`-svar och renderade sidor (`pages`/`pages-rsc`) utan att
  rensa dem vid utloggning — en efterföljande användare på samma enhet/webbläsare kunde se
  förra användarens cachade nav-badges, auth-data och API-svar. Fixat (separat commit från
  denna dokumentationsändring): `src/sw-cache-cleanup.ts` + `src/lib/sw-client.ts` rensar nu
  dessa cache-poster dels vid varje `activate` (migrerar bort gamla cacheversioner automatiskt),
  dels on-demand när `Header.tsx`s utloggning kör klart. Verifierat lokalt (webpack-bygge,
  SW aktiverad): fullständig cache-innehåll före/efter inloggning, utloggning och ny
  persona-inloggning utan manuell rensning — inga rester av föregående användares data kvar.
- **2026-09-26 (Lisa/"Demo som hästägare" gav tyst 401 → tillbaka till login):** Efter att
  P2003-fixen (se ovan) lät oss köra **`npm run db:seed:staging-demo:safe` utan
  `--customer-login`**, kunde "Demo som hästägare" inte längre logga in Lisa: Supabase Auth
  accepterade lösenordet (200 på `/auth/v1/token`), men appen studsade tillbaka till `/login`
  och `/api/auth/session` gav `401 {"user":null}` direkt efteråt.
  **Rotorsak:** `--reset` utan `--customer-login` tar bort Lisas `public.User`-rad och
  återskapar henne som en **ghost-kund** (nytt slumpmässigt ID, ingen Supabase Auth-koppling).
  Hennes **gamla Supabase Auth-konto** — skapat av en tidigare körning som använde
  `--customer-login` — rörs INTE av den vanliga varianten och blir därmed föräldralöst: JWT:n
  validerar fint mot Supabase, men `getSession()` i `src/lib/auth-server.ts` slår upp
  `public.User` på samma ID och hittar ingen rad → returnerar `null` → 401 → redirect till
  login. Detta är EN ANNAN föräldralös-auth-situation än den som redan är dokumenterad och
  självläkt i `createCustomerAuth()` (se kodkommentaren i `scripts/seed-demo-provider.ts`) —
  den självläkningen triggas bara när `--customer-login` körs och upptäcker att auth-kontot
  redan finns; den körs aldrig alls om man kör UTAN `--customer-login`, så det föräldralösa
  auth-kontot från en TIDIGARE `--customer-login`-körning blir kvar orört och bruten.
  **Fix:** kör om med `npm run db:seed:staging-demo:customer:safe` (dvs. MED
  `--customer-login`) — dess `createCustomerAuth()` upptäcker att auth-kontot redan finns
  utan matchande `public.User`, tar bort det föräldralösa auth-kontot och återskapar Lisa
  rent. Verifierat: "Demo som hästägare" fungerar efter omkörningen.
  **Regel framåt:** om du planerar att demonstrera kundhemmet (`/hem`) — vilket "Demo som
  hästägare"-knappen alltid gör, den är synlig för alla besökare — kör **alltid**
  `db:seed:staging-demo:customer:safe`, aldrig den vanliga varianten, på staging. Den vanliga
  varianten (`db:seed:staging-demo:safe` utan `--customer-login`) är bara säker att köra ensam
  om ingen tidigare körning någonsin använt `--customer-login` på samma miljö.

---

## Se även

- [demo-setup.md](./demo-setup.md) — inloggningsuppgifter för Erik + vad demo-datan innehåller
- [staging-environment-setup.md](./staging-environment-setup.md) — staging-miljöns env-uppsättning,
  `DATABASE_URL`-delning och Vercel sensitive-vars-fällor
- Kod: `scripts/seed-staging-demo.sh`, `scripts/seed-demo-provider.ts`, `prisma/seed-guard.ts`
