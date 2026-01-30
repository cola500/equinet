# Insikter och koppling till Equinet

> Syntesanalys baserad på marknadsanalys och hypotetiska intervjuer med hovslagaren Erik Skog och hästägaren Anna Lindqvist.

---

## Topp 10 insikter

| # | Insikt | Källa | Koppling till Equinet | Prioritet |
|---|--------|-------|-----------------------|-----------|
| 1 | **SMS-bokning tar 30--40 min/dag** för leverantörer och skapar friktion för kunder | Erik, Anna | Bokningssystem med lediga tider | Redan implementerat |
| 2 | **Ingen svensk bokningsplattform** finns för hästtjänster trots 120 000 hästägare | Marknadsanalys | Equinets grundproposition -- first mover | Kärna |
| 3 | **Flexibel bokning** ("nån gång i mars") matchar hur branschen faktiskt fungerar | Erik, Anna | Flexibla rutt-beställningar | Redan implementerat |
| 4 | **Manuell ruttplanering** kostar leverantörer ~2 000 kr/mån i onödig diesel | Erik, Marknadsanalys | Ruttoptimering med kartvy | Redan implementerat |
| 5 | **Swish dominerar** (95% av privata betalningar) men "jagande efter betalning" är vanligt | Erik, Anna, Marknadsanalys | Betalningsabstraktion (gateway pattern) | Delvis implementerat |
| 6 | **Hästhälsohistorik är fragmenterad** -- utspridd hos leverantör, kund och papper | Anna, Marknadsanalys | Hästregister + hälsotidslinje | Implementerat |
| 7 | **Leverantörer tappar kunder** pga missade uppföljningar | Erik | Automatiska återbokningspåminnelser | Implementerat |
| 8 | **Att hitta ny leverantör tar veckor** och bygger på mun-till-mun | Anna, Marknadsanalys | Leverantörsgalleri med recensioner | Redan implementerat |
| 9 | **Leverantören driver adoption** -- kunden laddar ner när leverantören säger till | Anna | Leverantörs-first go-to-market | Strategisk insikt |
| 10 | **Oskyddad hovslagartitel** skapar kvalitetsosäkerhet | Erik, Marknadsanalys | Leverantörsverifiering | Implementerat |

---

## Redan implementerat

Features som valideras av forskningen -- de löser verkliga problem.

| Insikt | Befintlig feature | Status | Validerad av |
|--------|-------------------|--------|--------------|
| SMS-bokning ineffektiv | Bokningssystem med tillgänglighetskontroll | Implementerat | Erik, Anna |
| Flexibelt schemabehov | Flexibla rutt-beställningar (datum-spann, prioritet) | Implementerat | Erik, Anna |
| Svårt hitta leverantörer | Leverantörsgalleri med sökning och filter | Implementerat | Anna |
| Manuell ruttplanering | Ruttoptimering (Haversine + Nearest Neighbor) + kartvy | Implementerat | Erik |
| Saknar hästinfo vid bokning | Hästregister med koppling till bokningar | Implementerat | Erik, Anna |
| Vill se betyg vid val | Recensioner & betyg (1--5 stjärnor) | Implementerat | Anna |
| Vill svara på recensioner | Leverantörssvar på recensioner | Implementerat | Erik |
| Vill godkänna bokningar | Acceptera/avvisa-flöde | Implementerat | Erik |
| Vill avboka enkelt | Avbokningsfunktion med bekräftelse | Implementerat | Anna |
| Leverantörer annonserar rutter | Announcements + NearbyRoutesBanner | Implementerat | Anna ("push from leverantör") |
| Priser synliga | Tjänster med priser i leverantörsgalleri | Implementerat | Anna |
| Vet vad som förväntas | Onboarding-checklista för leverantörer | Implementerat | Erik ("ska sköta sig själv") |
| Vill ha påminnelser om besök | In-app notifikationer (klocka, dropdown, polling) | Implementerat | Anna, Erik |
| Leverantörer tappar kunder | Automatiska återbokningspåminnelser (cron + email + in-app) | Implementerat | Erik |
| Jagande efter betalning | Betalningsabstraktion (PaymentGateway for Swish/Stripe) | Förberett | Erik, Anna |

**Slutsats:** Equinets kärnfunktionalitet matchar väl mot identifierade behov. De viktigaste problemen (bokning, ruttplanering, hästregister, recensioner, notifikationer, påminnelser) är redan adresserade.

---

## Backlog-items som valideras

Befintliga backlog-items som forskningen stödjer.

