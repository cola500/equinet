---
title: "Beslutshistorik"
description: "Kronologisk logg över arkitektur- och processbeslut, inklusive kurskorrigeringar"
category: guide
status: active
last_updated: 2026-04-04
tags: [decisions, architecture, process, history]
sections:
  - Arkitektur och teknik
  - Process och arbetssätt
  - Kurskorrigeringar
---

# Beslutshistorik

> Stora beslut, varför vi tog dem, och när vi ändrade oss.
> Detaljerade retros finns i `docs/retrospectives/`.

---

## Arkitektur och teknik

### Auth: NextAuth v5 beta -> Supabase Auth (nov 2025 -- apr 2026)

**Steg 1 -- NextAuth v5 beta (nov 2025):**
Valde NextAuth för snabb setup. Session-baserad auth, bcrypt-hashade lösenord i vår databas. Fungerade bra initialt.

**Steg 2 -- Custom MobileTokenService (mar 2026):**
iOS-appen behövde auth utan cookies. Byggde eget JWT-system (jose HS256, 90d expiry, Keychain-lagring, rotation). ~500 LOC. Fungerade men var ytterligare ett eget auth-system att underhålla.

**Steg 3 -- Dual-auth discovery (mar 2026):**
Insåg att vi hade TRE auth-system (NextAuth sessions, MobileToken JWT, Supabase RLS-tokens). Komplexiteten ökade med varje ny feature.

**Steg 4 -- Supabase Auth PoC (apr 2026, sprint 10):**
Spike bevisade att Supabase Auth kan ersätta allt: managed lösenord, JWT med custom claims via PL/pgSQL hook, RLS-kompatibelt. Go-beslut.

**Steg 5 -- Gradvis migrering via dual-auth (apr 2026, sprint 11-13):**
`getAuthUser()` helper som provar Bearer -> NextAuth -> Supabase. Migrerar 60+ routes utan big bang. `withApiHandler` ändrades EN gång och gav dual-auth till 28+ routes.

**Steg 6 -- Remove NextAuth (apr 2026, sprint 13, pågår):**
Tar bort NextAuth helt. Supabase Auth som enda källa.

**Kurskorrigering:** Vi planerade först att bygga RLS med Prisma + `set_config()` (Väg A). Spike visade att Supabase pooler (PgBouncer transaction mode) blockerar `SET ROLE`. Bytte till Väg B: Supabase Auth + user JWT, som fungerar nativt med RLS.

---

### RLS: Tre ansatser innan vi hittade rätt (apr 2026)

**Ansats 1 -- Prisma + set_config (parkerad):**
Idén: sätt `providerId` via `set_config()` i varje request, RLS-policies läser med `current_setting()`. Fungerade lokalt. Supabase pooler blockerade `SET ROLE` -> parkerad.

**Ansats 2 -- Stärk app-lagret först:**
Medan vi väntade på rätt RLS-lösning: `findByIdForProvider()` med atomisk WHERE i alla repositories. Ownership guards i app-koden. Snabb vinst utan databas-ändringar.

**Ansats 3 -- Supabase Auth + RLS (vald):**
Custom Access Token Hook lägger `providerId` i JWT. RLS-policies läser `auth.jwt()->'app_metadata'->>'providerId'`. Bevisad i PoC: provider ser bara sina bokningar, anon blockeras helt.

**Lärdomar:** Spika tidigt. Vi sparade veckor genom att testa PgBouncer-kompatibilitet innan vi byggde hela systemet.

---

### Betalning: Stripe + Swish (sprint 5)

**Beslut:** Stripe som betalningsgateway med IPaymentGateway-abstraktion.

**Alternativ vi valde bort:**
- Direkt Swish API (kräver BankID-avtal, egen integration)
- Klarna (onödigt komplext för B2B-tjänster)

**Varför Stripe:** Swish kommer som betalmetod via Stripe (1 rad kodändring när företagsverifiering klar). Abstraktion via IPaymentGateway gör det möjligt att byta utan att röra routes/UI.

**Kurskorrigering:** Webhook-idempotens var underspecad. Sprint 9 avslöjade TOCTOU race (två simultana webhooks passerade båda status-guarden). Fix: atomisk `updateMany` med `WHERE status NOT IN`.

---

### Staging-miljö: Schema-isolation bekräftad (sprint 9)

**Tre alternativ utredda:**

| Alternativ | Beslut |
|-----------|--------|
| Nytt Supabase Free-projekt | Fallback (2 min setup, noll risk) |
| Schema-isolation (`?schema=staging`) | **Vald** -- bekräftad i spike |
| Supabase Branching | För dyrt ($25/mån), för komplext |

**Spike-resultat:** `?schema=staging` fungerar med Prisma 6.19+, PgBouncer transaction mode OCH `$queryRawUnsafe`. Alla 32 migrationer applicerades korrekt. Data isolerad mellan schemas.

**Kurskorrigering:** Initialt oroliga för PgBouncer-inkompatibilitet (tech-architect flaggade). Spike bevisade att det fungerar. PgBouncer propagerar `search_path` korrekt i transaction mode.

---

### Offline PWA: Ambitiöst, stegvis nedskärning (feb -- mar 2026)

**Ursprunglig vision:** Full offline-kapabilitet med bakgrundssynk, conflict resolution, IndexedDB-cache.

**Verkligheten:** Tog 8 sessioner (session 71-80) att bygga grundläggande offline-stöd. Varje session avslöjade nya edge cases: iOS Safari falska online-events, thundering herd vid reconnect, QuotaExceeded, tab-koordinering.

