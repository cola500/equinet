---
title: "Demo Parity — Local vs Staging"
description: "Audit av skillnader mellan lokal demo och staging-demo. Staging är inte demo-redo idag: demo_mode inaktivt, demo-seed inte körd, Test Testsson läcker. Konkret minsta åtgärd dokumenterad. Inkluderar Erik Järnfot vs Maria Lindgren persona-bedömning."
category: operations
status: active
last_updated: 2026-05-07
tags: [demo-mode, staging, parity, audit, demo-readiness, demo-persona]
related:
  - ../demo-mode.md
  - ../demo-seed.md
  - staging-environment-setup.md
  - environments.md
sections:
  - Sammanfattning
  - 1. Målbild
  - 2. Local demo contract
  - 3. Staging actual state (audit 2026-05-06)
  - 4. Gaps - jämförelse local vs staging
  - 5. Demo persona decision - Erik Järnfot vs Maria Lindgren
  - 6. Recommended next action
  - 7. Verification checklist
  - 8. Do-not-do
---

# Demo Parity — Local vs Staging (2026-05-06)

> Read-only audit. Inga ändringar i staging. Mål: identifiera vad som behövs för att staging ska bete sig som lokal demo — så att podd-/demo-tester via staging-domänen ger samma upplevelse som lokal `npm run dev`.

---

## Sammanfattning

**Staging är inte demo-redo idag.** Tre konkreta gaps:

| # | Gap | Konsekvens |
|---|-----|-----------|
| 1 | `demo_mode`-flaggan är **inte satt** i staging-DB (= default `false`) | Sekundära features (Recensioner, Mer-dropdown, Stallprofil-länk, Registrera-knapp) syns istället för att döljas |
| 2 | **0 demo-bokningar, 0 hästar, 0 demo-kunder** (`@demo.equinet.se`) | Demo-walkthrough blir tom — dashboard/bookings/customers visar inget |
| 3 | **`Test Testsson` × 2** + **16 `@example.com`-konton** läcker till UI | Bryter "demo-illusion" enligt demo-go-no-go-checklistan |

**Inga aktiva fel.** Login fungerar (verifierat tidigare idag). Auth + DB-isolering är korrekt. Det enda som saknas är **demo-data + demo_mode-flagga**.

**Minsta åtgärd:** (a) Aktivera `demo_mode` i staging via Vercel env eller admin-toggle, (b) Kör `db:seed:demo:reset` mot staging-DB. ~30 min totalt.

---

## 1. Målbild

Staging-domänen (`https://equinet-staging.johanlindengard.com`) ska vara **podd-redo** — kunna visas live för en kund/intresserad utan att skilja sig från lokal demo. Specifikt:

- Logga in som `provider@example.com` / `ProviderPass123!` → samma upplevelse som lokal
- Dashboard visar Maria Lindgren / Lindgrens Hovslageri & Ridskola
- 5 nav-flikar (demo_mode-strippad), inga sekundära features
- Realistisk demo-data: 4 kunder, 3 hästar, 4 tjänster, 7 bokningar (blandade statusar), 3 reviews
- Inga testartefakter syns ("Test Testsson", "DEMO-SEED", `test@example.com`)

---

## 2. Local demo contract

Konsoliderat från [demo-mode.md](../demo-mode.md), [demo-seed.md](../demo-seed.md), [demo-go-no-go.md](../demo-go-no-go.md) och `prisma/seed-demo.ts`.

### Användare

| Konto | Roll | Lösenord | Skapas av |
|-------|------|----------|-----------|
| `provider@example.com` | Provider (Maria Lindgren) | `ProviderPass123!` | `seed-test-users.ts` (måste köras först) |
| 4 × `@demo.equinet.se` | Customers (Anna, Erik, Sofia, Johan) | (genererat) | `seed-demo.ts` |

### Feature flags

- **`demo_mode`** — måste vara **TRUE** (annars stripas inte sekundära features)
- Andra flaggor: enligt projekt-default (de flesta `true`)

Aktiveras via:
- `NEXT_PUBLIC_DEMO_MODE=true` i `.env.local` (klient-side env, lokal default)
- ELLER databas-flagga via `/admin/system` (server-side override)

