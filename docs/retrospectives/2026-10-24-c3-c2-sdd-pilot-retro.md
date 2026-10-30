---
title: "Retro — C3/C2-slicen och piloten med specifikationsdriven utveckling"
description: "Retro för första vertikala slicen styrd av affärsregler och scenarier (BR-BOOK-001, BR-PAY-001) och för själva arbetssättet med specifikationer, implementationskontrakt och oberoende granskning."
category: retro
status: draft
last_updated: 2026-10-30
tags: [retro, specification, sdd, booking, payment, agents, codex]
related:
  - docs/specifications/README.md
  - docs/specifications/business-rules/booking-payment.md
  - docs/specifications/contracts/booking-payment-scenarios.md
  - docs/specifications/implementation/booking-completion-payment.md
  - docs/specifications/traceability/booking-payment-matrix.md
  - docs/retrospectives/2026-10-16-customer-purchase-readiness-retro.md
sections:
  - Sammanfattning
  - Underlag
  - "Del 1: Resultatet av C3/C2"
  - "Del 2: Arbetssättet"
  - Kostnad
  - Problem – arbetssätt, verktyg, befintlig kod
  - Rekommendationer
  - En processförbättring
  - Tekniska uppföljningar
  - Beslut för Johan
---

# Retrospektiv: C3/C2 och specifikationspiloten

**Datum:** 2026-10-25
**Scope:** PR #569 (specifikationspilot, mergad 2026-10-23) och PR #570
(vertikal slice C3 + C2, mergad 2026-10-24 som `996a6262`).
**Status:** utkast av Claude Code, granskat av Codex 2026-10-25 och rättat
efter granskningen. Väntar på Johans beslut om arbetssättet ska bli permanent
eller skalas upp.

Evidensmarkörer: `[läst]` granskat i Git, PR eller dokument, `[körd]` kört,
`[tolkning]` min slutsats.

---

## Sammanfattning

- **Slicen levererade det den skulle.** Båda reglerna verkställs på servern,
  alla vägar till "utförd" går genom samma kontroll, och CI var grön på alla
  jobb inklusive iOS. Ingen schemaändring. `[läst]`
- **Specifikationerna gjorde mest nytta före koden.** Fyra produktfrågor om
  klocka, tidszon, exakt sluttid och offline-synk avgjordes av Johan innan
  implementationen började. Tre tekniska risker fångades i Codex
  planeringsgranskning innan något test skrevs. `[läst]`
- **Det som ändå kostade omtag var antaganden, inte spårbarhet.** De dyraste
  sena fynden gällde dataformat mellan lager, samtidiga skrivningar och
  testmiljön. Spårbarhetskedjan var redan komplett i kontraktet. `[tolkning]`
