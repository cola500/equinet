---
title: "Equinet Roadmap"
description: "Produktroadmap med prioriteringar, blockerare och tidslinje"
category: guide
status: active
last_updated: 2026-04-01
tags: [roadmap, product, strategy]
sections:
  - Produktionsredo idag
  - Nu
  - Sprint 7
  - Kort sikt
  - Medellång sikt
  - Längre sikt
  - Blockerare
---

# Equinet Roadmap

> Uppdateras efter varje sprint-retro och demo-feedback.

## Produktionsredo idag

| Feature | Status |
|---------|--------|
| Bokning (skapa, hantera, bekräfta, avboka) | Live |
| Kundinbjudningar (invite ghost -> riktigt konto) | Live |
| Kortbetalning (Stripe test-mode) | Kod klar, flagga av |
| Push-notiser (iOS) | Kod klar, APNs saknas |
| Demo-läge | Live |
| iOS native (10/16 provider-skärmar) | Live |
| Due-for-service native | Live |
| Sentry felrapportering | Live |
| UptimeRobot övervakning | Live |
| 3866 tester (unit + integration + E2E) | Gröna |

## Nu (denna vecka)

- Leverantörsdemo (allt redo, equinet-app.vercel.app)
- Köp Apple Developer-konto (99 USD) -> push live direkt
- Stripe företagsverifiering påbörjad

## Sprint 7 (efter demon)

- **Fas 1 RLS** -- stärk app-lagret: `findByIdForProvider()`, ESLint-regel (0.5-1 dag)
- **Demo-feedback stories** -- prioriteras baserat på vad leverantören sa
- **Push live** -- plugga in APNs-credentials (15 min, kod redan klar)
- **Swish** -- aktivera i Stripe när företagsverifiering klar (1 rad kodändring)
- **Stripe live-mode** -- byt från test-nycklar till live-nycklar

## Kort sikt (1-2 månader)

- **Fas 2 RLS** -- tunn vertikal slice: Booking-tabell med Supabase-klient + RLS (2-3 dagar, innan leverantör #2)
- **Onboarding utan seed-data** -- registreringsflöde för riktiga leverantörer
- **Stripe live-betalningar** -- riktiga pengar, kräver Stripe business verification
- **E-postverifiering** -- säkerställ att Resend levererar på egen domän

## Medellång sikt (2-4 månader)

- **Kundupplevelsen** -- native iOS för kunder eller polerad WebView
- **Fortnox-integration** -- fakturering, sparar leverantörer ~1h/vecka (user research)
- **Ruttplanering** -- kräver Mapbox-token, hög efterfrågan (120 000 hästägare, ambulerande tjänster)
- **Fas 3 RLS** -- opportunistisk migrering av kärndomäner

## Längre sikt (4+ månader)

- **Fler native iOS-skärmar** (6 kvar: röstloggning, ruttplanering, annonsering, gruppbokningar, insikter, hjälp)
- **Web Push** (browser-notiser utöver iOS)
- **Fas 4 RLS** -- full migrering om fas 2-3 motiverar det
- **i18n** (om vi expanderar utanför Sverige)
- **App Store-publicering** (kräver Apple Developer + review-process)

## Feature flags -- lanseringsberedskap

18 flaggor totalt. Bedömning per flagga:

### Redo att lansera (flagga på, fungerar)

| Flagga | Status | Vad behövs |
|--------|--------|-----------|
| `customer_invite` | Live i prod | Inget -- redan på |
| `due_for_service` | Default on | Fungerar, native vy klar |
| `help_center` | Default on | Fungerar |
| `self_reschedule` | Default on | Fungerar |
| `demo_mode` | Live i prod | Inget -- för demo |

### Nära lansering (kod finns, behöver konfiguration)

| Flagga | Vad saknas | Effort |
|--------|-----------|--------|
| `stripe_payments` | Slå på flaggan + live-nycklar | Config, 15 min |
| `push_notifications` | APNs-credentials (Apple Developer) | Config, 15 min |
| `recurring_bookings` | Default on men otillräckligt testad i prod | E2E-verifiering, 1 dag |

### Kräver arbete innan lansering

| Flagga | Problem | Effort |
|--------|---------|--------|
| `voice_logging` | Oklart om AI-tjänst (OpenAI/annat) är ansluten. SpeechRecognizer finns på iOS men server-side AI-tolkning overifierad. | Research + integration, 1-2 veckor |
| `customer_insights` | Samma som ovan -- "AI-genererade" men oklart om faktisk AI-koppling. Tester mockar allt. | Research + integration, 1 vecka |
| `route_planning` | Kräver Mapbox-token. Utan token: tom karta, trasig sökning. | Mapbox-konto + token + verifiering, 1-2 dagar |
| `route_announcements` | Beroende av route_planning (rutt-annonser kopplade till rutter). | Löses med route_planning |
| `business_insights` | Recharts-baserad analytics. Fungerar men behöver realistisk data för att se bra ut. | Polish + seed-data, 1-2 dagar |
| `offline_mode` | Komplex (sync engine, mutation queue, circuit breaker). Bakom flagga av en anledning. Inga E2E-tester. | E2E + stabilisering, 1-2 veckor |
| `group_bookings` | Fungerar men komplex feature. Behöver E2E-verifiering och UX-review. | E2E + review, 2-3 dagar |
| `follow_provider` | Fungerar men beroende av att det finns flera leverantörer i systemet. | Verifiering vid skalning |
| `municipality_watch` | Samma som follow_provider -- värde kommer med volym. | Verifiering vid skalning |

### Inte aktuella nu

| Flagga | Varför |
|--------|--------|
| `provider_subscription` | Monetarisering -- beslut efter demo. Kräver Stripe-prissättning. |
| `stable_profiles` | Tidig feature, aldrig testad i prod. Annat fokus nu. |

## Blockerare som styr tempot

| Blocker | Påverkar | Ägare | Status |
|---------|---------|-------|--------|
| Apple Developer (99 USD/år) | Push, App Store | Johan | Ej köpt |
| Stripe företagsverifiering | Swish, live-betalningar | Stripe | Pågår |
| Demo-feedback | Sprint 7+ prioritering | Johan | Om par dagar |
| Mapbox-token | Ruttplanering, provider-sök | Johan | Beslut behövs |
| Fortnox API-access | Fakturering | Johan | Ej påbörjat |

## Beslutspunkter

| När | Beslut |
|-----|--------|
| Efter demon | Vilka features prioriterar leverantören? |
| Innan leverantör #2 | Fas 2 RLS -- databas-skydd krävs |
| Vid 10+ leverantörer | Prisma -> Supabase-klient fullt? |
| Vid internationalisering | i18n-ramverk behövs |
