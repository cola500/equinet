---
title: Feature flags -- genomgång
description: Inventering och riskbedömning av alla 17+1 feature flags i Equinet
category: architecture
status: current
last_updated: 2026-03-28
sections:
  - Inventering
  - Användningsmatris
  - Hälsostatus
  - Saknade gates
  - Demo mode-samspel
  - Risker
  - Rekommendationer
---

# Feature flags -- genomgång

> Genomförd 2026-03-28. 18 flaggor granskade mot server-routes, klient-komponenter, navigation och E2E.

---

## Inventering

### 18 flaggor totalt (17 feature + 1 demo)

| Flagga | Default | Kategori | Klient-synlig | Aktiv |
|--------|---------|----------|--------------|-------|
| `voice_logging` | on | provider | ja | ja |
| `route_planning` | on | provider | ja | ja |
| `route_announcements` | on | provider | ja | ja |
| `customer_insights` | on | provider | ja | ja |
| `due_for_service` | on | provider | ja | ja |
| `group_bookings` | on | provider | ja | ja |
| `business_insights` | on | provider | ja | ja |
| `self_reschedule` | on | customer | ja | ja |
| `recurring_bookings` | on | provider | ja | ja |
| `offline_mode` | on | shared | ja | ja |
| `follow_provider` | on | customer | ja | ja |
| `municipality_watch` | on | customer | ja | ja |
| `provider_subscription` | off | provider | ja | ja |
| `customer_invite` | off | provider | nej | ja |
| `push_notifications` | off | shared | nej | ja |
| `help_center` | on | shared | ja | ja |
| `stable_profiles` | off | shared | ja | ja |
| `demo_mode` | off | shared | ja | ja (special) |

**Döda flaggor: 0.** Alla 18 har minst en server- eller klient-referens.

---

## Användningsmatris

| Flagga | Server-routes | Klient-sidor | Nav-gating | E2E-override |
|--------|:---:|:---:|:---:|:---:|
| `voice_logging` | 2 | 3 | ja | nej (default on) |
| `route_planning` | 9 | 2 | ja | nej (default on) |
| `route_announcements` | 1 | 1 | ja | nej (default on) |
| `customer_insights` | **0** | 1 | nej | ja |
| `due_for_service` | **0** (provider) | 1 | ja | ja |
| `group_bookings` | 9 | 2 | ja | ja |
| `business_insights` | 0 | 1 | ja | ja |
| `self_reschedule` | 1 | 1 | ja (villkorlig) | ja |
| `recurring_bookings` | 3 | 2 | ja | ja |
| `offline_mode` | 0 | 5 | nej | ja |
| `follow_provider` | 1 | 2 | nej | ja |
| `municipality_watch` | 1 | 1 | nej | ja |
| `provider_subscription` | 3 | 1 | ja | nej (default off) |
| `customer_invite` | 3 | 0 | ja (profil) | nej (default off) |
| `push_notifications` | 2 | 0 | nej | nej (default off) |
| `help_center` | 0 | 4 | ja | nej (default on) |
| `stable_profiles` | 10 | 5 | ja | nej (default off) |
| `demo_mode` | 0 | 12 | ja (layout) | nej (default off) |

---

## Hälsostatus

### Fullt gatade (server + klient + nav) -- 10 flaggor

`voice_logging`, `route_planning`, `route_announcements`, `group_bookings`, `self_reschedule`, `recurring_bookings`, `provider_subscription`, `customer_invite`, `stable_profiles`, `demo_mode`

### Delvis gatade -- 6 flaggor

| Flagga | Saknas | Risk |
|--------|--------|------|
| `customer_insights` | **Server-gate saknas** | API anropbart utan flagga |
| `due_for_service` | **Provider-route saknar gate** | Provider-API anropbart utan flagga |
| `business_insights` | Ingen server-route | Read-only analytics -- låg risk |
| `offline_mode` | Ingen server-route | Klient-only PWA -- korrekt |
| `help_center` | Ingen server-route | Read-only content -- korrekt |
| `push_notifications` | Ingen klient-gate | Backend-only -- korrekt |

### Acceptabelt utan server-gate -- 3 flaggor

`business_insights` (read-only, inga mutations-routes), `offline_mode` (klient-only PWA), `help_center` (read-only content). Dessa behöver inte server-gates.

