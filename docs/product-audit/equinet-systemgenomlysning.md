---
title: "Equinet — Systemgenomlysning ur produkt- och leveransperspektiv"
description: "Bedömning av hur redo systemet är att skapa värde, förändras säkert och tas vidare. Identifierar glapp mellan byggt och användbart system."
category: research
status: draft
last_updated: 2026-04-29
sections:
  - Sammanfattning
  - Systemförståelse
  - Kärnflöden
  - Mognadsbedömning
  - Förändringsbarhet
  - Säkerhet och risk
  - Driftbarhet
  - Testbarhet
  - Produktluckor
  - Risker
  - Första slice
  - Now Next Later
  - Frågor
---

# Equinet — Systemgenomlysning

> Bedömning per 2026-04-29. Fokus: produkt- och leveransperspektiv, inte kodgranskning.
> Källor: README, status.md (sprint 63), product-audit-paket, demo-go-no-go, executive-summary, kodinventering.

---

## 1. Sammanfattning

**Equinet är ett tekniskt moget system utan en enda verklig användare.**

Plattformen har på sex månader (1 900+ commits, 63 sprintar) byggt en bred bokningsprodukt för hästtjänster med 169 API-routes, 4 380 tester, RLS, MFA, offline-PWA, iOS-hybridapp och 17 feature flags. Den interna kvalitetsapparaten (hooks, reviewer-subagenter, retros) är ovanligt välutvecklad för en pre-launch-produkt.

Det som **saknas** är inte fler features. Det är **en första riktig leverantör som använder produkten en vecka**. Allt annat — Stripe, Apple Developer, ruttoptimering, gruppbokningar, smart replies — är investeringar i ett antagande som ännu inte är validerat.

Det centrala glappet:

- **Byggt:** ~47 features, demo-bar walkthrough, omfattande testsvit.
- **Användbart för verklig kund:** Leverantörsflödet (login → kalender → bokning → kund) är demo-bart med seed-data, men ingen verklig hovslagare har skrivit in sina riktiga 200 kunder.
- **Värdeskapande på riktigt:** 0 transaktioner, 0 ARR, 0 användarintervjuer efter pivot.

**Rekommendation:** Stoppa feature-arbete. Spendera nästa 1–2 sprintar på att rekrytera och onboarda *en* hovslagare till självvärd produktanvändning. Allt annat går snabbare därefter.

---

## 2. Systemförståelse

**Vad systemet gör:**
Bokningsplattform som kopplar hästägare till ambulerande specialister (hovslagare, veterinärer, massörer, tandläkare). Differentierar sig från Bokadirekt/Calendly genom rutt-tänk: leverantören kör mellan kunder, inte tvärtom.

**Problem som löses:**

- För leverantören: hantera 200–400 kunder utan kalkylblad eller pappersjournal; optimera kördagen; samla recensioner; signalera lediga rutter.
- För kunden: hitta verifierad specialist i närheten; boka utan telefon; se sin hästs historik och delade journal.

**Användare i kod:**

- **Leverantör** (hovslagare, veterinär, m.fl.) — primär persona, mest komplett verktygslåda.
- **Kund** (hästägare) — sekundär persona, enklare upplevelse.
- **Admin** (plattformsägare/Johan) — moderation, feature flags, statistik.
- **Stallägare** — flagga av (`stable_profiles=false`), inte i scope.

**Primärt värdeflöde (avsett):**
Leverantör skapar profil → publicerar tjänster och tider → kund hittar och bokar → båda får påminnelse → besök genomförs → recension lämnas → relation upprepas via återkommande bokningar.

**Primärt värdeflöde (verkligt):**
Existerar inte. Inga riktiga transaktioner. Demo-flödet är seedat hos Erik Järnfot (fiktiv hovslagare i Örebro) och kan visas på 5–10 minuter.

---

## 3. Kärnflöden

För varje flöde: **klart**, **stub/mock**, **saknas för end-to-end**.

### Flöde A — Leverantörens vardag (PRIMÄR)

`Login → Dashboard → Bokningslista → Bekräfta → Slutför → Recension`