- **Min rekommendation:** behåll modellen, förenkla den något, och lägg till
  en kort antagandekontroll före RED i stället för Johans föreslagna
  spårbarhetskontroll. Motivering i [En processförbättring](#en-processförbättring).

---

## Underlag

| Källa | Innehåll |
|---|---|
| PR #569 | Specifikationspiloten: README, 4 affärsregler, 25 scenarier, spårbarhetsmatris. Skapad 13:22, mergad 13:44 den 2026-10-23. `[läst]` |
| PR #570 | 10 commits, 69 filer, +2648/−193 rader (src 41 filer, ios 18, e2e 2, docs 7). Tester: 26 filer, +1439 rader. `[läst]` |
| Commits #570 | PLAN `48b2f712` 08:47Z → RED C3 `47843b65` → GREEN C3 `a8191152` → RED C2 `812c2d88` → GREEN C2 `94001634` → E2E+docs `f16b0b03` 09:17Z → två review-fixar → Stripe-skydd `72975118` → Codex godkänd `4e2046b6` 10:05Z. Mergad 10:25Z. `[läst]` |
| CI #570 | Alla jobb gröna: unit + coverage, lint, typecheck, build, E2E, offline-E2E, migration från noll, security audit, iOS (9 min 52 s), `Quality Gate Passed`. `[läst]` |
| Granskningar | Codex planeringsgranskning (3 fynd), `/code-review` (10 fynd), `/security-review` (0 fynd ≥ 8 i konfidens), ios-expert (0 blockers/majors, 4 minors), Codex slutgranskning (1 fynd, sedan godkänd). `[läst]` |
| Handoffs | `docs/agent-handoffs/claude-code.md`, `docs/agent-handoffs/codex.md`. `[läst]` |
| Tidigare retro | `2026-10-16-customer-purchase-readiness-retro.md` (format och beslut C1–C3). `[läst]` |

---

## Del 1: Resultatet av C3/C2

### Vad som levererades

- **C3, BR-BOOK-001:**
  - `BookingService.updateStatus` avvisar "utförd" före bokad sluttid, räknat med serverns klocka i bokningens tidszon.
  - Skrivningen är en villkorad `UPDATE` mot de kontrollerade värdena. En samtidig ombokning ger 409 i stället för att kringgå regeln.
  - Ombokningens skrivningar kräver `pending` eller `confirmed`.
  - Ägarskapet prövas före tidskontrollen. `[läst]`
- **C2, BR-PAY-001:** bara utförda bokningar kan betalas. Kunden ser en förklaring i stället för "Betala" när bokningen är bekräftad. `[läst]`
- **Klienter:**
  - Webb: en delad knapp som aktiveras av sig själv vid sluttiden, och serverns felmeddelande visas.
  - iOS: knappen följer bokningens tidszon, avslag visas i en felruta, bara transienta fel köas offline och knappen har en VoiceOver-hint.
  - Röstloggen talar uttryckligen om ifall markeringen lyckades. `[läst]`
- **Verifiering:**
  - `check:all` 4934 tester och iOS 386 tester.
  - Vertikal E2E `e2e/payment.spec.ts`, grön 3 gånger lokalt. **Den körs inte i CI**: jobbet E2E Tests kör bara `test:e2e:smoke`. `offline-mutations.spec.ts` körs däremot i CI, eftersom jobbet Offline E2E Smoke kör projektet `offline-chromium` som omfattar alla `offline-*.spec.ts`.
  - Offline-E2E. `[körd]`
- **Spårbarhet:** 13 scenario-ID:n (SC-BOOK-001–008, SC-PAY-001–005) finns i testnamn i webbtesterna, och fyra av dem finns också i iOS-testerna. Matrisen visar BR-BOOK-001 och BR-PAY-001 som "Följer". `[läst]`

### Punkter som efterfrågades särskilt

**Serverklocka, tidszon, exakt sluttid och offline-synk.** Affärsregeln
BR-BOOK-001 och scenarierna tvingade fram fyra frågor redan i pilot-PR #569:

- Vems klocka avgör?
- I vilken tidszon räknas sluttiden?
- Får bokningen markeras exakt vid sluttiden?
- Vad gäller när en markering gjord offline synkas sent?

Johan beslutade alla fyra den 2026-10-23, och de blev SC-BOOK-005–008. `[läst]`

Utan scenarierna hade de sannolikt avgjorts i koden av den som skrev den. Det
gäller till exempel `new Date()` i serverns lokala tid, vilket är exakt det
mönster som redan finns i ombokningsfönstrets `setHours`. `[tolkning]`

**Konkurrensrisken mellan ombokning och statusbyte.** Codex hittade risken i
planeringsgranskningen, inte jag i kartläggningen: `updateStatus` läste
bokningen och skrev sedan i ett separat steg. `[läst]`

Lösningen blev en villkorad skrivning i båda riktningar. Under GREEN visade
det sig dessutom att Prismas `update` med icke-unika villkor inte garanterat
är en enda SQL-sats, så skrivningen byttes till `updateMany`. Det fyndet kom
från mig, inte från någon granskning. `[läst]`

Kvar finns en lucka: atomiciteten är aldrig provkörd mot riktig PostgreSQL.
Den bygger på hur radlås fungerar vid `UPDATE`. `[läst]`

**Tidszonen saknades i klienternas dataflöde.** Kontraktet sa att iOS skulle
avgöra knappens läge i bokningens tidszon, men varken API:erna eller
Swift-modellerna skickade fältet. Codex påpekade det i planeringsgranskningen,
och fältet lades till innan RED. `[läst]`

Ett andra lager av samma problem dök upp först i `/code-review`, efter GREEN:

- Supabase-REST levererar tidsstämplar utan zon. Webbläsaren tolkade dem i
  lokal tid och kunde då hamna på fel dag.
- Tidszoner väster om UTC fick fel dag när bokningen var lagrad vid
  UTC-midnatt. `[läst]`

Kontraktet hade ett `[tolkning]`-antagande om att datumlogiken "håller för
tidszoner öster om UTC". Det antagandet blev aldrig ett test före RED. `[läst]`

**Röstloggens partiella utfall.** Röstloggen sparade anteckningen och svalde
sedan tyst en avvisad markering, men visade ändå "Arbetslogg sparad!". `[läst]`

Kartläggningen hittade problemet, och Codex krävde att svaret uttryckligen
skulle skilja mellan utfallen. Resultatet blev fältet `completion`
(`not_requested`, `completed` eller `rejected` med orsak) och ett eget besked
i UI. `[läst]`

**E2E-miljön använde Stripe från `.env.local`.** `playwright.config.ts` läste
in `.env.local`, där `PAYMENT_PROVIDER="stripe"` var satt, och då verkade
reservvärdet `'mock'` aldrig. Första körningen av den vertikala specen skapade
därför ett betalningsförsök i Stripes testkonto. Ingen debitering, ingen prod. `[körd]`

Jag rapporterade det och kringgick det med en env-variabel i kommandot. Codex
slutgranskning bedömde det som otillräckligt: miljön måste vara deterministisk
för alla som kör testerna, inte bara för mig. `[läst]`

Åtgärden i `72975118`:

- Playwright tvingar alltid mock-gatewayen.
- Stripe kräver uttryckligt `E2E_PAYMENT_PROVIDER=stripe`.
- Specen frågar servern vilken gateway den kör och avbryter före seed om svaret
  är fel.

Skyddet provades mot en riktig Stripe-server: inga bokningar seedades och inga
betalningar skapades. `[körd]`

### Kvarstående uppföljningar

| Uppföljning | Varför den inte löstes i slicen |
|---|---|
| iOS-knappen aktiveras inte av sig själv vid sluttiden, bara vid nästa omritning. | Servern avgör ändå. ios-expert avrådde från en `TimelineView` per kort. Föreslagen lösning: en `tick` per skärm vid `scenePhase == .active` och var 60:e sekund. |
| Flera E2E-specar väntar sig `/provider/dashboard` efter inloggning, men leverantörer hamnar på `/provider/calendar` och kunder på `/hem`. | Felet fanns redan före slicen. Den nya specen har egna inloggningar. Ska rättas för sig. |

Övriga dokumenterade rester står i kontraktets Risker:

- iOS saknar serverns felmeddelande, eftersom `APIError.serverError(Int)` bara bär statuskoden.
- En ombokning som krockar med en samtidig markering får fel feltext.
- Om bokningen raderas mellan skrivningen och läsningen svarar tjänsten 404 trots att statusen skrevs.

---

## Del 2: Arbetssättet

### Produktfrågor som upptäcktes före implementation

| Fråga | Hur den kom fram | Utfall |
|---|---|---|
| Vems klocka avgör "utförd"? | BR-BOOK-001 och SC-BOOK-006 | `[beslut]` serverns klocka |
| I vilken tidszon räknas sluttiden? | SC-BOOK-006 och -007 (sommartid) | `[beslut]` bokningens tidszon |
| Får bokningen markeras exakt vid sluttiden? | SC-BOOK-005 | `[beslut]` ja |
| Vad gäller vid sen offline-synk? | SC-BOOK-008 | `[beslut]` serverns mottagningstid |
| Ägarskap och ombud vid betalning | BR-PAY-002, SC-PAY-013 | `[beslut]` inga ombud |
| Fyra UX-frågor: knapp före sluttid, röstlogg, iOS i slicen, kundtext | Implementationskontraktets stoppunkt 1 | `[beslut]` alla fyra godkända |
| Q-PAY-002–005 (gamla markeringar, belopp, ersatta försök) | Scenarier som inte gick att besluta | Avsiktligt öppna, ingår inte i C3/C2 |

### Tekniska risker vid planerings- och Codexgranskningen

| Risk | Hittad av | När | Kostnad att rätta |
|---|---|---|---|
| Kontroll och skrivning inte atomiska | Codex | Före RED | Ett nytt avsnitt i kontraktet och ett konkurrenstest |
| `timezone` saknas i API och Swift-modeller | Codex | Före RED | Fyra select-block och två modeller |
| Röstloggen kan inte uttrycka partiellt utfall | Kartläggning + Codex | Före RED | Ett svarsfält |
| Tre lagringsvarianter av `bookingDate` | Kartläggning | Före RED | En ren funktion med tester |
| iOS-kalendern köar 4xx och slänger dem tyst | Kartläggning | Före RED | Köpolicy och felruta |
| Offline-E2E kodade in det förbjudna beteendet | Kartläggning | Före RED | Seed flyttad till passerad tid |
| Prismas `update` är inte en garanterad enskild sats | Claude Code | Under GREEN | Byte till `updateMany` |
| Ny omläsning hade läckt existens och sluttid till fel leverantör | Claude Code | Under GREEN | Ägarskap före tidskontroll |
| Supabase-tidsstämpel utan zon; väster om UTC | `/code-review` | Efter GREEN | Ny datumregel på tre plattformar |
| E2E kunde gå mot Stripe | Faktisk körning, Codex | Efter VERIFY | Konfiguration, testendpoint och förkontroll |

### Hur kedjan fungerade

`intention → affärsregel → scenario → implementationskontrakt → test → kod → spårbarhet`

- **Intention → regel:** fungerade. Johan kunde besluta direkt från
  produktspråk, och inga filnamn behövdes. `[läst]`
- **Regel → scenario:** fungerade bäst av alla led. Konkreta klockslag
  (07:00, 10:30, 10:59, 11:00, 11:30 och sommartidsdagen) blev direkt
  testfall. `[läst]`
- **Scenario → kontrakt:** fungerade. Kontraktet listade alla vägar, felkoder,
  klienter och en testplan per scenario-ID. `[läst]`
- **Kontrakt → test:** fungerade men var inte exakt. Testplanen pekade ut två
  testfiler som aldrig skapades (`BookingDetailDialog.test.tsx`,
  route-integrationstest för `WHERE`). Testerna hamnade i andra filer:
  `MarkCompletedButton.test.tsx` och `PrismaBookingRepository.test.ts`.
  Kontraktet rättades i RED-commiten. `[läst]`
- **Test → kod:** fungerade enligt TDD. RED-commiterna innehåller bara tester,
  och 23 tester fallerade av rätt anledning före GREEN. `[körd]`
- **Kod → spårbarhet:** fungerade men gjordes manuellt i slutet. Matrisen fick
  nya rader för tester och implementation. Ingen automatisk kontroll säger om
  ett scenario saknar test. `[läst]`

### Omtag

| Omtag | Hade det blivit dyrare utan specifikationerna? |
|---|---|
| Klocka, tidszon, gränsfall och offline-synk | **Ja, sannolikt mycket.** Utan beslut hade frågorna avgjorts i koden och kanske upptäckts först i staging, som när R2 såg en bokning markerad tre timmar för tidigt. |
| Kontraktet uppdaterat med Codex tre fynd | **Ja.** Rättat i text före RED. Efter GREEN hade det krävt ny repositorylogik, nya tester och fler klientändringar. |
| `updateMany` och ägarskap under GREEN | **Oklart.** Fångades av TDD och eftertanke, inte av specifikationen. |
| Datumtolkning efter `/code-review` | **Nej, specifikationen förhindrade det inte.** Antagandet stod i kontraktet som `[tolkning]` men prövades inte. |
| Stripe i E2E | **Nej.** Ett miljöproblem som specifikationen inte berörde. |
| Inaktuella E2E-inloggningar, Playwright-webbläsare saknades, lokal Supabase stoppad | **Nej.** Miljö och befintliga tester. |
| Två bortglömda kopior av ett felmeddelande i testmockar | **Nej.** Mekaniskt. |

### Hjälpte scenario-ID:n?

**Ja**, med konkret evidens: `[läst]`

- **RED-utdata:** den listade fallerande testnamn som "SC-BOOK-002 – avvisar
  completed klockan 07:00 …". Varje rött test pekade direkt på regel och
  scenario.
- **Spårbarhetsmatrisen:** den uppdaterades genom att söka efter `SC-BOOK-`
  och `SC-PAY-` i testerna.
- **Avstämning:** alla 13 beslutade scenarier i slicen (SC-BOOK-001–008 och
  SC-PAY-001–005) har minst ett test. SC-PAY-006 ingår inte bland dem: det
  är en obeslutad fråga (Q-PAY-002) och därför medvetet otestat.

**Begränsningar:**

- Swift-testnamn kan inte innehålla bindestreck (`testSCBOOK002_…`), så en
  sökning över plattformar kräver två mönster.
- Inget test har misslyckats i CI sedan merge, så nyttan vid felsökning i
  efterhand är inte prövad.

### Stämde kontraktet med det som byggdes?

**I allt väsentligt ja.** Kontraktet har en egen avvikelselista i sin status,
som skrevs under GREEN: `[läst]`

- knappen blev en delad komponent i stället för ändringar direkt i dialogen,
- ägarskapet prövas före tidskontrollen,
- `updateMany` i stället för `update`.

**Saker som inte stod i kontraktet:**

- datumregeln för tidsstämplar utan zon och väster om UTC,
- webbknappens timer,
- iOS-meddelanden som beror på om sluttiden passerat,
- testendpointen och `getPaymentProviderName()`.

De är dokumenterade i matrisen, kontraktets risker eller PR:en. Kontraktet
beskriver alltså planen plus avvikelserna, men inte varje detalj som tillkom
efter granskningen. `[läst]`

### Vilken dokumentation blev bestående värdefull?

| Dokument | Bedömning |
|---|---|
| Affärsregler + scenarier | **Bestående värde.** Teknikfria, beslutade och stabila. Används vid nästa ändring av reglerna. |
| Spårbarhetsmatrisen | **Bestående värde, med underhållsrisk.** Den pekar på filer och testnamn som ändras. |
| Implementationskontraktet | **Värde fram till merge, sedan historik.** Testplanen överlappar matrisens testkolumn. Avsnitten om dataflöde och data och tid överlappar `docs/architecture/booking-flow.md`. Risk för dubblering om det fortsätter att uppdateras. |
| `docs/specifications/README.md` | **Bestående värde** som styrdokument. Sektionen "Pilotutvärdering" hör hemma här i retron, inte i README. |
| Handoff-filer | **Värde under arbetet.** Tillfälliga enligt sin egen README. |
| `booking-flow.md`, hjälpartiklar, testing-guide | Obligatoriska enligt docs-matrisen och uppdaterade. `booking-flow.md` beskriver nu samma regler som affärsreglerna, vilket är en dubbleringsrisk på sikt. |

---

## Kostnad

Siffrorna är hämtade ur Git och granskningarnas metadata. Den interaktiva
sessionens tokenåtgång har inte mätts. `[läst]`

| Moment | Kalendertid | Kommentar |
|---|---|---|
| Specifikationspilot (#569) | Del av 2026-10-23, PR öppen i 22 minuter | Skrivet tidigare samma dag, inklusive Johans beslut |
| Kartläggning + kontrakt (stoppunkt 1) | Före PLAN-commiten 08:47Z den 2026-10-24; exakt tid inte mätt | Ingen kod. Väntetid på Johan och Codex ingår. |
| PLAN-commit → E2E + docs | 08:47 → 09:17 (30 min) | RED, GREEN och E2E för både C3 och C2 |
| Granskning och åtgärder | 09:17 → 10:05 (cirka 50 min) | `/code-review`, `/security-review`, ios-expert, Codex, två fix-commits, Stripe-skydd |
| PR → merge | 09:52 → 10:25 (33 min) | CI, iOS-jobbet tog cirka 10 min |

Granskningarnas egen tokenåtgång (subagenter): `/code-review` cirka 155 000,
`/security-review` cirka 77 000, ios-expert cirka 88 000. `[läst]`

`[tolkning]` Den extra kostnaden för arbetssättet ligger främst i specifikations-
och kontraktsfasen och i att två agenter granskar. Själva implementationen
gick snabbt, eftersom besluten redan var tagna. Jag kan inte visa en baslinje
för samma slice utan specifikation, så besparingen går inte att mäta, bara
bedöma.

---

## Problem – arbetssätt, verktyg, befintlig kod

| Kategori | Problem |
|---|---|
| **Arbetssätt** | Antaganden i kontraktet, som datum öster om UTC och klientdatans format, prövades inte före RED. Testplanen namngav filer som inte blev av. Kontraktet blev långt (cirka 250 rader) och överlappar matris och arkitekturdokument. Spårbarheten uppdateras manuellt i efterhand. |
| **Verktyg och testmiljö** | Den vertikala E2E-specen `e2e/payment.spec.ts` ingår inte i CI, så regressioner i slicens helhetsflöde fångas bara vid manuell körning. `.env.local` med Stripe slog igenom i E2E. Playwrights webbläsare saknades lokalt. Lokal Supabase var stoppad. Node 26 kontra Node 24. Prod-builden för offline-E2E skrev om incheckade service worker-filer i `public/`. |
| **Befintlig kod och tester** | Tre lagringsvarianter av `bookingDate`. Supabase-REST levererar tidsstämplar utan zon. `APIError` på iOS bär inte serverns meddelande. iOS-kön och röstloggen svalde fel tyst. Flera E2E-specar har inaktuella inloggningsmål. |

---

## Rekommendationer

| Fråga | Rekommendation |
|---|---|
| Behålla, förenkla, utöka eller överge? | **Behålla och förenkla.** Regler och scenarier behålls som de är. Implementationskontraktet blir kortare: dataflöde, kontrollpunkter, felkontrakt, risker och antaganden, och testplanen ersätts av en rad per scenario i matrisen. Utöka till fler domäner en i taget. |
| Ska `docs/specifications/README.md` bli permanent? | **Ja, som styrdokument för specifikationslagret,** efter tre ändringar: status `active`, sektionen "Pilotutvärdering" flyttas hit, och en kort beskrivning av implementationskontraktets livscykel läggs till (gäller till merge, är sedan historik). Ett separat intentionsdokument behövs inte än. `[tolkning]` |
| Ska specifikationerna ligga kvar i kodrepot? | **Ja.** Matrisen och testnamnen hänvisar till kodfiler och scenario-ID:n. De ändras i samma PR och granskas av samma CI och agenter. Ett separat system skulle bryta kedjan. |
| Nästa pilotdomän? | **C1, BR-PAY-003, ett slutförbart betalningsförsök.** Regler och scenarier finns redan, och den är P0 för livebetalning. **Förutsättning:** Johan beslutar Q-PAY-003 (belopp) och Q-PAY-004 (ersatt försök som ändå slutförs) först. Utan de besluten är ombokningsfönstret ett bättre alternativ. Det ligger i samma tidsdomän, kan återanvända `BookingTime` och prövar att skriva en regel från grunden. |

---

## En processförbättring

**Johans kandidat:** före RED, en kort spårbarhetskontroll som visar att varje
beslutad regel har minst ett scenario, en planerad auktoritativ kontrollpunkt
och ett planerat test.

**Bedömning mot evidensen.** I den här slicen var just den kontrollen redan
uppfylld innan RED. Kontraktet hade alla tre för båda reglerna:
"Var reglerna verkställs" och "Testplan" per scenario-ID. Den hade alltså inte
fångat något av de fynd som kostade omtag. `[läst]`

Fynden som kostade mest var i stället:

- konkurrens mellan samtidiga skrivningar,
- data som saknades eller hade annat format när den passerade en gräns (API → klient, Supabase → webbläsare),
- testmiljön som rörde ett externt system,
- tysta felvägar i befintlig kod.

Alla var antaganden som stod, eller borde ha stått, i kontraktet men som
ingen prövade.

**Mitt förslag i stället: en antagandekontroll före RED.**

> Implementationskontraktet ska ha en kort lista med de antaganden slicen
> bygger på, i fyra frågor:
>
> 1. Vilka data passerar vilka gränser, och i vilket format?
> 2. Vad kan skriva samma data samtidigt?
> 3. Vilka externa system rör testerna?
> 4. Vilka befintliga felvägar sväljer fel?
>
> Varje antagande ska vara `[körd]`, `[läst]` med källa, eller ha ett planerat
> test. Oberoende granskning, i dag Codex, görs mot den listan före RED.

Varför den och inte spårbarhetskontrollen:

- **Codex fynd:** alla tre fynd från planeringsgranskningen hade besvarats av
  frågorna 1, 2 och 4.
- **`/code-review`-fyndet** om datum utan zon besvaras av fråga 1.
- **Stripe-incidenten** besvaras av fråga 3.
- **Spårbarhetskontrollen** kan med fördel automatiseras senare, som en
  sökning efter scenario-ID:n i testerna. Den behöver därför inte vara ett
  manuellt processteg.

Om Johan ändå vill ha spårbarhetskontrollen är den billig och skadar inte.
Evidensen talar bara inte för att den är den viktigaste.

---

## Tekniska uppföljningar

Detta är backlogguppgifter, inte processförbättringar:

1. iOS: knapparna aktiveras vid sluttiden (en `tick` per skärm, enligt ios-expert).
2. E2E: uppdatera inloggningsmålen i de befintliga specarna till `/provider/calendar` och `/hem`, eller låt en delad hjälpare acceptera båda.
3. iOS: låt `APIError` bära serverns felmeddelande så att iOS inte behöver spegla servertexter.
4. Ombokning: visa rätt feltext när bokningen hunnit bli utförd.
5. CI: kör `e2e/payment.spec.ts` (eller `test:e2e:critical`) i CI, efter att inloggningsmålen i punkt 2 är rättade.
6. Valfritt: ett integrationstest mot lokal PostgreSQL som bevisar den villkorade skrivningen.
7. Valfritt: ett skript som listar scenario-ID:n utan test (automatiserad spårbarhet).
8. Ombokningsfönstret använder serverns lokala tid (`setHours`). Noterad som "watch" i kontraktet.

---

## Beslut för Johan

1. Ska arbetssättet behållas i förenklad form, med kortare implementationskontrakt och testplanen i matrisen?
2. Ska `docs/specifications/README.md` bli permanent (status `active`), med pilotutvärderingen flyttad hit?
3. Vilken processförbättring gäller för nästa slice: antagandekontroll, din spårbarhetskontroll eller båda?
4. Nästa pilot: C1, vilket kräver beslut om Q-PAY-003 och Q-PAY-004, eller ombokningsfönstret?
5. Vilka tekniska uppföljningar ska in i backloggen?
