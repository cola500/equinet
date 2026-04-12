---
title: "Equinet Roadmap"
description: "Produktroadmap med prioriteringar, blockerare och tidslinje"
category: guide
status: active
last_updated: 2026-04-11
tags: [roadmap, product, strategy]
sections:
  - Produktionsredo idag
  - Kvar innan lansering
  - Kort sikt
  - Medellang sikt
  - Langre sikt
  - Feature flags
  - Blockerare
---

# Equinet Roadmap

> Uppdateras efter varje sprint-retro. Senast: Sprint 22 (2026-04-11).

## Produktionsredo idag

| Feature | Status |
|---------|--------|
| Bokning (skapa, hantera, bekrafta, avboka, ombokning) | Live |
| Kundinbjudningar (invite ghost -> riktigt konto) | Live |
| Kortbetalning (Stripe test-mode) | Kod klar, flagga av |
| Push-notiser (iOS) | Kod klar, APNs saknas |
| Demo-lage | Live |
| iOS native (dashboard, bokningar, kunder, tjänster, profil, kalender, mer-flik) | Live |
| Due-for-service native | Live |
| Aterkommande bokningar | Live (default on) |
| Rostloggning med AI-tolkning | Live (default on) |
| AI-drivna kundinsikter | Live (default on) |
| Affarinsikter (tjansteanalys, tidsanalys, retention) | Live (default on) |
| Gruppbokningar | Live (default on) |
| Ruttplanering + annonsering | Kod klar, kraver Mapbox-token |
| Offline PWA (mutation queue, sync) | Live (default on) |
| Stallprofiler | Kod klar, flagga av |
| Onboarding-wizard for nya leverantörer | Live (S22) |
| Supabase Auth (managed, Custom Access Token Hook) | Live |
| RLS: 28 policies pa 7 karndomaner, 24 bevistester | Live |
| Stripe webhook idempotens (event-ID dedup) | Live (S21) |
| Rate limiting (Upstash Redis, 9+ limiters) | Live |
| Branch protection (PR + CI obligatoriskt) | Live (S22) |
| Sentry felrapportering + session replay | Live |
| Uptime-monitoring (Betterstack) | Dokumenterat (S21) |
| Security headers (HSTS preload, pinnad CSP, COOP) | Live (S21) |
| 4390+ tester (4018 unit/integration + 373 E2E) | Grona |
| Coverage-gate 70% i CI | Live (S20) |
| Backup-policy + incident response-plan | Dokumenterat (S22) |

## Kvar innan lansering

### Blockerare (bara Johan kan losa)

| Vad | Effort | Status |
|-----|--------|--------|
| Apple Developer (99 USD) | Config, 15 min | Ej kopt |
| Stripe foretagsverifiering | Config, 15 min | Pagar |
| Uppgradera till Vercel Pro ($20/man) | Config, 5 min | Hobby tillater inte kommersiellt bruk |

### Inga kodblockerare kvar

NFR Production Readiness Score: **79%** (50/63 klara). Enda P0-blocker ar Stripe live-mode -- vantar pa foretagsverifiering, inte kod.

**Saker att gora vid lansering (inte fore):**

| Vad | Effort | Varfor vanta |
|-----|--------|-------------|
| Rate limit alerting till Sentry | 30 min | Ingen trafik annu |
| Log aggregation (Axiom/Logtail) | 0.5 dag | Sentry racker for MVP |
| Skew protection / rolling releases | 15 min | Kraver Vercel Pro |

## Kort sikt (1-2 manader efter lansering)

| Vad | Effort | Varfor |
|-----|--------|--------|
| E-postverifiering Resend i prod (S22-3) | 0.5 dag | Blockerad -- kraver manuell test |
| GDPR data retention policy + cron | 1 dag | Lagkrav, behover definierade lagringsperioder |
| MFA for admin | 1 dag | Supabase TOTP, kritiskt vid leverantör #2 |
| Mapbox-token + ruttplanering live | 1-2 dagar | Hor efterfragan, men kraver konto + token |
| Lasttestning + prestandabaseline | 1-3 dagar | Vet inte om performance forsamras |
| Preview deploy-skydd | 15 min | Aktivera Vercel Password Protection |