- **Klart:** Auth, dashboard med KPI:er, bokningar med statusövergångar, manuell bokning, kundregister, hästkoppling, recensioner, kalender, tjänster, smart replies.
- **Stub/mock:** Insights är AI-rubricerad men oklart om faktisk AI körs eller om det är heuristik. Stripe-flagga AV.
- **Saknas för verklig användning:** Riktig leverantör har aldrig importerat sina 200 kunder. Inga importverktyg (CSV, Fortnox-pull) i scope. Onboarding-friktion = manuellt CRUD × 200.

### Flöde B — Kund hittar och bokar

`/providers → välj leverantör → välj tjänst → boka → vänta på bekräftelse → påminnelse → recension`

- **Klart:** Leverantörsprofil, bokningsformulär (mobil-först), pending-status, omboking, avbokning.
- **Stub/mock:** Geocoding-sök kräver Mapbox-token (osäkert om aktiv i prod). Stripe-betalning är mock-provider.
- **Saknas för end-to-end:** Hur hittar en verklig kund Equinet idag? Det finns ingen distributionskanal. SEO-närvaro okänd. Leverantörens egen marknadsföring antas driva trafik.

### Flöde C — Ruttoptimering (DIFFERENTIATOR)

`Skapa ruttannons → välj stopp → publicera → kund bokar via annons`

- **Klart:** Datamodell, UI, notifiering vid ruttändring (S57).
- **Stub/mock:** Mapbox + OSRM krävs för kart- och optimering. Demo undviker detta flöde.
- **Saknas för end-to-end:** Verifierad token-konfig i prod. Ingen leverantör har testat att publicera en riktig rutt. Värde-hypotesen ("kunder bokar mer när de ser att leverantören kör förbi") är otestad.

### Flöde D — Återkommande bokningar (NÖKEL FÖR LOJALITET)

`Skapa serie → automatisk schemaläggning → kund får påminnelse → ny bokning → upprepa`

- **Klart:** BookingSeries-modell, atomisk skapande/avbryt (S61), GA sedan 2026-04-25.
- **Saknas:** Erfarenhet av om hovslagare faktiskt vill ha en 6-månaders-fram-serie i kalendern, eller om de hellre påminns när det är dags. Detta är en designhypotes, inte en validerad feature.

### Flöde E — Meddelanden mellan kund och leverantör

`Bokning → öppna tråd → skriv → polling 10s → push`

- **Klart:** MVP, bilagor, smart replies med ETA-mallar (S35-S63).
- **Saknas för end-to-end:** Inget pre-booking-meddelande (Slice 5, deferred). Verklig användning okänd — gör hovslagare av med SMS för detta?

### Flöde F — Betalning

`Slutförd bokning → betala → kvitto`

- **Klart:** PaymentGateway-abstraktion, Stripe webhook-idempotens, kvitto-HTML.
- **Stub/mock:** Defaultar till `provider='mock'`. Stripe väntar på företagsverifiering.
- **Saknas:** Värdet av plattformen MED betalning (avgift, fakturering) vs UTAN (bara bokning) är inte resonerat. Vad tar vi 5 % på och varför skulle leverantören acceptera det?

---

## 4. Mognadsbedömning

| Område | Bedömning | Kort motivering |
|--------|-----------|-----------------|
| **Backend** | **Hög (80 %)** | DDD-Light, repository pattern, 169 routes, RLS, rate limiting. Stabilt. |
| **Frontend (webb)** | **Medel-hög (70 %)** | Mobil-först, shadcn/ui, många flöden klara. Tomma states osäkra utan seed-data. |
| **iOS-app** | **Medel (55 %)** | Hybrid med native vyer för dashboard, bokning, kund, tjänst, profil. Resten är WebView. Inte distribuerad (saknar Apple Developer). |
| **Integrationer** | **Låg-medel (40 %)** | Stripe-kod klar men avstängd. Mapbox/OSRM osäker prod-konfig. Fortnox är abstraktion utan aktivering. APNs ej konfigurerad. SMTP osäker. |
| **Autentisering** | **Hög (85 %)** | Supabase Auth, RLS-bevistester, MFA för admin, dual-auth (cookie+JWT). |
| **Deployment** | **Medel (60 %)** | Vercel + Supabase fungerar tekniskt. Kommersiellt bruk kräver Pro ($20/mån, ej köpt). Staging-URL finns. |
| **Testbarhet** | **Hög (80 %)** | 4 380 unit/integration + 22 E2E + 312 iOS XCTest. Coverage 70 %. |
| **End-to-end-funktionalitet** | **Låg (25 %)** | Demo-flödet fungerar med seed-data hos en fiktiv leverantör. Verklig användning ej validerad i något flöde. |