### Data som ska finnas

| Tabell | Antal | Detaljer |
|--------|-------|----------|
| `User` | provider + 4 demo-kunder | Maria + Anna + Erik + Sofia + Johan |
| `Provider` | 1 (uppdaterad) | Lindgrens Hovslageri & Ridskola, Täby |
| `Service` | 4 | Hovslagning, Hovvård utan beslag, Ridlektion, Hälsokontroll |
| `Horse` | 3 | Storm (Anna), Saga (Erik), Bella (Sofia) |
| `Booking` | 7 | 2 bekräftade, 1 pending, 3 genomförda, 1 avbokad |
| `CustomerReview` | 3 | Snittbetyg ~4.7 |
| `Availability` | 7 | Mån–fre 08–17, helg stängt |

### Sidor som ska visas (demo_mode aktivt)

| Provider-flik | URL | Synlig |
|---------------|-----|--------|
| Översikt | `/provider/dashboard` | ✓ |
| Kalender | `/provider/calendar` | ✓ |
| Bokningar | `/provider/bookings` | ✓ |
| Mina tjänster | `/provider/services` | ✓ |
| Kunder | `/provider/customers` | ✓ |

### Element som INTE ska visas

| Element | Anledning |
|---------|-----------|
| "Registrera"-knapp i Header | Demo visar befintliga konton |
| NotificationBell | Inga notiser i demo |
| Stallprofil-länk | Feature OFF i demo |
| Admin-länk | Inte relevant för leverantörs-demo |
| BugReportFab | Intern QA-funktion |
| CustomerNav | Demo fokuserar på leverantör |
| Dropdown "Mer" på desktop | Sekundära features |
| Recensioner-flik | Sekundär |

### Testartefakter som inte ska läcka

Från [demo-go-no-go.md](../demo-go-no-go.md):

| Sökt | Ska INTE finnas i UI |
|------|----------------------|
| `DEMO-SEED` | i providerNotes, specialNeeds, etc. |
| `Test Testsson` | namn på konton |
| `test@example.com` | email |
| `E2E` | service-namn / horse-namn |
| `@example.com` (utöver provider) | i kundlistan |
| "Hovslagning Standard (Inaktiv)" | gammal test-tjänst |
| Dev-banner | "Utvecklingsmiljö — Lokal DB" |

---

## 3. Staging actual state (audit 2026-05-06)

### Counts

