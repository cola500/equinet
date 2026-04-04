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
- **Branch protection på GitHub** (30 min, kritiskt med Stripe live-mode)
- **Verifiera Stripe webhook-idempotens** (1h, dubbel-event-test)
- **Verifiera databas-isolation** (dev vs prod, dokumentera risk)

## Sprint 15 (pågår -- cutover)

- **Auth-migrering komplett**: Supabase Auth live i prod, NextAuth borta
- **RLS live**: 28 policies på 7 kärndomäner, bevisat med 24 tester
- **Prod cutover klar**: hook + trigger + RLS applicerat, 17 användare migrerade, Vercel env bytt
- **PoC = staging**: `zzdamokfeenencuggjjp` dokumenterad som staging-miljö
- **Kvar**: Penetrationstest (S15-5)

## Nästa

- **Demo-feedback stories** -- prioriteras baserat på vad leverantören sa
- **Push live** -- plugga in APNs-credentials (15 min, kod redan klar)
- **Swish** -- aktivera i Stripe när företagsverifiering klar (1 rad kodändring)
- **Stripe live-mode** -- byt från test-nycklar till live-nycklar
- **customer_insights spike** -- fungerar AI-kopplingen? (1 dag, samma mönster som voice logging)
- **Onboarding-spike** -- hur registrerar sig leverantör #2 utan seed-data?
- **Vercel Analytics** (15 min) + **Dependabot** (30 min)

## Kort sikt (1-2 månader)

- **Staging-databas** -- schema-isolation bekräftad (S9-7 spike). `?schema=staging` i samma DB eller separat projekt. 30 min setup.
- **Fas 2 RLS** -- tunn vertikal slice. Schema-isolation förenklar testning (RLS i eget schema).
- **Onboarding utan seed-data** -- registreringsflöde för riktiga leverantörer
- **Stripe live-betalningar** -- riktiga pengar, kräver Stripe business verification
- **E-postverifiering** -- säkerställ att Resend levererar på egen domän
- **Backup RPO/RTO** -- dokumentera policy (24h RPO på free tier, testa restore)

## Medellång sikt (2-4 månader)

- **Admin-härdning** -- MFA obligatoriskt för admin, tidbegränsade admin-sessioner (15 min), audit log på admin-operationer. Supabase stödjer MFA redan. Kritiskt inför leverantör #2.
- **Kundupplevelsen** -- native iOS för kunder eller polerad WebView
- **Fortnox-integration** -- fakturering, sparar leverantörer ~1h/vecka (user research)
- **Ruttplanering** -- kräver Mapbox-token, hög efterfrågan (120 000 hästägare, ambulerande tjänster)
- **Fas 3 RLS** -- opportunistisk migrering av kärndomäner
- **GDPR data retention** -- policy + cron-job för radering av gammal data

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

### Genuint ofärdiga (kräver arbete)

| Flagga | Problem | Effort | Prioritet |
|--------|---------|--------|-----------|
| `voice_logging` | ~~AI-koppling oklar~~ VERIFIERAD (sprint 7 spike). Behöver Sonnet 4.6 + UTC-fix. | 0.5-1 dag | Sprint 8 (S8-3) |
| `customer_insights` | AI-koppling OVERIFIERAD. Samma frågor som voice logging. | Spike 1 dag | Nästa sprint |
| `route_planning` | Kräver Mapbox-token. Utan token: tom karta. | Mapbox-konto + token, 1-2 dagar | Kort sikt |
| `route_announcements` | Beroende av route_planning. | Löses med route_planning | Kort sikt |
| `business_insights` | Fungerar men behöver realistisk data. | Polish + seed-data, 1-2 dagar | Sprint 8 (S8-2) |
| `group_bookings` | Komplex. Behöver E2E + UX-review. | 2-3 dagar | Medellång sikt |

### Volymsberoende (rätt att vänta, inget arbete nu)

| Flagga | Varför vänta |
|--------|-------------|
| `follow_provider` | Värde kommer med fler leverantörer i systemet |
| `municipality_watch` | Samma -- kräver volym |

### Defer (för komplex, för lite värde nu)

| Flagga | Varför defer |
|--------|-------------|
| `offline_mode` | 1-2 veckors E2E-arbete, genererar inte intäkter, leverantörer märker inte direkt |

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