**Den centrala obalansen:** Backend och tester är produktionsmogna. End-to-end-värdeflödet är inte ens i en första pilot.

---

## 5. Förändringsbarhet

**Strukturen är tydlig.** DDD-Light + repository pattern + maskinläsbar review-matris + kodkarta = ny utvecklare (eller ny AI-session) hittar rätt fil snabbt.

**Mönster är dokumenterade:**

- `.claude/rules/code-map.md` mappar domän → filer.
- `docs/architecture/patterns.md` listar återanvändbara mönster.
- 17+ regelfiler laddas selektivt vid behov.
- Fire-and-forget notifier, kanonisk distance-modul, transaktionellt upload-mönster, magic bytes-validering.

**Att lägga till en ny feature kostar:**

- Liten/CRUD: ~0.5–1 dag (TDD + check:all + 1 review).
- Ny domän med repository: ~2–4 dagar (kopierar Review-mönstret).
- Ny integration: oförutsägbart (väntar typiskt på extern config).

**Riskzoner där ändringar är farliga:**

1. **`prisma/schema.prisma`** — varje fält-tillägg kräver audit av ALLA `select`-block (6 i `PrismaBookingRepository`). Det glöms ofta.
2. **`src/lib/auth-*` + `middleware.ts`** — RLS-policies är OR; en felaktig WHERE läcker data till andra providers. Säkerhetskritiskt.
3. **Feature flags ON som default** — flera halvfärdiga (`route_planning`, `customer_insights`, `offline_mode`) är ON men inte verifierade i prod. Användare kan navigera in i okänt territorium.
4. **`src/sw.ts`** (Service Worker) — måste exkluderas från BÅDA tsconfig-filerna, gotcha #29.
5. **iOS native ↔ WebView-bridge** — bridge-protokollet är kontrakt mellan två kodbaser. Ändras enkelt på webben utan att iOS uppdateras.

**Process som skyddar:**

- 6 git-hooks blockerar fel branch, skippade reviews, sprintar utan retro.
- Reviewer-subagenter med skepsis-prompt (djävulens-advokat).
- Pre-commit `check:swedish` förhindrar förlust av å/ä/ö.

**Slutsats:** Strukturen är hälsosam och AI-agent-vänlig. Den största förändringsbarhets-risken är inte koden — den är **att man bygger mer innan man vet vad som faktiskt används**. 47 features → 100 features ökar underhållsyta linjärt och validitet noll.

---

## 6. Säkerhet och risk

**Risk att råka påverka prod:**

- **Vercel + Supabase är skilda från lokal dev** via separata projekt och `.env`-filer.
- **`.env.local` trumfar `.env`** — välkänd gotcha. Vercel CLI kan oavsiktligt skriva prod-credentials lokalt.
- **`db:reset` utan check** raderar lokal databas. Inte prod, men irriterande.
- **Migrationer:** måste appliceras innan deploy. Misslyckade migrationer (rad i `_prisma_migrations` med `finished_at: null`) blockerar nya. `npm run migrate:status` finns men måste köras manuellt.

**Config och secrets:**

- `.env.example` med dummy-värden, riktiga secrets i Vercel + Supabase admin.
- Ingen `.env.production` checkad in (kontroll: `git ls-files | grep env` skulle bekräfta).
- Supabase service role-nyckel server-only (korrekt).
- CRON_SECRET används för Vercel Cron-verifiering.

**Auth-bypass, mocks, genvägar:**

- `ALLOW_TEST_ENDPOINTS`-env-variabel skyddar test-endpoints (NODE_ENV opålitlig på Vercel — explicit env är rätt mönster).
- `DemoLoginButton` på `/login` aktiveras av `NEXT_PUBLIC_DEMO_MODE=true` — säker så länge demo-flaggan är AV i prod.
- Mock payment provider är default — bör vara opt-in i prod.

**Farligt att köra lokalt:**

- Ingenting allvarligt om miljöerna är riktigt separerade.
- Risken är **att råka peka mot remote Supabase** via `.env.local`. Lös genom att alltid köra `npm run env:status` först.