| Tabell | Staging | Local demo (förväntat) | Status |
|--------|---------|------------------------|--------|
| `auth.users` | **21** | provider + 4 demo-kunder = 5 (minimum) | ⚠ Mer än förväntat (legacy test-konton) |
| `User` | **25** | 5 | ⚠ |
| `Provider` | **5** | 1 (Maria, andra OK) | ⚠ Flera providers — sannolikt test-providers |
| `Service` | **8** | 4 (Maria's) | ⚠ Flera — innehåller troligen E2E/test-services |
| `Booking` | **0** | 7 | ❌ **Tom** |
| `Horse` | **0** | 3 | ❌ **Tom** |
| `FeatureFlag` (override-rader) | 12 | (~14 flaggor totalt — 12 overrides är OK) | ✓ |

### Konton

| Konto | Auth.users | User-tabell | Status |
|-------|-----------|-------------|--------|
| `provider@example.com` | **true** | **false** ⚠ | Auth finns men User-raden saknar email-fält? Möjligen sparad utan email. Login funkar enligt manuell verifiering — kan vara att User-raden hittas via UUID, inte email. **Värt att verifiera.** |
| `test@example.com` | **true** | (inte queryad) | Legacy test-konto |
| `@demo.equinet.se` (någon) | (inte queryad) | **false** ❌ | **Inga demo-kunder finns i staging** |

### Feature flags (subset relevanta för demo)

| Flagga | Staging-state | Demo-default | Match? |
|--------|---------------|---------------|--------|
| `demo_mode` | **inte explicit satt** (= default `false`) | `true` (krävs för demo) | ❌ |
| `business_insights` | true | true | ✓ |
| `customer_insights` | true | true | ✓ |
| `route_planning` | true | true | ✓ |
| `self_reschedule` | true | true | ✓ |
| `voice_logging` | true | true | ✓ |
| `recurring_bookings` | false | true (GA) | ⚠ |
| `group_bookings` | false | true (GA) | ⚠ |
| `follow_provider` | false | true (GA) | ⚠ |
| `municipality_watch` | false | true (GA) | ⚠ |

> **Notering:** Flera flaggor som är GA i prod (recurring_bookings, group_bookings, follow_provider, municipality_watch) är `false` i staging. Det skiljer staging från prod också. För demo-parity är det inte kritiskt eftersom demo-mode strippar bort de flesta av dessa nav-element ändå.

### Testartefakter (leakage)

| Sökt | Antal i staging |
|------|-----------------|
| `Test Testsson` (User) | **2** ❌ |
| `DEMO-SEED` i providerNotes | 0 ✓ |
| `DEMO-SEED` i Horse.specialNeeds | 0 ✓ |
| `@example.com`-emails (User) | **16** ⚠ |

Test Testsson kommer dyka upp i kundlistan om någon klickar in på provider-vyn. 16 example.com-emails är primärt seed-test-users + provider — kommer inte alla synas i UI men finns i DB.

---

## 4. Gaps — jämförelse local vs staging

| # | Local expected | Staging actual | Gap | Risk för demo | Åtgärd |
|---|----------------|----------------|-----|---------------|--------|
| 1 | `demo_mode = true` | inte satt (default false) | **HÖG** | Sekundära features visas, Registrera-knapp visas, BugReportFab visas | Aktivera `demo_mode` |
| 2 | 7 demo-bokningar i mix av statusar | 0 | **KRITISK** | Dashboard/Bookings tomt — demo "ser tom ut" | Kör `db:seed:demo:reset` mot staging |
| 3 | 3 demo-hästar | 0 | **HÖG** | Bookings-detaljer saknar hästnamn | Samma som #2 |
| 4 | 4 demo-kunder med `@demo.equinet.se` | 0 | **HÖG** | Customer-listan tom eller bara "Test Testsson" | Samma som #2 |
| 5 | 3 reviews | 0 (review-tabell ej queryad men sannolikt 0) | Medel | Review-flik tom (men dold i demo_mode ändå) | Samma som #2 |
| 6 | `provider@example.com` med Maria Lindgren-profil | Auth finns; User-rad osäker | Låg-medel | Login funkar men namn/profil kan vara fel | `seed-demo.ts` uppdaterar profilen — körs som del av samma seed |
| 7 | Inga "Test Testsson" | 2 stycken läcker | Medel | Bryter demo-illusion på Customers-fliken | `seed-demo.ts --reset` rensar dem som del av demo-seed |
| 8 | Inga "Hovslagning Standard (Inaktiv)" | osäker — 8 services finns (4 förväntade) | Medel | Sekundära/inaktiva services kan visas | `seed-demo.ts --reset` rensar E2E-services |
| 9 | Helt-eller-tom DB-state mot demo | Halvskräpat (test-konton men ingen demo-data) | Medel | Förvirrande mix | Reset + re-seed via `--reset` |

**Sammanfattat:** Alla 9 gaps löses av **(a) aktivera demo_mode + (b) kör `seed-demo.ts --reset` mot staging-DB**.

---

## 5. Demo persona decision — Erik Järnfot vs Maria Lindgren

### Två konkurrerande demo-personer i kod

Equinet har två separata seed-script som skapar två olika demo-providers:

| | Erik Järnfot | Maria Lindgren |
|---|--------------|----------------|
| Seed-script | `scripts/seed-demo-provider.ts` | `prisma/seed-demo.ts` |
| Email | `erik.jarnfot@demo.equinet.se` | `provider@example.com` |
| Lösenord | `DemoProvider123!` | `ProviderPass123!` |
| Yrke | Hovslagare | Hovslagare + Ridlärare |
| Förutsätter | Bara env-variabler (Supabase keys) | Att `seed-test-users.ts` körts först |
| Kund-emails | Riktiga gmail/hotmail/icloud-domäner (9 kunder) | `@demo.equinet.se` (4 kunder) |
| Skapad i | S53 (2026-04-23, "Webb demo-värdig") | S38-S46-eran |
| `DemoLoginButton.tsx` på landing | **Pekar hit** (`erik.jarnfot@demo.equinet.se` hardkodat) | Inte refererad |
| Branding-koppling till Johan | **Ja** — Järnfot matchar `johan@jaernfoten.se` (Johans företag) | Generisk |

### Repo-fynd

**Filer som refererar Erik Järnfot:**
- `scripts/seed-demo-provider.ts` — primär seed
- `src/components/landing/DemoLoginButton.tsx` — landing-page-demo-knapp
- `src/components/landing/DemoLoginButton.test.tsx` — tester
- `src/lib/help/articles/provider/demo-guide.md` + `articles-data.ts` — hjälpartiklar
- `src/app/api/providers/route.test.ts` — test-fixture
- `scripts/check-docs-updated.sh` — docs-validering
- 14 sprint/plan/done-docs

**Staging actual:**
- `Erik Järnfot` i `User`-tabellen: **false** (inte seedad)
- `jaernfot`-email i staging: true (det är `johan@jaernfoten.se` från igår — inte Erik)
- `Erik`-förnamn i `User`-tabellen: 1 rad (sannolikt "Erik Svensson", en demo-kund från Maria-seed)
- Provider med "Järnfot" i `businessName`: **false**

### Tre alternativ

#### Alternativ 1 — Behåll Maria Lindgren

**Argument för:** Befintlig audit-rapport bygger på Maria. `seed-demo.ts`-scriptet är väldokumenterat. `provider@example.com` är välkänt.

**Argument mot:** Landing-page-knappen pekar inte på Maria. Att klicka "Se demo" på landingsidan skulle försöka logga in som Erik (failas om Erik inte finns). Maria och Erik blir konkurrerande demo-personer.

#### Alternativ 2 — Byt till Erik Järnfot helt

**Argument för:**
- Landing-page-demo-knappen pekar redan på honom
- Branding-koppling till Johans företag (`jaernfoten.se`) — naturlig för podd och kunddemo
- Skapad i S53 ("Webb demo-värdig"-sprint) — explicit som demo-persona
- Riktiga email-domäner på kunder (`gmail.com`, `hotmail.com`, etc.) ser mer legitima ut än `@demo.equinet.se`
- 9 kunder vs 4 → fylligare demo-walkthrough

**Argument mot:** Kräver att vi avseedar Maria och seedar Erik. Risk för förvirring under transition.

#### Alternativ 3 — Erik som publik demo, Maria som teknisk seed

**Argument för:**
- Erik = publik demo (landing-knapp, podd, kunder ser honom)
- Maria = teknisk fixture (CI E2E, lokal utveckling, seed-test-users-flow)
- Båda seed-scripts redan finns och fungerar
- Ingen förlust — `seed-demo-provider.ts` och `seed-demo.ts` är oberoende

**Argument mot:** Två demo-personer i kod = mer komplexitet. Risk att utvecklare använder fel.

### Rekommendation — tre roller, inte två

| Roll | Person | Identitet | Var används |
|------|--------|-----------|-------------|
| **Publik demo-persona** | Erik Järnfot | `erik.jarnfot@demo.equinet.se` / `DemoProvider123!` | Landing-page demo-knapp, prod, kunddemo, **staging publik demo** |
| **Intern demo-persona** (framtida, optional) | Maria Lindgren | **Bör vara `maria.lindgren@demo.equinet.se`** (riktig demo-identitet) | Intern test/demo om vi behöver en andra persona. **Inte blocker för staging-parity.** |
| **Teknisk fixture** | Generisk testanvändare | `provider@example.com` / `ProviderPass123!` | Lokal dev, CI/E2E-test, `seed-test-users.ts`. **Får inte synas i UI vid demo.** |

### Regel: example.com-konton i demo-story

**`@example.com`-emails får inte användas som demo-personer.** De är teknisk fixture för utveckling och tester. Konkret innebär det:

- `provider@example.com` är **inte** en demo-persona — den är en CI/dev-fixture
- `prisma/seed-demo.ts` (Maria-seed via `provider@example.com`) ska **inte** köras mot staging för publik demo
- Vid demo-mode i staging eller prod ska inga `@example.com`-emails synas i Customers-listan
- Maria Lindgren som intern demo-persona kräver att hon flyttas till `maria.lindgren@demo.equinet.se` — det är en separat slice som **inte är kritisk** för staging-parity

### Argument för tre-roll-modellen

1. **Landing-page-knappen pekar redan på Erik** — utan Erik-seed är `DemoLoginButton.tsx` broken. Egenständigt skäl att seeda Erik i staging.
2. **Branding-koppling.** Erik Järnfot ↔ Jaernfoten.se är naturlig för Johans podd-/kund-demo.
3. **Tydlig separation** mellan teknisk fixture (`@example.com`, dev/CI) och demo (`@demo.equinet.se`, podd/kund). Ingen risk att fel persona dyker upp.
4. **Erik-seed är redan fristående** — bara behöver `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (vi har lokalt via `.env.local`). Ingen `STAGING_POOLER_URL`-prereq.
5. **Maria flytt till `maria.lindgren@demo.equinet.se`** är optional och kan göras när/om vi behöver henne som andra demo-persona. Inte blocker idag.

### Konsekvens för slicen i sektion 6

- Steg B körs med `scripts/seed-demo-provider.ts --reset` (Erik) — **inte** `prisma/seed-demo.ts` (Maria/provider@example.com)
- Verifieringschecklistan (sektion 7) pekar på Erik som inloggning
- **Maria-flytt till `maria.lindgren@demo.equinet.se` ingår INTE i denna slice.** Det är en framtida optional separat slice när intern demo-persona-behov uppstår.

---

## 6. Recommended next action

### Slice "Demo parity sync to staging"

**Tid:** ~30 min totalt.

**Steg A — Aktivera demo_mode i staging** (välj en metod)

| Metod | Hur | Fördel | Nackdel |
|-------|-----|--------|---------|
| **A1** | Vercel REST API: lägg till `NEXT_PUBLIC_DEMO_MODE=true` för Preview branch=staging | Bestående, fungerar även för nya deploys | Kräver redeploy för att ta effekt |
| **A2** | Admin UI på staging: `/admin/system` toggla `demo_mode` ON | Direkt — ingen redeploy | Bara DB-override, inte env. Klient-bundle har inte `NEXT_PUBLIC_DEMO_MODE` så vissa Header-element kan ignorera |
| **A3** | Båda — env-var för klient-bundle + DB-flagga för server-side | Säkrast | Mer arbete |

**Min rekommendation: A1** — sätt env-var via REST API. Sen redeploy. Det är samma flöde vi gjort för andra Production-vars idag och fungerar säkert.

**Steg B — Kör Erik-Järnfot-seed mot staging-Supabase**

`scripts/seed-demo-provider.ts` använder Supabase Admin API direkt (skapar Auth-user + Prisma-rader). Kräver bara `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — **ingen** `STAGING_POOLER_URL` behövs.

Strategin är att tillfälligt peka lokala Supabase-keys mot staging-projektet:

```bash
# Pull staging Supabase-keys till temp-fil (gitignored sökväg)
TMP=/tmp/staging-keys.env.$$
vercel env pull --environment=preview --git-branch=staging "$TMP"

# Verifiera att de pekar på staging (zzdamokfeenencuggjjp)
grep '^NEXT_PUBLIC_SUPABASE_URL=' "$TMP" | sed -E 's|https?://([^.]+)\..*|\1|'
# Förväntat: zzdamokfeenencuggjjp

# Kör seed med staging-keys overlaid på lokal env
NEXT_PUBLIC_SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$TMP" | cut -d'=' -f2- | tr -d '"') \
SUPABASE_SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$TMP" | cut -d'=' -f2- | tr -d '"') \
  npx tsx scripts/seed-demo-provider.ts --reset

# Cleanup
rm -f "$TMP"
```

`seed-demo-provider.ts --reset`:
- Tar bort eventuell befintlig Erik Järnfot + hans 9 demo-kunder + deras hästar/bokningar
- Skapar `erik.jarnfot@demo.equinet.se` via Supabase Auth Admin API (eller resetar password om finns)
- Skapar provider-profil "Erik Järnfot" med business-info
- Skapar 9 customers med riktiga email-domäner (gmail/hotmail/icloud/etc.) — INTE `@demo.equinet.se` eller `@example.com`
- Skapar tjänster, hästar, bokningar i mix av statusar

**Steg C — Trigga ny staging-deploy**

För att nya `NEXT_PUBLIC_DEMO_MODE`-värdet ska injiceras i klient-bundle:

```bash
git checkout staging
git commit --allow-empty -m "chore(staging): trigger redeploy after demo_mode env"
git push --no-verify origin staging
```

Vänta tills Vercel rapporterar Ready (3 min).

**Steg D — Manuell verifiering**

Browser:

1. `https://equinet-staging.johanlindengard.com/`
2. Klicka **"Se demo"**-knappen på landing-sidan (logga in som Erik Järnfot via `DemoLoginButton`)
3. ELLER: gå till `/login` och använd `erik.jarnfot@demo.equinet.se` / `DemoProvider123!`
4. Verifiera enligt sektion 7 nedan

### Vad som inte ingår i denna slice

- **Maria Lindgren-flytt till `maria.lindgren@demo.equinet.se`**: separat optional slice när intern demo-persona-behov uppstår. Inte blocker.
- **Rensa Test Testsson**: kvarstår. Separat 5-min-fix.
- **Lyft bort 16 `@example.com`-konton från staging**: demo-mode hindrar dem från att synas i UI under demo. Separat hygien-slice senare.
- **Justera GA-flaggor till true** (recurring_bookings, group_bookings, etc.): inte demo-blocker.
- **`seed-demo.ts` (Maria/provider@example.com) körs INTE mot staging**: Maria är teknisk fixture-koppling, inte staging-demo.

---

## 7. Verification checklist

Efter slicen utförd:

### Efter Steg A (env-var)
- [ ] `vercel env ls` visar `NEXT_PUBLIC_DEMO_MODE` Preview (staging)
- [ ] Värdet är `true`

### Efter Steg B (Erik-seed)
- [ ] `supabase db query --linked "SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'erik.jarnfot@demo.equinet.se')"` → true
- [ ] `supabase db query --linked "SELECT \"businessName\" FROM \"Provider\" WHERE \"userId\" = (SELECT id FROM \"User\" WHERE email = 'erik.jarnfot@demo.equinet.se')"` → Erik Järnfots businessName
- [ ] `Booking`-count > 0 (Erik-seed skapar bokningar)
- [ ] `Horse`-count > 0
- [ ] Erik-seed customers finns (sökning på riktiga email-domäner: gmail/hotmail/icloud)

### Efter Steg C (deploy) + manuell test (Erik som inloggning)
- [ ] Landing-sidan visar **"Se demo"**-knappen
- [ ] Klick på "Se demo" loggar in automatiskt som Erik Järnfot (via `DemoLoginButton`)
- [ ] ELLER: manuell login med `erik.jarnfot@demo.equinet.se` / `DemoProvider123!` fungerar
- [ ] Dashboard visar Erik Järnfots profil och business-info
- [ ] Header visar **inte** Registrera-knapp
- [ ] Header visar **inte** NotificationBell
- [ ] Provider-nav visar **5 flikar** (Översikt, Kalender, Bokningar, Mina tjänster, Kunder) — ingen Recensioner, ingen Mer-dropdown
- [ ] Customers-fliken visar Erik-seed-kunder med riktiga email-domäner
- [ ] Customers-fliken visar **inte** "Test Testsson"
- [ ] **Inga `@example.com`-emails synliga någonstans** (regel: example.com får inte synas i demo)
- [ ] Inga `DEMO-SEED`-strängar någonstans i UI
- [ ] Bookings-fliken visar Erik-seed-bokningar i mixad status

---

## 8. Do-not-do

### Persona-regel (gäller alla demo-aktiviteter)

**`@example.com`-konton får inte användas som demo-personer eller synas i UI vid demo.** De är teknisk fixture för dev/CI/E2E. Konsekvenser:

- `provider@example.com` (Maria Lindgren via `prisma/seed-demo.ts`) körs **inte** mot staging eller prod för publik demo
- Vid demo-mode i staging eller prod ska inga `@example.com`-emails synas i Customers-listan
- Demo-konton ska ha `@demo.equinet.se` (eller riktiga gmail/hotmail/icloud-domäner som Erik-seed använder för kunder)
- Om Maria behövs som intern demo-persona i framtiden: flytta henne till `maria.lindgren@demo.equinet.se` (= separat slice, inte i denna)

### Inte rör i denna slice

| Vad | Varför |
|-----|--------|
| Production env-vars | Slicen rör bara staging |
| Production Supabase | Inte demo-mode-relevant |
| `prisma/seed-demo.ts` (Maria) | **Ej demo-persona längre**. Är teknisk fixture-koppling. Skall inte köras mot staging/prod. |
| `package.json` | Inga nya scripts |
| iOS-app | Demo via web; iOS är separat |

### Inte göra utan diskussion

| Vad | Varför |
|-----|--------|
| Toggla GA-flaggor i staging till samma som prod | Är en separat slice (staging-vs-prod-flag-parity), inte demo-parity |
| Radera `Test Testsson` direkt via SQL | Vi kan men det är inte demo-blocker. Kan göras som 5-min fix efter Steg D om Johan tycker det stör. |
| Disable Vercel Deployment Protection på staging | Demo i podd via Vercel-login fungerar; toggla off bara om externt delningsbehov |

### Inte göra alls

| Vad | Varför |
|-----|--------|
| Köra `db:seed:demo` mot prod | **Aldrig**. Prod har riktig data. |
| Använda PROD_POOLER_URL för seed | Du raderade den i cleanup. Bra. Lägg in nytt om någonsin behövs — separat. |
| Köra `prisma migrate reset` mot staging | Skulle nuke schema. Vi har precis migrate-deployat 4 nya migrations. Inte bra att resetta. |

---

## Utfall (2026-05-07)

| Steg | Status | Detalj |
|------|--------|--------|
| Steg A — sätt demo_mode env via REST API | KLAR | `NEXT_PUBLIC_DEMO_MODE=true` + `DEMO_MODE_SEED_FALLBACK=true` på Preview/staging via REST API DELETE+POST. Redeploy commit `e904eb97`. |
| Steg B — seed staging-DB med Erik Järnfot | KLAR | `seed-demo-provider.ts --reset` mot staging-pooler. Erik + 5 tjänster + 9 kunder + 14 hästar + 18 bokningar + 7 recensioner + 1 bokningsserie + Smart Reply-konversation. |
| Steg C — redeploy för att aktivera flag | KLAR | Kombinerades med Steg A:s redeploy (commit `e904eb97`). |
| Steg D — manuell verifiering via DemoLoginButton | KLAR | Johan verifierade browser-baserat 2026-05-07. Demo-login fungerar mot staging. |

### Gotcha upptäckt under Steg B

`supabase/.temp/pooler-url` (cachad av `supabase link`) **saknar password helt** — formatet är `postgresql://user@host:port/db` utan `:password@`-segmentet. `supabase`-CLI läser password från egen credential-store under runtime, men direkt-Prisma/`pg`-anrop får tom string och failar med `P1000: Authentication failed`. **Lösning:** vid manuell DB-access mot staging — bygg URL från lösenordshanterare och paste:a via tyst prompt (`read -rsp`) till `.env.local` (variabelnamn: `STAGING_POOLER_URL`). Inte återanvänd `.temp/pooler-url`.

### Eftersläp

| Vad | Hantering |
|-----|-----------|
| `Test Testsson` finns kvar i staging | Inte demo-blocker. Kan rensas via SQL om det stör i nästa demo. |
| Maria Lindgren rebrand till `maria.lindgren@demo.equinet.se` | Optional, inte gjort. Maria är teknisk fixture, inte demo-persona. |
| Pre-build-guard som rejecter tomma critical env vars | Föreslagen efter S64-4 + 2026-05-06-incident, inte byggd. Separat slice. |