| Insikt | Backlog-item | Prioritet | Status | Validerad av |
|--------|-------------|-----------|--------|--------------|
| Swish dominerar, jagande efter betalning | Betalningsintegration (Tier 2) | Hög | Gateway-abstraktion klar, riktig provider kvar | Erik, Anna, Marknadsanalys |
| Vill ha påminnelser om besök | In-app notifikationer + email | Hög | **Implementerat** | Anna, Erik |
| Vill ha påminnelser om besök | Push/SMS-notifikationer | Medium | Kvar (komplement till in-app) | Anna, Erik |
| Vill se foton på arbete | Bilduppladdning (Tier 2) | Medium | Ej startad | Anna |
| Bättre ruttoptimering sparar mer | F-1.2: Förbättrad ruttoptimering | Medium | Ej startad | Erik |
| Vill justera ruttordning manuellt | F-1.3: Drag-and-drop stopp | Medium | Ej startad | Erik |

**Rekommendation:** Betalningsintegration (Swish/Stripe via befintligt gateway-interface) och bilduppladdning bör prioriteras som nästa Tier 2-features. Notifikationsinfrastrukturen är nu på plats -- Push/SMS kan läggas till som komplement.

---

## Nya möjligheter

Behov som identifierats i forskningen men som inte finns i nuvarande backlog.

### ~~1. Automatisk återbokning / Påminnelser~~ -- IMPLEMENTERAT
**Status:** Implementerat (2026-01-30)
**Vad som byggdes:** Leverantörer sätter `recommendedIntervalWeeks` per tjänst. Daglig Vercel Cron hittar förfallna bokningar och skickar in-app notifikation + email med "Boka igen"-länk. En påminnelse per bokning, inga dubbletter.
**Implementation:** `ReminderService` (domain), `NotificationService`, cron-endpoint (`/api/cron/send-reminders`), email-template (`rebookingReminderEmail`), Select-dropdown i tjänstehantering.

### 2. Gruppbokning för stallgemenskaper
**Behov:** Hästägare i samma stall vill samordna leverantörsbesök men koordinering via SMS-grupp är kaotiskt.
**Lösning:** En hästägare skapar en gruppbokning för stallet. Andra ägare kan "haka på". Leverantören ser alla hästar på samma plats.
**Källa:** Anna ("fyra ägare, samma dag, kaos att koordinera")
**Komplexitet:** Medium-hög -- ny bokningsmodell, stallkoncept
**Värde:** Högt -- leverantörer sparar restid, kunder sparar koordineringstid

### ~~3. Leverantörsverifiering~~ -- IMPLEMENTERAT
**Status:** Implementerat (2026-01-30)
**Vad som byggdes:** ProviderVerification-modell med typ (education/organization/experience), ansöknings-API med max 5 pending, admin-granskning via $transaction (godkänn→isVerified=true + notifikation), VerificationBadge-komponent, isVerified exponerat i providers-galleriet och detaljsidan, godkända verifieringar listade på providerdetalj.
**Implementation:** `ProviderVerification` (schema), `verification-requests` (API), `admin/verification-requests` (API), `VerificationBadge` (komponent), `provider/verification` (UI), `admin/verifications` (UI), ProviderNav uppdaterad.

### ~~4. Hästhälsotidslinje~~ -- IMPLEMENTERAT
**Status:** Implementerat (2026-01-30)
**Vad som byggdes:** HorseNote-modell med 5 kategorier (veterinary/farrier/general/injury/medication), fullständig CRUD API, Timeline API som mergar bokningar + anteckningar, mergeTimeline utility, hästprofil-sida med vertikal färgkodad tidslinje, kategorifilter-chips, anteckningsdialog, provider read-only tidslinje med begränsade kategorier (integritetsskydd: providers ser bara veterinär/hovslagare/medicin).
**Implementation:** `HorseNote` (schema), `horses/[id]/notes` (API), `horses/[id]/timeline` (API), `timeline.ts` (utility), `customer/horses/[id]` (UI), `provider/horse-timeline/[horseId]` (UI), "Se historik"-knapp på hästkort.

### 5. Fortnox-integration
**Behov:** Leverantörer lägger manuellt in fakturor i Fortnox varje kväll. Tar tid och leder till att fakturor glöms.
**Lösning:** Automatisk fakturaexport till Fortnox efter avslutad bokning. Koppla kund, tjänst och belopp.
**Källa:** Erik ("en timme i veckan på fakturor", "glömmer att fakturera")
**Komplexitet:** Medium -- Fortnox har API, men behöver OAuth-koppling och mappning
**Värde:** Medium -- sparar tid men nischad till leverantörer som använder Fortnox