## Medellang sikt (2-4 manader)

| Vad | Effort | Varfor |
|-----|--------|--------|
| Kundupplevelsen (native iOS eller polerad WebView) | 2-4 veckor | Idag ar alla kundskammar WebView |
| Fortnox-integration (fakturering) | 2-3 veckor | Sparar leverantörer ~1h/vecka |
| Provider subscription (monetarisering) | 1-2 veckor | Kraver prissbeslut |
| Fler native iOS-skarmar (6 kvar) | Lopande | Rostloggning, ruttplanering, gruppbokningar, annonsering, insikter, hjalpcentral |
| A11y-testning (axe-core + Playwright) | 1 dag | WCAG 2.1 AA |
| Core Web Vitals-matning | 1h | LCP, FID, CLS -- Vercel Analytics |

## Langre sikt (4+ manader)

- **App Store-publicering** (kraver Apple Developer + review-process)
- **Web Push** (browser-notiser utover iOS)
- **i18n** (om vi expanderar utanfor Sverige)
- **Supabase Realtime** (WebSocket, ersatter SWR-polling)
- **2FA for leverantorskonton** (TOTP, frivilligt forst)

---

## Feature flags -- lanseringsberedskap

### Redo att lansera (default on, fungerar)

| Flagga | Status |
|--------|--------|
| `voice_logging` | Live -- AI-tolkning med claude-sonnet-4-6 |
| `customer_insights` | Live -- AI-genererade kundinsikter |
| `business_insights` | Live -- Swift Charts i iOS (S8-2) |
| `route_planning` | Default on men kraver Mapbox-token |
| `route_announcements` | Default on, beroende av route_planning |
| `due_for_service` | Live, native vy klar |
| `self_reschedule` | Live |
| `recurring_bookings` | Live |
| `group_bookings` | Live |
| `offline_mode` | Live (mutation queue, sync, circuit breaker) |
| `follow_provider` | Live (varde vid volym) |
| `municipality_watch` | Live (varde vid volym) |
| `help_center` | Live |

### Kraver konfiguration (kod klar)

| Flagga | Vad saknas | Effort |
|--------|-----------|--------|
| `stripe_payments` | Stripe foretagsverifiering + live-nycklar | Config, 15 min |
| `push_notifications` | Apple Developer + APNs-credentials | Config, 15 min |
| `customer_invite` | Sla pa flaggan | Config, 1 min |

### Beslut behovs

| Flagga | Fraga |
|--------|-------|
| `provider_subscription` | Vilken prismodell? Stripe subscription-infrastruktur ar klar. |
| `stable_profiles` | Behalla eller ta bort? Aldrig testad med riktiga anvandare. |
| `demo_mode` | Behovs efter lansering? Kan slackas. |
| `supabase_auth_poc` | Bort -- PoC ar klar sedan S10. |

---

## Blockerare som styr tempot

| Blocker | Paverkar | Agare | Status |
|---------|---------|-------|--------|
| Apple Developer (99 USD/ar) | Push, App Store | Johan | Ej kopt |
| Stripe foretagsverifiering | Swish, live-betalningar | Stripe | Pagar |
| Mapbox-token | Ruttplanering, annonsering | Johan | Beslut behovs |
| Fortnox API-access | Fakturering | Johan | Ej paborjat |
| Prissbeslut (subscription) | Monetarisering | Johan | Ej paborjat |

## Beslutspunkter

| Nar | Beslut |
|-----|--------|
| Fore lansering | Vilka feature flags ska vara pa for forsta anvandarna? |
| Vid leverantör #2 | MFA for admin obligatoriskt |
| Vid 10+ leverantörer | Behovs Supabase Pro ($25/man)? |
| Vid internationalisering | i18n-ramverk behovs |