---

## Saknade gates (2 konkreta brister)

### 1. customer_insights: API saknar server-gate

**Fil**: `src/app/api/provider/customers/[customerId]/insights/route.ts`
**Problem**: POST-endpoint för AI-genererade kundinsikter har ingen `isFeatureEnabled("customer_insights")`-check. Klient-sidan gatar via `CustomerCard.tsx`, men API:t är direkt anropbart.
**Risk**: Medel. AI-anrop har kostnad (rate-limitad med `ai`-limiter). Om flaggan stängs av syns inga insikter i UI, men API:t svarar fortfarande.
**Fix**: Lägg till standard feature-flag-gate (3 rader).

### 2. due_for_service: Provider-route saknar server-gate

**Fil**: `src/app/api/provider/due-for-service/route.ts`
**Problem**: GET-endpoint har ingen `isFeatureEnabled("due_for_service")`-check. Kund-endpointen (`/api/customer/due-for-service`) HAR gate.
**Risk**: Låg. Read-only data. Men inkonsekvent -- kund-routen gatar, provider-routen inte.
**Fix**: Lägg till standard feature-flag-gate (3 rader).

---

## Demo mode-samspel

### Hur det fungerar

Demo mode har **dubbelt aktiveringsmönster**:
1. `NEXT_PUBLIC_DEMO_MODE=true` (env-variabel, synkron)
2. `demo_mode` feature flag (databas, asynkron)

`isDemoModeWithFlags(flags)` kombinerar båda. Används i 12 komponenter.

### Samspel med feature flags

Demo mode **stänger av UI** för:
- `self_reschedule` toggle i profil (villkorlig `&& !demo`)
- `recurring_bookings` toggle i profil (villkorlig `&& !demo`)
- Sekundär navigation (voice-log, ruttplanering, insikter etc.)
- Verifiering, integrationer, export, recensioner-sidor (redirect)

### Bedömning

**Rent implementerat.** Demo mode och feature flags är separata mekanismer med tydligt definierat samspel. Demo mode döljer UI-element, feature flags styr server-åtkomst. Ingen rörig koppling.

### En subtilitet

`provider/profile/page.tsx` visar reschedule- och recurring-settings villkorligt med `useFeatureFlag("self_reschedule") && !demo`. Om demo mode är av men feature flag är av ser användaren ingenting (korrekt). Om demo mode är på men feature flag är på ser användaren heller ingenting (korrekt -- demo döljer). Logiken är konsekvent.

---

## Risker

### 1. Saknad server-gate på customer_insights (MEDEL)

AI-kostnadsexponering om flaggan stängs av men API:t fortfarande svarar. Rate limiting mildrar men eliminerar inte.

### 2. Inkonsekvent gating av due_for_service (LÅG)

Kund-route gatar, provider-route gatar inte. Ingen säkerhetsrisk (read-only) men inkonsekvent kontrakt.

### 3. Alla flaggor default ON kan överraska (LÅG)

14 av 18 flaggor är default-on. Vid ny installation är alla features aktiva. Det är medvetet (alla features är production-ready) men kan överraska om en flagga ska vara off i en specifik miljö.

---

## Rekommendationer

### Bör göras (2 st, totalt ~10 min)

1. **Lägg till server-gate i `provider/customers/[customerId]/insights/route.ts`**
   ```typescript
   if (!(await isFeatureEnabled("customer_insights"))) {
     return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
   }
   ```

2. **Lägg till server-gate i `provider/due-for-service/route.ts`**
   ```typescript
   if (!(await isFeatureEnabled("due_for_service"))) {
     return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
   }
   ```

### Kan göras vid tillfälle

3. Kör `npm run flags:validate` i CI (fångar nya saknade gates automatiskt)
4. Dokumentera att `business_insights`, `offline_mode`, `help_center` medvetet saknar server-gates (read-only/klient-only)

### Bör INTE göras

- Ändra default-värden (alla features är production-ready, defaults är korrekta)
- Lägga till server-gates för read-only flaggor (business_insights, help_center, offline_mode)
- Refaktorera demo mode-samspelet (fungerar bra som det är)
- Ta bort flaggor (alla är aktiva och används)