### 6. Dataexport / Hästpass
**Behov:** Leverantörer oroar sig för vendor lock-in. Kunder vill dela hästprofil vid försäljning.
**Lösning:** Exportfunktion för all egen data (kunder, bokningar, hästar). Delbar hästprofil ("digitalt hästpass").
**Källa:** Erik ("vill kunna exportera mina kunder"), Anna ("dela hästprofil vid försäljning")
**Komplexitet:** Låg (export) till medium (delbar profil)
**Värde:** Medium -- bygger förtroende, minskar adoption-barriär

---

## Prioriteringsrekommendation

Baserat på forskningens resultat, ordnat efter uppskattad påverkan:

### Fas 1: Stärk kärnan -- GENOMFÖRD (2026-01-30)

Dessa features validerades starkt av forskningen och byggde på befintlig infrastruktur.

| Prioritet | Feature | Status |
|-----------|---------|--------|
| 1 | **Betalningsabstraktion (gateway pattern)** | Implementerat -- `IPaymentGateway` + `MockPaymentGateway`. Swish/Stripe kräver bara ny implementation-klass. |
| 2 | **In-app notifikationer** | Implementerat -- NotificationBell, API routes, polling. Grund för alla framtida notifikationer. |
| 3 | **Automatisk återbokning/påminnelser** | Implementerat -- Vercel Cron, ReminderService, email + in-app. |

**Kvarstår från original-planen:** Push/SMS-notifikationer (komplement till in-app, kräver Twilio/Web Push). Riktig Swish/Stripe-koppling (kräver teamdiskussion om provider).

### Fas 2: Differentiering -- DELVIS GENOMFÖRD (2026-01-30)

Features som gör Equinet unikt jämfört med potentiella konkurrenter.

| Prioritet | Feature | Status |
|-----------|---------|--------|
| 4 | **Hästhälsotidslinje** | Implementerat -- HorseNote-modell, CRUD API, mergeTimeline, färgkodad tidslinje, kategorifilter, provider read-only (begränsade kategorier för integritet). |
| 5 | **Leverantörsverifiering** | Implementerat -- ProviderVerification-modell, ansöknings-API (max 5 pending), admin-granskning (approve/reject i $transaction), VerificationBadge, isVerified i provider-galleriet. |
| 6 | **Gruppbokning** | Kvar -- sparad till separat sprint (mest komplex, kräver stallkoncept och ny bokningsmodell). |

### Fas 3: Ecosystem-integration (långsiktigt)

| Prioritet | Feature | Motivation |
|-----------|---------|-----------|
| 7 | **Fortnox-integration** | Sparar tid för leverantörer men nischad. Kräver API-arbete. |
| 8 | **Dataexport / Hästpass** | Minskar adoption-barriär. Viktigt för förtroende långsiktigt. |
| 9 | **Bilduppladdning** | "Nice to have" -- inte dagligt problem. Tier 2-backlog. |

---

## Strategiska insikter

### Go-to-market: Leverantören först
Anna sa det tydligt: "Om min hovslagare använder det, laddar jag ner det." Eriks behov (tidsbesparning, rutter, administration) driver adoption. **Rekommendation:** Fokusera onboarding och marknadsföring på leverantörer -- kunderna följer med.

### Hovslagare som brohuvud
Av alla leverantörskategorier har hovslagare störst behov av ruttplanering och regelbunden bokning (var 6--8:e vecka). De är mest ambulerande och har mest att vinna på digitalisering. **Rekommendation:** Positionera initial lansering mot hovslagare specifikt.

### Prissättning: Kunden gratis, leverantören betalar
Annas prisförväntning (0 kr som kund, eller max 49 kr/mån) och Eriks referenspunkt (200 kr/mån för Fortnox) antyder en freemium-modell: **gratis för kunder, abonnemang för leverantörer** (t.ex. 199--399 kr/mån baserat på antal kunder/bokningar).

### "Enkel att börja, djup att utforska"
Båda personerna betonade enkelhet. Erik: "som SMS fast smartare". Anna: "boka först, fyll i resten senare". **Rekommendation:** Onboarding bör kräva minimal data upfront. Avancerade features (hästregister, hälsotidslinje, journal) introduceras progressivt.

---

*Syntesanalys genomförd: Januari 2026*
*Senast uppdaterad: 2026-01-30 (Fas 1 + Fas 2 delvis implementerad)*
*Baserad på: Marknadsanalys, intervju med Erik Skog (leverantör), intervju med Anna Lindqvist (kund)*