**Säkerhet på papper:** RLS, MFA admin, AdminAuditLog, magic bytes, IDOR-skydd. Solid.
**Säkerhet i praktiken:** Ej pentestat *efter* senaste 30 sprintarna. Senaste pentest 2026-02-15. Mycket har ändrats sedan dess (messaging med bilagor, customer_invite, group_bookings, smart_replies).

---

## 7. Driftbarhet

**Lokalt:**

```bash
npm install
cp .env.example .env
npm run db:up         # Supabase CLI
npm run setup         # migrationer + Prisma generate
npm run db:seed       # eller db:seed:demo-provider för demo
npm run dev
```

Detta är dokumenterat och fungerar (verifierat i README). Kräver Docker Desktop (för Supabase CLI), Node 20+, och ~10 min första gången.

**Miljöer:**

- **Lokal:** Supabase CLI på port 54321/54322.
- **Staging:** `equinet-staging.vercel.app` finns (S48), separat Supabase-projekt.
- **Produktion:** `equinet.vercel.app` (Vercel Hobby — kommersiell användning kräver Pro).

**Health checks och logging:**

- Sentry för fel-monitoring (konfigurerad).
- `npm run env:status` + `npm run migrate:status` ger snabb operations-status.
- Strukturerad loggning via `logger`/`clientLogger`. Console.* förbjudet.
- **Saknas:** Riktig log aggregation (Axiom/Logtail) — markerat som "vid lansering" i backloggen.
- **Saknas:** Synthetic monitoring eller uptime-checks.
- **Saknas:** Rate-limit alerting → Sentry (i backloggen).

**Vad som bryts utan extern config:**

- Mapbox-sök → tom lista eller crash.
- Stripe → mock-provider, "mock"-text i UI.
- Email → registrering möjlig, verifiering bryts (workaround: manuellt `emailVerified: true`).
- APNs → push tystas, men app fungerar.
- Upstash Redis → rate limiting fail-closed → 503 på alla API-anrop. **Detta är driftkritiskt.**

---

## 8. Testbarhet

**Tester finns i mängder:**

- 4 380 Vitest unit/integration-tester.
- 22 E2E-specs (slimmad sedan testpyramid-omfördelning S43-S44).
- 312 iOS XCTest.
- 70 % coverage, 90 %+ på API-routes.

**Går de att köra:**

```bash
npm run test:run                  # Vitest, ~30 s
npm run test:e2e:smoke            # ~2 min
npm run test:e2e:offline          # bygger prod, ~5 min
xcodebuild test ...               # iOS, ~3 min
npm run check:all                 # alla gates, ~50 s
```

Allt fungerar. CI replikerar samma gates.

**Testar de rätt saker:**

- **Ja:** API-route-säkerhet, IDOR-skydd, RLS-policies (24 bevistester), Stripe webhook-idempotens, magic bytes-validering, bokningsstatusövergångar.
- **Delvis:** UI-flöden (E2E täcker 22 specs av ~47 features). Många rena CRUD-flöden saknar E2E.
- **Nej:** Verkligt användarbeteende. *Hur* leverantören hanterar sin kalender när hen får 5 nya bokningar samtidigt = otestat.

**Testdata:**

- `prisma/seed.ts` (generisk testdata).
- `scripts/seed-demo-provider.ts` (Erik Järnfot — realistisk demo).
- E2E-specifik seed via `cleanupSpecData(tag)` + `E2E-spec:<specTag>`-marker.
- Idempotent: kan köras flera gånger.

**Glapp i testbarhet:**

- **MessagingDialog öppnar inte i headless Playwright** (S50-fynd, ~30 min att felsöka).
- **iOS WebView SecureTextField blockerar XCUITest-login** (Apple-säkerhetsbegränsning, behöver bypass).
- Inga snapshot-tester för iOS native-vyer.
- Inga visuella regressionstester (Chromatic, Percy).

---

## 9. Produktluckor — viktigaste delen

**Detta är illusion of done:**

