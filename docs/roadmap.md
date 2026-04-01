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