**Kurskorrigeringar:**
- Session 78: Lade till circuit breaker (3x 5xx -> pausa kön), max 10 retries, jitter i backoff
- Session 80: `guardMutation` fångar nätverksfel och faller tillbaka till offline-köning (navigator.onLine ljuger)
- Feature-flaggad (`offline_mode`, default off) -- inte påtvingad

**Lärdom:** Offline är 10x svårare än det ser ut. Grundflödet tog 20% av tiden, edge cases 80%.

---

### iOS: Hybrid -> Native-first (mar 2026)

**Steg 1 -- Ren WKWebView (nov 2025 -- feb 2026):**
Snabbaste vägen till App Store. Webbappen i en Swift-wrapper med bridge för push, offline, haptics.

**Steg 2 -- Native-first rebuild (mar 2026):**
WebView-upplevelsen var "okej men inte native". Beslutade att migrera skärm för skärm till SwiftUI. Etablerade "Native Screen Pattern" (8 steg, dokumenterat i CLAUDE.md).

**Kurskorrigering -- Feature Inventory obligatorisk (session 99):**
Första native-konverteringen (Dashboard) missade features som fanns i webbversionen. Från och med session 99b: obligatorisk inventering av ALLA datapunkter, interaktioner och navigeringslänkar INNAN implementation.

**Status:** 10/16 provider-skärmar native. Återstående offloadas till WebView (röstloggning, ruttplanering, gruppbokningar).

---

## Process och arbetssätt

### Teamstruktur: Solo -> Lead + Dev (apr 2026)

**Före (nov 2025 -- mar 2026):**
En session åt gången. Johan beskriver uppgiften, Claude implementerar, Johan granskar.

**Sprint 3 (apr 2026) -- Introducerade roller:**
- **Lead** (tech lead): granskar planer, kör code review, mergar
- **Dev** (fullstack/iOS): implementerar enligt plan, TDD
- **Johan** (produktägare): scope, prioritet, affärsbeslut

**6 iterationer på en session** för att hitta rätt flöde:

| Problem | Fix |
|---------|-----|
| Parallella sessioner krockar | En session åt gången |
| Push direkt till main | Feature branches |
| Dev implementerar utan plan-OK | Stopp-regler |
| Lead kan inte läsa planen | Plan committas i `docs/plans/` |
| Status.md glöms bort | Skarpare regler, done-fil + status i samma commit |
| Dev behöver Lead-godkännande varje gång | Self-review med subagenter |

---

### Autonom sprint-körning (apr 2026)

**Evolution:**
1. Johan godkänner varje plan manuellt
2. Johan godkänner via "godkänd" i chatten
3. Self-review med subagenter, Johan bara vid produktbeslut
4. **Fullt autonom**: Dev kör hela sprinten, mergar själv, Lead-merge borttagen

**Trigger:** "Ni har ett så bra arbetssätt att vi borde effektivisera det mer."

**Regler:** Dev stannar BARA vid produktbeslut, saknade env-variabler, arkitektur utanför sprint-scope, eller 3x misslyckad `check:all`.

---

### TDD: Från "skriv tester" till BDD dual-loop (sprint 5)

**Steg 1:** "Skriv tester" -- oklart vilka, ofta bara unit-tester
**Steg 2:** "Tester FÖRST" -- TDD, men bara unit-level
**Steg 3 (sprint 5):** BDD dual-loop identifierat som gap. Dev hoppade över integrationstester i S5-2/S5-3.

**Fix:** Code-review-checklistan uppdaterad. Lead verifierar att yttre integrationstest finns för API routes och domain services.

---

### Branch-strategi: Kaos -> Ordning (sprint 3 -- sprint 13)

**Sprint 3:** Branches skapades men rensades inte. Remote ackumulerade döda branches.
**Sprint 9:** PR-baserat flöde med GitHub CI. Strict mode invaliderade PRs -> avstängt.
**Sprint 13:** Branch-kaos igen. S13-1/4/5 committade på feature branches men aldrig mergade till main.

**Nuvarande modell (formaliserad i `autonomous-sprint.md`):**
```
Feature branch -> Implementation -> check:all -> Merge till main -> Radera branch (lokalt + remote)
```

---

## Kurskorrigeringar (kronologiskt)

| Datum | Vad vi trodde | Vad som hände | Ny riktning |
|-------|--------------|---------------|-------------|
| 2025-11 | NextAuth räcker för allt | iOS behövde annat auth-system | MobileTokenService (senare Supabase Auth) |
| 2026-02 | Offline är "bara cache" | 8 sessioner av edge cases | Feature-flaggad, circuit breaker, probe backoff |
| 2026-03 | WKWebView-wrapper räcker | Inte native-känsla | Native-first rebuild, skärm för skärm |
| 2026-03 | En Claude-session räcker | Missade features vid native-konvertering | Obligatorisk Feature Inventory |
| 2026-04 | Prisma + set_config för RLS | PgBouncer blockerar SET ROLE | Supabase Auth + user JWT |
| 2026-04 | Lead måste godkänna allt | Flaskhals, Johan behöver inte vara involverad | Self-review med subagenter, autonom sprint |
| 2026-04 | Strict branch protection | CI-kö invaliderade PRs | Av, quality gates i pre-push hook istället |
| 2026-04 | Daterade modell-IDn stabila | `claude-sonnet-4-6-20250514` returnerade 404 | Alias-only policy |

---

> **Princip som vuxit fram:** Spika tidigt, migrera gradvis, feature-flagga allt.
> Varje stor kurskorrigering kom från att vi testade antaganden i en spike istället för att bygga på gissningar.