| Vad som ser klart ut | Vad som faktiskt saknas |
|-----------------------|--------------------------|
| 47 features i kod | Ingen verklig leverantör har använt någon i en arbetsvecka |
| 4 380 tester, 70 % coverage | Tester verifierar att koden gör det den ska — inte att den gör det användaren behöver |
| 17 feature flags ON som default | Flera (route_planning, customer_insights, offline_mode) är ej validerade i prod |
| iOS-app med native vyer | Ej i App Store, ej installerbar utan Xcode-bygge |
| Stripe-integration komplett | Ej aktiverad — Stripe-företagsverifiering pågår |
| Demo-flöde "klart" (4/5–5/5 i go-no-go) | Demo-flödet är *seed-baserat*, ej en verklig kund som beskriver sin verksamhet |
| Affärsinsikter med grafer | Bygger på demo-data; ingen verklig leverantör har sett insikter på sina riktiga 200 kunder |
| 51+ sprintar och retros | Process-mognad utan validerad produkt-marknadspassning |

**Vad är närmast verkligt användbart:**

Leverantörsflödet (login → dashboard → kalender → bokning → kund) är tekniskt redo att tas i bruk. Det som skiljer det från användbart är inte mer kod — det är:

1. **En verklig leverantör som vill testa.**
2. **Bulkimport av kunder och hästar.** En hovslagare har 200–400 kunder; manuell CRUD × 400 är dödfödd onboarding.
3. **Verifierad email-leverans.** Utan SMTP fungerar inte registrering eller inbjudningar.
4. **Verifierad Mapbox eller alternativ för adress/sökning.**
5. **En enda real-world support-kanal** (chatt, telefon, mail) — vart vänder sig leverantören vid problem?

**Vad saknas för "någon ska kunna använda systemet på riktigt":**

- **Onboarding för existerande verksamhet.** CSV-import eller manuell registrering med "vi gör det åt dig"-touch.
- **Telefon-fallback eller chat-stöd.** AI har byggt produkten; en människa måste hjälpa första kunden.
- **Tydligt värdeerbjudande.** Varför skulle en hovslagare som kör Excel byta? Tids-besparing, missad bokning-prevention, ökad kund-livstid? Hypotesen är inte testad.
- **Marknadsföringskanal.** Hur når Equinet de första 10 leverantörerna? Inget i koden eller dokumenten adresserar detta.

**Den största produktrisken är inte teknisk. Den är att fortsätta bygga utan att veta vad som faktiskt används.**

---

## 10. Risker

### Kritiska (stoppar användning)

| # | Risk | Konsekvens | Närmaste mitigering |
|---|------|------------|---------------------|
| K1 | **Ingen verklig användare** har validerat någon hypotes | Allt arbete är gissningar. 50 sprintar fortsätter med samma osäkerhet. | Rekrytera 1 hovslagare till 1 veckas test. Allt annat kan vänta. |
| K2 | **Vercel Hobby tillåter inte kommersiellt bruk** | Tekniskt blockerar lansering. | $20/mån + 5 min config. |
| K3 | **Apple Developer ej köpt ($99/år)** | iOS-app kan inte distribueras. | Köp eller medvetet skjut iOS framåt. |
| K4 | **SMTP-leverans inte verifierad i prod** | Registrering, inbjudan, lösenordsåterställning bryts. | 30 min Resend-test. |
| K5 | **Mapbox-konfig osäker i prod** | Centralt kund-flöde (hitta leverantör) bryts. | 30 min token-verifiering. |
| K6 | **Pentest 60 sprintar gammal** | Säkerhetshärdning sedan dess är otestad mot riktig angripare. | Ny ZAP-körning eller Hackerone-bug-bounty före ARR-exponering. |

### Medel (skalar dåligt / skapar problem senare)

| # | Risk | Konsekvens |
|---|------|------------|
| M1 | **17 feature flags, varav flera ON som default men ej validerade** | Användare navigerar in i okänt territorium. Försvårar felsökning. |
| M2 | **In-memory cache på Vercel** (provider-cache, customer-insights) | Cache-missar, sämre prestanda. Inte krasch-grad. |
| M3 | **Ingen log aggregation** | Sentry fångar fel; strukturerad sökning på normaltrafik saknas. |
| M4 | **Ingen real-world bulk-import för kunder/hästar** | Onboarding tar oacceptabelt lång tid för en hovslagare med 200 kunder. |
| M5 | **Stor API-yta (169 routes) för icke-utvecklare att underhålla** | Refactor-kostnad växer. Reviewer-subagenter mitigerar men löser inte. |
| M6 | **iOS hybrid-bridge är kontrakt mellan kodbaser** | Webb-ändring kan tysta iOS native-funktion utan att tester fångar. |
| M7 | **`ignoreBuildErrors: true` i next.config.ts** | Trasig kod kan deployas. Mitigerat av `npm run typecheck` i pre-push, men inte CI-blocker. |
| M8 | **MessagingDialog öppnar inte i headless** + **iOS SecureTextField blockerar XCUITest** | Begränsar E2E-täckning. Real-world-användning okänd. |

