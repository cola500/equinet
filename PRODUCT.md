# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Två lika viktiga användargrupper i en genuint tvåsidig marknadsplats -- produkten fungerar bara om båda har en bra upplevelse:

- **Hästägare**: bokar hovslagare, veterinär, hästterapeut eller tränare åt sin häst. Idag: SMS-bokning som tar dagar, ingen samlad bild av hästens vårdhistorik.
- **Leverantörer** (hovslagare, veterinärer, hästterapeuter, tränare): hanterar kalender, kunder och rutter. Idag: många olästa SMS, dubbelbokningar, ingen koll på vem som behöver nästa besök. Betalar för plattformen via prenumeration (Stripe, feature-flaggat).

## Product Purpose

Equinet kopplar hästägare med tjänsteleverantörer inom hästbranschen och ersätter SMS/telefon och Facebook-grupper som bokningskanal. Success = bokning sker direkt i systemet (inga SMS), leverantören har full koll på sin kalender och kundstock, och hästägaren har en samlad vårdhistorik per häst.

## Positioning

Byggt specifikt för hur hästvardagen fungerar -- inte en generisk bokningsapp som råkar passa:
- Automatiska påminnelser baserat på tjänstens intervall (nästa besöksdatum beräknas per häst, inte manuellt).
- Ruttplanering och ruttannonsering för resande leverantörer (hovslagare/veterinärer som kör runt) -- kunder i området notifieras.
- Gruppbokningar för stallgemenskaper.
- Samlad hästjournal (besök, anteckningar, intervall) delbar via länk, t.ex. till veterinären.

En generisk bokningsapp (Calendly-typ) har ingen av dessa hästbranschspecifika mekanismer.

## Operating Context

- **Två klienter mot samma backend**: responsiv Next.js-webbapp (installningsbar PWA, offline-stöd) och en nativ SwiftUI iOS-app (`ios/Equinet`) med push-notiser, EventKit-kalendersynk, WidgetKit-widget och JWT-baserad mobiltoken-auth.
- **Svensk marknad**: UI-språk är svenska genomgående; kod och kommentarer är engelska.
- **Demo-läge** (`NEXT_PUBLIC_DEMO_MODE`): fullt seedad demo-upplevelse med fiktiva personas (t.ex. "Lisa Andersson" som hästägare, "Erik Järnfot"/Järnfots Hovslageri som leverantör) för visning på staging/produktion utan att exponera skarp data.
- **Admin-roll**: separat adminpanel för användarhantering, bokningshantering, recensionsmoderation, verifieringsgranskning.
- Live demo-URL just nu: `equinet-staging.johanlindengard.com` (se Dataklassificering-anmärkning nedan).

## Capabilities and Constraints

**Funktionsyta** (se README "Implementerade Funktioner" och CLAUDE.md för fullständig lista): fast tid + flexibla bokningar, självservice-ombokning, återkommande bokningsserier, gruppbokningar, atomiskt dubbelbokningsskydd, leverantörskalender (dag/vecka/månad), ruttplanering med karta, kundregister med anteckningar, kundrecensioner, röstloggning med AI-tolkning, Stripe-betalningar och prenumerationer, Fortnox-bokföringsintegration, GDPR-dataexport (JSON/CSV).

**Säkerhet**: Supabase Auth, Row Level Security på samtliga kärndomäner (med bevistester), CSP/HSTS/rate limiting, admin-MFA, admin audit log.

**Explicit, bindande begränsning (satt av Johan 2026-09-29, gäller v0.3.0 och framåt tills annat beslutas):** v0.3.0 är en **Customer Preview / pre-release** för demonstration och återkoppling -- inte en bred, skarp lansering. **Endast fiktiv testdata (demo-personas, seed-data) får finnas i någon miljö som kör denna release.** Ingen skarp kund-, häst-, boknings-, betalnings- eller kontaktinformation får registreras förrän följande är löst: bolagsuppgifter (personuppgiftsansvarig), DPO-bedömning, personuppgiftsbiträdesavtal med underleverantörer (Supabase, Vercel, Stripe, Resend m.fl.), SCC-status för amerikanska underleverantörer. Se `docs/operations/release-sprint-checkpoint.md` ("Dataklassificering"-sektionen) för fullständig status -- detta dokument är den levande källan, denna rad blir inaktuell om beslutet ändras.

**Odokumenterat/oavgjort**: inget produktspecifikt tillgänglighetskrav (t.ex. WCAG-nivå) är formellt fastställt utöver etablerad praxis (VoiceOver-stöd nämnt för iOS-appen). Betrakta som öppet tills bekräftat.

## Brand Commitments

- **Namn**: Equinet. Logotyp: hästskoform (se `public/icons/`).
- **Tagline** (landningssida): "Bokning som funkar — också för hovslagaren."
- **Röst**: rakt på sak, konkret om smärtpunkter ("47 olästa SMS, tre dubbelbokningar..."), inte generisk SaaS-copy.

## Evidence on Hand

- Live, fungerande demo: `equinet-staging.johanlindengard.com` (Customer Preview-status, se ovan -- endast fiktiv data).
- README anger att plattformen är "i händerna på våra testpersoner idag" -- begränsad testanvändargrupp, inte en bred publik lansering ännu.
- Inga kundcase, testimonials eller pressomnämnanden att tillgå -- uppfinn inga.
- Skärmdumpar av leverantörskalender och landningssida finns i README.

## Product Principles

1. **Hästbranschspecifikt, inte generiskt** -- varje funktion ska lösa ett konkret problem i hästvardagen (intervallbaserade påminnelser, ruttplanering), inte vara en allmän kalenderfunktion.
2. **Tvåsidig balans** -- hästägarens och leverantörens upplevelser prioriteras lika; ingen sida får förbättras på bekostnad av den andra.
3. **Fiktiv data tills GDPR är löst** -- varje ny yta eller demo-flöde måste fungera fullt ut med enbart seed-/demo-persona-data; inga genvägar som antar skarp data.
4. **Två klienter, en produkt** -- webb (PWA) och nativ iOS delar samma affärslogik och känsla, men respekterar respektive plattforms konventioner (webb-mönster på webben, HIG på iOS).
5. **Svenska för användaren, engelska för koden** -- UI-text, felmeddelanden och dokumentation-för-slutanvändare är svenska; teknisk dokumentation och kod är engelska.

## Accessibility & Inclusion

Inget formellt produktspecifikt krav fastställt. VoiceOver-stöd är nämnt som implementerad funktion i iOS-appen. Betrakta ambitionsnivå som öppen tills bekräftad.
