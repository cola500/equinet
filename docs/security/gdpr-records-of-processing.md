---
title: "GDPR -- Register över behandlingsaktiviteter (Art. 30)"
description: "Datakarta över vilka personuppgifter Equinet behandlar, i vilket syfte, med vilken rättslig grund och hur länge"
category: security
status: active
last_updated: 2026-08-09
tags: [gdpr, security, privacy, records-of-processing, dataskydd]
depends_on:
  - prisma/schema.prisma
related:
  - docs/security/gdpr-subprocessor-register.md
  - docs/security/gdpr-gap-register.md
  - docs/security/data-retention-policy.md
  - docs/security/supabase-rls-security-audit-2026-08-06.md
  - docs/architecture/messaging-domain.md
sections:
  - Syfte
  - Personuppgiftsansvarig
  - Kategorier av registrerade
  - Behandlingsaktiviteter
  - Särskilda kategorier av personuppgifter
  - Överföring till tredje land
  - Källor och metod
  - Ändringslogg
---

# GDPR -- Register över behandlingsaktiviteter (Art. 30)

## Syfte

Detta dokument uppfyller GDPR Art. 30 -- kravet att föra ett register över
behandlingsaktiviteter. Det är en faktabaserad datakarta: vilka personuppgifter
Equinet behandlar, i vilket syfte, med vilken rättslig grund och hur länge de sparas.
Kartläggningen är gjord genom att läsa `prisma/schema.prisma` och tillhörande kod
(inte genom antaganden) -- se [Källor och metod](#källor-och-metod).

Detta dokument ersätter INTE en juridisk granskning. Rättslig grund per behandling
är en teknisk bedömning baserad på hur systemet faktiskt fungerar -- bekräfta med
juridisk rådgivning innan dokumentet används som formellt bevis vid en
IMY-förfrågan (Integritetsskyddsmyndigheten).

## Personuppgiftsansvarig

**Att fylla i av Johan (bolagsuppgifter finns inte i kodbasen):**

| Fält | Värde |
|------|-------|
| Bolagsnamn | *(saknas -- fyll i)* |
| Organisationsnummer | *(saknas -- fyll i)* |
| Adress | *(saknas -- fyll i)* |
| Kontakt för dataskyddsfrågor | support@equinet.se (bekräftat i `data-retention-policy.md`) |
| Dataskyddsombud (DPO) utsett? | *(saknas -- affärsbeslut, se gap-registret)* |

## Kategorier av registrerade

| Kategori | Beskrivning |
|----------|-------------|
| Kund | Privatperson som bokar tjänster (`User.userType = "customer"`) |
| Leverantör | Privatperson/enskild firma som säljer tjänster (`User.userType = "provider"` + `Provider`) |
| Admin | Equinet-anställd/operatör med adminrätt (`User.isAdmin`) |
| Manuellt tillagd kund | Kund utan eget konto, skapad av en leverantör (`ProviderCustomer`) -- undantagen från automatisk radering per `data-retention-policy.md` |

## Behandlingsaktiviteter

Per datamodell i `prisma/schema.prisma`. "Lagringstid" hänvisar till
[data-retention-policy.md](data-retention-policy.md) där en policy finns; annars
markerad som ej explicit definierad.

| Modell | Personuppgifter | Ändamål | Rättslig grund | Lagringstid |
|--------|-----------------|---------|-----------------|-------------|
| `User` | Namn, e-post, telefon, adress, stad/kommun, GPS-koordinater | Kontohantering, tjänsteleverans, platsbaserad matchning kund-leverantör | Avtal (Art. 6.1.b) | 2 års inaktivitet -> anonymisering (policy finns, se [gap-registret](gdpr-gap-register.md) för verkställighetsstatus) |
| `Provider` | Företagsnamn, adress, GPS-koordinater, beskrivning | Publik leverantörsprofil, matchning | Avtal (Art. 6.1.b) | Anonymiseras vid kontoradering |
| `Horse` | Namn, ras, födelseår, `specialNeeds` (medicinska behov/allergier/temperament), UELN-registreringsnummer, chipnummer | Tjänsteleverans (t.ex. hovslagare behöver veta om hästen är känslig) | Avtal (Art. 6.1.b) | Raderas vid ägarens kontoradering |
| `Booking` | `customerNotes`, `providerNotes`, `horseInfo` (fritext) | Bokningshantering | Avtal (Art. 6.1.b) | Endast `customerNotes` nollställs vid kundens kontoradering (`anonymizeBookings()`). `providerNotes` och `horseInfo` rörs INTE -- se gap-registret |
| `HorseNote` | Fritextanteckningar om häst (kan innehålla hälsoinfo) | Journalföring kring hästens skötsel | Avtal (Art. 6.1.b) | Raderas när författaren raderar sitt konto, ELLER när hästägaren raderar sitt konto (Cascade från `Horse`) -- den andra vägen tar även bort anteckningar skrivna av andra (t.ex. veterinär/hovslagare) vars eget konto inte rörs |
| `Stable` / `StableSpot` / `StableInviteToken` | Stalladress, stad, postnummer, kommun, GPS-koordinater, kontakt-e-post, kontakttelefon | Stallprofil, platsannonsering | Avtal (Art. 6.1.b) | `onDelete: Cascade` från `User`, men samma cascade-brist som DeviceToken/MobileToken nedan -- adressdatan blir kvar på obestämd tid, se gap-registret |
| `Upload` | Uppladdade filer (avatar, häst-, tjänste-, verifieringsbilder), kopplade till `userId` | Profil-/verifieringsbilder | Avtal (Art. 6.1.b) | Raderas korrekt vid kontoradering (`deleteUploads` + `deleteStorageFiles`) |
| `ProviderVerification` | Titel, utfärdare, år för leverantörens certifiering/utbildning | Verifiering av leverantörens kompetens | Avtal (Art. 6.1.b) | Rörs INTE av `anonymizeProvider()` vid kontoradering -- se gap-registret |
| `BugReport` | Fritext (`title`, `description`, `reproductionSteps`), `userAgent`, valfri koppling till `userId` | Felsökning/produktutveckling | Berättigat intresse (Art. 6.1.f) | Rörs INTE av kontoradering. Redan flaggad i `supabase-rls-security-audit-2026-08-06.md` som en tabell som "kan innehålla PII i beskrivningar" -- se gap-registret |
| `ProviderCustomerNote` | Fritextanteckningar OM en kund, skrivna av leverantören | Kundrelationshantering för leverantören | Berättigat intresse (Art. 6.1.f) | **Ej definierad -- se gap-registret** (raderas inte vid kundens kontoradering idag) |
| `Payment` | Belopp, `providerPaymentId`, status | Betalningshantering, bokföring | Avtal (Art. 6.1.b) + sannolikt rättslig förpliktelse (bokföringslagen) för den bokföringsrelevanta delen | "Enligt Stripe retention policy" (policy-dokument) -- bokföringslagens 7-årskrav ej explicit verifierat mot kod, bekräfta med redovisningsansvarig |
| `FortnoxConnection` | Krypterade OAuth-tokens för bokföringsintegration | Automatiserad bokföring | Avtal (Art. 6.1.b) | Ej explicit definierad |
| `Review` / `CustomerReview` | Betyg + fritextkommentar | Kvalitetstransparens för andra användare | Avtal/berättigat intresse (Art. 6.1.b/f) | Kommentar raderas vid kontoradering, betyg bevaras anonymiserat |
| `Message` / `Conversation` | Meddelandeinnehåll (`content`, max 2000 tecken), ev. bildbilaga | Kommunikation kund <-> leverantör kring en bokning | Avtal (Art. 6.1.b) | Raderas via Cascade från `Booking`. `senderId` anonymiseras INTE separat vid kontoradering -- känt, medvetet dokumenterat i `docs/architecture/messaging-domain.md` som uppskjutet |
| `AvailabilityException` | GPS-koordinater för leverantörens arbetsplats | Schemaläggning | Avtal (Art. 6.1.b) | Ej explicit definierad |
| `RouteOrder` / `Route` / `RouteStop` | Adress + GPS-koordinater (kundinitierad ruttbeställning) | Ruttplanering för leverantören | Avtal (Art. 6.1.b) | **Ej anonymiserad vid kontoradering -- se gap-registret** |
| `DeviceToken` / `MobileToken` | Enhets-/sessionidentifierare (APNs-token, JWT-hash) | Push-notiser, sessionhantering (native app) | Avtal (Art. 6.1.b) | `onDelete: Cascade` från `User`, men utlöses aldrig eftersom kontoradering anonymiserar (UPDATE) snarare än raderar `User`-raden -- se gap-registret |
| `PushSubscription` | Push-prenumerationsidentifierare | Push-notiser (webb) | Avtal (Art. 6.1.b) | Raderas korrekt vid kontoradering (`deletePersonalRecords()` -- till skillnad från DeviceToken/MobileToken ovan) |
| `CustomerInviteToken` | Inbjudningstoken, kopplad till `userId` + `invitedByProviderId` | Kundinbjudningsflöde | Avtal (Art. 6.1.b) | Samma cascade-brist som ovan |
| `AdminAuditLog` | `userEmail`, `ipAddress`, `userAgent` (om admin-användaren) | Säkerhetslogg för admin-åtgärder | Berättigat intresse / rättslig förpliktelse (Art. 6.1.f/c) -- säkerhetslogg | **Ingen TTL/radering -- sparas på obestämd tid, se gap-registret (Hög prioritet)** |
| `PasswordResetToken` / `EmailVerificationToken` | Token kopplad till `userId` | Kontosäkerhet | Avtal (Art. 6.1.b) | Raderas vid kontoradering (bekräftat i `AccountDeletionService`) |

## Särskilda kategorier av personuppgifter

Ingen modell innehåller Art. 9-kategorier (hälsodata, etnicitet, politisk åsikt etc.)
**om en fysisk person**. `Horse.specialNeeds` innehåller "medicinska behov, allergier,
temperament" men gäller djuret, inte en registrerad fysisk person, och saknar därför
Art. 9-status enligt gängse GDPR-tolkning (bekräftat resonemang, se
`docs/user-research/marknadsanalys.md:135`). Bedömningen bör ändå dokumenteras
explicit här eftersom fritextfält (`specialNeeds`, `customerNotes`, `HorseNote.content`)
teoretiskt skulle kunna innehålla personuppgifter om en tredje person (t.ex. "kunden har
en synskada och behöver extra tid") -- det finns ingen teknisk spärr mot detta, bara
ett UX-antagande om vad fältet används till.

## Överföring till tredje land

Se [gdpr-subprocessor-register.md](gdpr-subprocessor-register.md) för fullständig
lista över personuppgiftsbiträden och deras lagringsregion. Supabase-projekten
(prod: Zürich, staging: Frankfurt, enligt CLAUDE.md) ligger inom EU/EES. Statusen för
övriga biträden (Stripe, Sentry, Vercel, Resend, Upstash, Anthropic, Apple) är INTE
verifierad i denna genomgång -- flera av dessa är amerikanska bolag där överföring
kan kräva SCC (Standard Contractual Clauses) eller motsvarande. Se gap-registret.

## Källor och metod

Denna kartläggning gjordes genom:
1. Genomläsning av `prisma/schema.prisma` (44 modeller)
2. Genomläsning av `src/app/api/export/my-data/route.ts` och
   `src/domain/account/AccountDeletionService.ts` för att verifiera faktiskt
   dataflöde (inte bara schema)
3. Grep efter tredjepartsintegrationer i `package.json`, `.env.example`, `src/lib/`
4. Genomläsning av befintlig säkerhets-/retention-dokumentation i `docs/security/`
5. En andra, oberoende faktakontrollsomgång (separat agent) som verifierade varje
   konkret påstående mot koden på nytt -- hittade och korrigerade tre sakfel i
   den första versionen samt fyra modeller (`Stable`/`StableSpot`/
   `StableInviteToken`, `Upload`, `ProviderVerification`, `BugReport`) som
   saknades i den första genomgången. Se ändringsloggen.

Ingen data i produktionsdatabasen har lästs eller exporterats för detta arbete.
Trots två genomgångar kan dokumentet fortfarande innehålla luckor -- det är en
ögonblicksbild från 2026-08-09, inte en garanti för fullständighet.

## Ändringslogg

| Datum | Ändring |
|-------|---------|
| 2026-08-09 | Första versionen, korrigerad efter oberoende faktakontroll samma dag: fixade felaktig `PushSubscription`-gruppering, korrigerade överdrivet `Booking`-anonymiseringspåstående, nyanserade `HorseNote`-raden, lade till `Stable`/`Upload`/`ProviderVerification`/`BugReport`. Del av GDPR-dokumentationspaketet (se `docs/agent-operations/`). |