### Låg (kan vänta)

| # | Risk | Konsekvens |
|---|------|------------|
| L1 | E2E-svit har 22 specs av 47 features | Vissa flöden täcks bara av unit. |
| L2 | Inga visuella regressionstester | Risk för UI-drift. |
| L3 | Demo-mode synonym-mappning (`SERVICE_CATEGORY_TERMS`) som workaround | Bör bli `category` på `Service`-modellen, men fungerar. |
| L4 | Stora svenska tecken-checks | Blocking pre-commit, men irriterar bara. |
| L5 | Process-infrastruktur kan ha överbyggts (Johans egen oro: "Bygg inte process om processen") | Minimera nya regler tills observerad utlösare. |

---

## 11. Första slice — minimal end-to-end som skapar verkligt värde

> **Som riktig hovslagare i Mellansverige kan jag ge Equinet mina 5 viktigaste kunder, ta in en bokning per vecka i 4 veckor via plattformen, och vid slutet säga om Equinet sparade mer tid än det kostade i administration.**

### Varför denna slice

- **Verklig användare, inte demo-leverantör.**
- **5 kunder, inte 200** — eliminerar onboarding-bulkimport som blockerare.
- **4 veckor, inte 1 dag** — fångar återkommande mönster (bokning, påminnelse, slutförande, recension, omboking).
- **Tids-besparing-mätning** — gör hypotesen falsifierbar. "Det var inte värt det" är ett OK svar — det är information.
- **Demonstrerbar för nästa pilot** — efter 4 veckor finns en verklig case study, inte bara en demo med Erik Järnfot.

### Vad som behöver fungera

| Steg | Status idag |
|------|-------------|
| Leverantör skapar konto | Klart |
| Leverantör skapar profil + tjänster + tider | Klart |
| Leverantör registrerar 5 kunder + hästar manuellt | Klart men ointuitivt vid 5+ |
| Kund kallas via inbjudan (eller leverantör lägger som "ghost") | Klart (S62) |
| Bokning skapas (manuellt eller av kund) | Klart |
| Påminnelse 24h före | Klart **om SMTP fungerar** |
| Bokning genomförs och markeras klar | Klart |
| Recension begärs | Klart (S56) |
| Återkommande bokning skapas | Klart (S61) |
| Leverantören ser veckostatistik | Klart |

### Vad som måste förberedas

1. **Verifiera SMTP** (Resend) — utan det går påminnelser inte fram.
2. **Verifiera Mapbox-token** — för leverantörens adressregistrering.
3. **Vercel Pro** — kommersiellt bruk.
4. **Tona ner halvfärdiga features** för piloten — `route_planning`, `route_announcements`, `group_bookings`, `customer_insights` kan vara AV under första piloten för att minska supportyta.
5. **En människa (Johan) tillgänglig för support i 4 veckor** — dagligen.

### Pris att betala

~5 dagars förberedelse + 4 veckors pilot + 1–2 dagars retro. Ingen ny feature.

---

## 12. Now / Next / Later

### Now (1–3 steg, ~1–2 sprintar)

1. **Hitta första pilot-leverantören.** Konkret: 3 kalla samtal till hovslagare via Hästföretagarna eller Facebook-grupp. Inget kodarbete.
2. **Verifiera SMTP-leverans (Resend) i prod.** 30 min test + 1 verifierings-mail.
3. **Verifiera Mapbox-token i prod + sanitychecka leverantörssök.** 30 min.
4. **Köp Vercel Pro.** 5 min.
5. **Stäng halvfärdiga feature flags inför pilot:** `route_planning`, `route_announcements`, `group_bookings`, `customer_insights`, `offline_mode`. Sätt explicit FALSE under pilot.
6. **Skapa minimal pilot-runbook:** vad gör Johan när leverantören ringer kl 19 på fredag?

### Next (2–4 veckor)

7. **Genomför pilot 1** med en riktig leverantör. Mät: tid sparad/spenderad, missade bokningar, NPS-fråga var fredag.
8. **Veckovis check-in-intervju** — 15 min med leverantören. Inte feature-önskemål — beteende-observation.
9. **Skriv pilot-retro** efter 4 veckor: vad användes, vad användes inte, vad skulle få leverantören att fortsätta betala.
10. **Re-pentest** efter pilot, före expansion till pilot 2.

### Later (efter pilot 1)

11. **Bulkimport** för kunder/hästar (CSV + Fortnox-pull) — om pilot 1 säger "skulle ha gått snabbare med import".
12. **Stripe aktivering + betalningsflöde** — om pilot 1 ber om det.
13. **iOS App Store-distribution** — om pilot 1 jobbar mest mobilt.
14. **Pilot 2 med andra typer av leverantör** (veterinär, massör) — bredda persona-validering.
15. **Skala onboarding-process** — playbook, support, prissättning.
16. **Avveckla half-on feature flags** — antingen GA eller bort.
17. **iOS native-rebuild** (om hybrid-bridge visar sig vara värt smärtan).

---

## 13. Frågor som måste besvaras

### Affär

1. **Vem betalar och hur mycket?** Tar Equinet en procent på transaktionsvärde, månadsavgift av leverantör, eller båda? Vilken hypotes ska piloten validera?
2. **Vad är värde-erbjudandet i en mening?** "Bokningssystem för hovslagare" räcker inte — det finns Excel.
3. **Vilken leverantörs-typ är primärsegmentet?** Hovslagare har störst frekvens. Veterinärer har högst betalningsvilja. Massörer är ad hoc. Vem byggs först för?
4. **Hur når första 10 leverantörerna Equinet?** Det finns ingen marknadsföringsplan i koden eller docs.

### Användning

5. **Vad ersätter Equinet idag för en hovslagare?** Excel? Telefon-anteckningar? Bokio? Calendly? Beroende på svaret är produkt-positioneringen olika.
6. **Vad är "framgång" i en pilot?** Tid sparad, missade bokningar, kund-NPS, leverantör-NPS, omsättning?
7. **Vill leverantörer faktiskt ha rutt-optimering?** Hypotesen är central men otestad. Kanske räcker "kalender-vy som visar geografi".
8. **Använder kunder appen, eller bara leverantörens länk-i-SMS?** Påverkar om iOS-app är prio.

### Integrationer

9. **Behöver pilot 1 verkligen Stripe?** Eller räcker manuell fakturering?
10. **Behöver pilot 1 ruttplanering?** Eller är det "nice to have"?
11. **Behöver pilot 1 iOS-app?** Eller fungerar mobil webb?

### Ansvar

12. **Vem är support kl 19 fredag?** Johan? AI-agent? Inget?
13. **Vem äger tid-spendering vs tid-sparande-mätningen?**
14. **Vem ansvarar för GDPR vid riktig användardata?** (Audit nu, eller efter 100 användare?)
15. **När släpper Johan rollen som "process-arkitekt" och blir "produktägare"?** Två olika jobb. Pivot 2026-04-22 antyder insikten finns; backloggen reflekterar inte den ännu.

---

## Kompass-anmärkning

Den viktigaste observationen är inte i koden eller arkitekturen. Den finns i Johans egen feedback-memory: *"Bygg inte process om processen. Sluta lägga till process-infrastruktur; varje nytt tillägg kräver konkret observerad utlösare."*

Samma princip bör gälla produkten: bygg inte ny feature utan konkret observerad utlösare från en verklig användare.

Equinet har bevisat något ovanligt — att en icke-utvecklare med AI-agenter kan bygga ett produktionsmoget system. Nästa bevis är svårare och viktigare: att samma person kan stå emot frestelsen att fortsätta bygga, och istället hitta första kunden.

---

*Senast uppdaterad: 2026-04-29 | Baserad på sprint 63 (klar 2026-04-26), 1 900+ commits, 6 månaders utveckling.*
